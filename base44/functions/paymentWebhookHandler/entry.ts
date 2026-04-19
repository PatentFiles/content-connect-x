/**
 * paymentWebhookHandler
 *
 * Handles incoming payment webhooks from CCBill and other providers.
 * Updates Subscription entity state and sends notifications.
 *
 * Supported events:
 *   - subscription.created   → active
 *   - subscription.renewed   → active
 *   - subscription.failed    → past_due
 *   - subscription.cancelled → cancelled
 *   - subscription.expired   → expired
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Find subscription by provider subscription ID or customer email
    let subscription = null;
    if (parsed.subscriptionId) {
      const subs = await svc.entities.Subscription.filter({ external_subscription_id: parsed.subscriptionId }).catch(() => []);
      subscription = subs[0];
    }
    if (!subscription && parsed.customerEmail) {
      const subs = await svc.entities.Subscription.filter({ user_id: parsed.customerEmail }).catch(() => []);
      subscription = subs[0];
    }

    if (!subscription) {
      // If this is a new subscription creation, create the record
      if (newStatus === 'active' && parsed.customerEmail) {
        await svc.entities.Subscription.create({
          user_id: parsed.customerEmail,
          status: 'active',
          external_subscription_id: parsed.subscriptionId || null,
          provider: parsed.provider,
          started_at: now,
          current_period_end: parsed.nextRenewalDate || null,
          amount: parsed.amount,
          currency: parsed.currency,
        });

        // Send welcome notification
        await svc.entities.Notification.create({
          user_id: parsed.customerEmail,
          type: 'system_announcements',
          title: 'Subscription Active',
          body: 'Your subscription is now active. Welcome to Content Connect!',
        }).catch(() => {});

        await svc.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_PAYMENT',
          target_type: 'Subscription',
          target_id: parsed.customerEmail,
          action: 'subscription_created',
          reason: `New subscription from ${parsed.provider}`,
          metadata_json: { event: parsed.event, provider: parsed.provider, subscriptionId: parsed.subscriptionId, timestamp: now },
        }).catch(() => {});

        return Response.json({ received: true, action: 'subscription_created' });
      }

      console.warn('[paymentWebhook] Subscription not found for:', parsed);
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