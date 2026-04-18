/**
 * hostingPricing.js — Central pricing engine for the hosting marketplace.
 *
 * All fee rates, reserve %, and payout delays are read from feature flags
 * (which are DB-overridable via PlatformFeatureFlag records) so everything
 * is configurable without a redeploy.
 *
 * Usage:
 *   import { calculateBookingFee, buildPricingSnapshot } from '@/lib/hostingPricing';
 *
 * Pure functions — no side effects, no API calls.
 */

// ─── Default rates (mirrored in featureFlags DEFAULT_FLAGS) ──────────────────
export const HOSTING_PRICING_DEFAULTS = {
  hosting_booking_fee_pct:        20,   // Platform take rate (%)
  pro_host_booking_fee_pct:       12,   // Reduced fee for Pro Hosts (%)
  pro_host_subscription_price:    25,   // $/month
  reserve_pct_default:            10,   // % of payout held in reserve
  reserve_pct_pro_host:            5,   // Reduced reserve for Pro Hosts
  payout_delay_hours_default:     24,   // Hours after completion before payout
  payout_delay_hours_pro_host:    12,   // Faster payout for Pro Hosts
  access_issue_sla_minutes:       30,   // SLA for access issue resolution
};

/**
 * Resolve current pricing config from the flags map.
 * `flags` is the object returned by useFeatureFlags().
 */
export function resolvePricingConfig(flags = {}) {
  return {
    bookingFeePct:        flags.hosting_booking_fee_pct        ?? HOSTING_PRICING_DEFAULTS.hosting_booking_fee_pct,
    proHostBookingFeePct: flags.pro_host_booking_fee_pct       ?? HOSTING_PRICING_DEFAULTS.pro_host_booking_fee_pct,
    proHostSubPrice:      flags.pro_host_subscription_price    ?? HOSTING_PRICING_DEFAULTS.pro_host_subscription_price,
    reservePctDefault:    flags.reserve_pct_default            ?? HOSTING_PRICING_DEFAULTS.reserve_pct_default,
    reservePctProHost:    flags.reserve_pct_pro_host           ?? HOSTING_PRICING_DEFAULTS.reserve_pct_pro_host,
    payoutDelayDefault:   flags.payout_delay_hours_default     ?? HOSTING_PRICING_DEFAULTS.payout_delay_hours_default,
    payoutDelayProHost:   flags.payout_delay_hours_pro_host    ?? HOSTING_PRICING_DEFAULTS.payout_delay_hours_pro_host,
    accessIssueSla:       flags.access_issue_sla_minutes       ?? HOSTING_PRICING_DEFAULTS.access_issue_sla_minutes,
  };
}

/**
 * Calculate the platform fee amount and host payout for a given subtotal.
 *
 * @param {number}  subtotal       - Pre-fee total (base + equipment + bundle + cleaning)
 * @param {boolean} isProHost      - Whether the host has an active Pro Host subscription
 * @param {object}  pricingConfig  - Result of resolvePricingConfig()
 * @returns {{ feePct, feeAmount, hostPayout }}
 */
export function calculateBookingFee(subtotal, isProHost, pricingConfig) {
  const feePct = isProHost ? pricingConfig.proHostBookingFeePct : pricingConfig.bookingFeePct;
  const feeAmount = parseFloat(((subtotal * feePct) / 100).toFixed(2));
  const hostPayout = parseFloat((subtotal - feeAmount).toFixed(2));
  return { feePct, feeAmount, hostPayout };
}

/**
 * Build a complete, immutable pricing snapshot to store on SoloSession.booking_snapshot.
 * All monetary values rounded to 2 decimal places.
 *
 * @param {object} params
 * @param {number}  params.basePropertyCost   - Hourly/daily/half-day rate × hours
 * @param {number}  params.equipmentTotal     - Sum of selected equipment rentals
 * @param {number}  params.bundleModifier     - Flat or % bundle modifier
 * @param {number}  params.cleaningFee        - Flat cleaning fee (or 0)
 * @param {boolean} params.isProHost          - Host's Pro Host status at booking time
 * @param {object}  params.pricingConfig      - From resolvePricingConfig()
 * @param {object}  params.property           - Property record (for geo_risk override)
 * @returns {object} Immutable pricing snapshot
 */
export function buildPricingSnapshot({
  basePropertyCost = 0,
  equipmentTotal = 0,
  bundleModifier = 0,
  cleaningFee = 0,
  isProHost = false,
  pricingConfig,
  property = null,
}) {
  const subtotal = parseFloat((basePropertyCost + equipmentTotal + bundleModifier + cleaningFee).toFixed(2));
  const { feePct, feeAmount, hostPayout } = calculateBookingFee(subtotal, isProHost, pricingConfig);

  // Admin can override reserve % per property via geo_risk.reserve_pct_override
  const reservePct = property?.geo_risk?.reserve_pct_override
    ?? (isProHost ? pricingConfig.reservePctProHost : pricingConfig.reservePctDefault);
  const reserveAmount = parseFloat(((hostPayout * reservePct) / 100).toFixed(2));
  const netHostPayout = parseFloat((hostPayout - reserveAmount).toFixed(2));

  const payoutDelayHours = isProHost
    ? pricingConfig.payoutDelayProHost
    : pricingConfig.payoutDelayDefault;

  return {
    base_property_cost: basePropertyCost,
    equipment_total: equipmentTotal,
    bundle_modifier: bundleModifier,
    cleaning_fee: cleaningFee,
    subtotal,
    platform_fee_pct: feePct,
    platform_fee_amount: feeAmount,
    host_payout: hostPayout,
    reserve_pct: reservePct,
    reserve_amount: reserveAmount,
    net_host_payout: netHostPayout,
    payout_delay_hours: payoutDelayHours,
    is_pro_host: isProHost,
    grand_total: subtotal,      // guest pays subtotal (fee is taken from host payout)
    currency: 'USD',
    snapshot_version: '1.0',
    snapshot_at: new Date().toISOString(),
  };
}

/**
 * Determine effective booking fee % for display purposes.
 */
export function getEffectiveFeePct(isProHost, pricingConfig) {
  return isProHost ? pricingConfig.proHostBookingFeePct : pricingConfig.bookingFeePct;
}