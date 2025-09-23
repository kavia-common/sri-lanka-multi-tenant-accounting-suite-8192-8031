'use strict';

/**
 * PUBLIC_INTERFACE
 * Compute Sri Lankan VAT for a given amount using a provided rate.
 * Default rate comes from env (LK_VAT_STANDARD_RATE) if not provided.
 */
function computeVAT(amount, rate) {
  /** This is a public function. */
  const r = rate !== undefined ? Number(rate) : Number(process.env.LK_VAT_STANDARD_RATE || '0.15');
  const base = Number(amount || 0);
  const vat = Number((base * r).toFixed(2));
  const total = Number((base + vat).toFixed(2));
  return { base, rate: r, vat, total };
}

module.exports = {
  computeVAT,
};
