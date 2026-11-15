/**
 * paymentWebhookHandler
 *
 * Handles incoming payment webhooks from CCBill and other providers.
 * Updates Subscription entity state and sends notifications.
 *
 * SECURITY:
 *   - Every POST must carry the shared webhook secret (x-webhook-secret header
 *     or Authorization: Bearer <secret>). Without a configured secret the
 *     handler refuses to process anything.
 *   - Subscriptions are only ever UPDATED by external_subscription_id, matching a
 *     record that was created through the authenticated checkout flow. The
 *     webhook never creates subscriptions and never looks a subscription up by
 *     an email address supplied by the caller.
 *
 * Supported events:
 *   - subscription.created   → active
 *   - subscription.renewed   → active
 *   - subscription.failed    → past_due
 *   - subscription.cancelled → cancelled
 *   - subscription.expired   → expired
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Constant-time string comparison ─────────────────────────────────────────

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Subscription status mapping ─────────────────────────────────────────────

function mapEventToStatus(event) {
  const map = {
    'subscription.created':   'active',
    'subscription.renewed':   'active',
    'subscription.failed':    'past_due',
    'subscription.cancelled': 'cancelled',
    'subscription.expired':   'expired',
    // CCBill specific
    'NewSaleSuccess':  'active',
    'RenewalSuccess':  'active',
    'RenewalFailure':  'past_due',
    'Cancellation':    'cancelled',
    'Expiration':      'expired',
  };
  return map[event] || null;
}

// ─── Parse CCBill webhook (URLEncoded form body) ──────────────────────────────

function parseCCBillWebhook(formData) {
  const eventType = formData.get('eventType') || formData.get('X-eventType');
  const subscriptionId = formData.get('subscriptionId');
  const email = formData.get('email');
  const clientAccnum = formData.get('clientAccnum');
  const nextRenewalDate = formData.get('nextRenewalDate');
  const subscriptionPrice = formData.get('subscriptionInitialPrice') || formData.get('subscriptionRenewalPrice');

  return {
    provider: 'ccbill',
    event: eventType,
    subscriptionId,
    customerEmail: email,
    merchantId: clientAccnum,
    nextRenewalDate,
    amount: parseFloat(subscriptionPrice || '0'),
    currency: 'USD',
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Support GET for webhook URL verification (CCBill sends a test GET)
  if (req.method === 'GET') {
    return new Response('OK', { status: 200 });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // ── Verify the caller before touching any state ───────────────────────────
  const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[paymentWebhook] PAYMENT_WEBHOOK_SECRET is not configured — refusing request');
    return Response.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const providedSecret = req.headers.get('x-webhook-secret')
    || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!safeEqual(providedSecret, webhookSecret)) {
    console.warn('[paymentWebhook] Rejected unverified webhook call');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // Detect content type to determine provider
    const contentType = req.headers.get('content-type') || '';
    let parsed;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // CCBill sends URL-encoded form data
      const body = await req.formData();
      parsed = parseCCBillWebhook(body);
    } else {
      // JSON-based providers (future: Stripe, etc.)
      const body = await req.json();
      parsed = {
        provider: body.provider || 'unknown',
        event: body.type || body.event,
        subscriptionId: body.subscriptionId || body.data?.subscription_id,
        customerEmail: body.customerEmail || body.customer?.email,
        amount: body.amount || 0,
        currency: body.currency || 'USD',
        raw: body,
      };
    }

    const newStatus = mapEventToStatus(parsed.event);
    if (!newStatus) {
      // Unknown event — log and ignore
      console.log('[paymentWebhook] Unknown event type:', parsed.event);
      return Response.json({ received: true, event: parsed.event, action: 'ignored' });
    }

    // Only ever match an existing subscription created by the authenticated
    // checkout flow. Never create from a webhook, never match by email.
    if (!parsed.subscriptionId) {
      console.warn('[paymentWebhook] Missing provider subscription id');
      return Response.json({ received: true, action: 'not_found' });
    }

    const subs = await svc.entities.Subscription
      .filter({ external_subscription_id: parsed.subscriptionId })
      .catch(() => []);
    const subscription = subs[0];

    if (!subscription) {
      console.warn('[paymentWebhook] Subscription not found for:', parsed.subscriptionId);
      return Response.json({ received: true, action: 'not_found' });
    }

    // Update subscription status
    const updateData = { status: newStatus, updated_at: now };
    if (newStatus === 'active' && parsed.nextRenewalDate) {
      updateData.current_period_end = parsed.nextRenewalDate;
    }
    if (['cancelled', 'expired'].includes(newStatus)) {
      updateData.cancelled_at = now;
    }

    await svc.entities.Subscription.update(subscription.id, updateData);

    // Send notification to user
    const notifMessages = {
      active: { title: 'Subscription Renewed', body: 'Your subscription has been renewed successfully.' },
      past_due: { title: 'Payment Failed', body: 'Your payment failed. Please update your payment method to keep your subscription active.' },
      cancelled: { title: 'Subscription Cancelled', body: 'Your subscription has been cancelled. You can resubscribe at any time.' },
      expired: { title: 'Subscription Expired', body: 'Your subscription has expired. Resubscribe to regain access.' },
    };
    const notifData = notifMessages[newStatus];
    if (notifData) {
      await svc.entities.Notification.create({
        user_id: subscription.user_id,
        type: 'system_announcements',
        ...notifData,
      }).catch(() => {});
    }

    // Audit log
    await svc.entities.AdminActionLog.create({
      admin_user_id: 'SYSTEM_PAYMENT',
      target_type: 'Subscription',
      target_id: subscription.id,
      action: `subscription_${newStatus}`,
      reason: `Payment webhook: ${parsed.event} from ${parsed.provider}`,
      metadata_json: { event: parsed.event, provider: parsed.provider, subscriptionId: parsed.subscriptionId, newStatus, timestamp: now },
    }).catch(() => {});

    return Response.json({ received: true, action: `subscription_${newStatus}`, subscriptionId: subscription.id });

  } catch (error) {
    console.error('[paymentWebhook] Error:', error.message);
    // Always return 200 to prevent webhook retry loops
    return Response.json({ received: true, error: 'processing_error' }, { status: 200 });
  }
});