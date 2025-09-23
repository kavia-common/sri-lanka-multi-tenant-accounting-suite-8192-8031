require('../jest.setup');

const { computeVAT } = require('../src/utils/tax_lk');

describe('Sri Lankan VAT Utility', () => {
  test('computes VAT with default rate from env', () => {
    process.env.LK_VAT_STANDARD_RATE = '0.15';
    const res = computeVAT(1000);
    expect(res).toEqual({ base: 1000, rate: 0.15, vat: 150, total: 1150 });
  });

  test('computes VAT with provided rate', () => {
    const res = computeVAT(2000, 0.18);
    expect(res.base).toBe(2000);
    expect(res.rate).toBe(0.18);
    expect(res.vat).toBe(360);
    expect(res.total).toBe(2360);
  });

  test('handles zero and rounding', () => {
    const res = computeVAT(0.01, 0.15);
    expect(res.vat).toBe(0); // 0.0015 -> 0.00
    expect(res.total).toBe(0.01);
  });
});
