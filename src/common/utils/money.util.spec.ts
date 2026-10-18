import {
  calculateRepairTotals,
  deriveTicketPaymentStatus,
  roundMoney,
} from './money.util';

describe('money.util', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it('calculates repair totals correctly', () => {
    const result = calculateRepairTotals({
      partsSubtotal: 100,
      laborCharge: 50,
      discount: 10,
      tax: 5,
      totalPaid: 40,
    });
    expect(result.subtotal).toBe(150);
    expect(result.total).toBe(145);
    expect(result.outstandingBalance).toBe(105);
  });

  it('derives payment statuses', () => {
    expect(deriveTicketPaymentStatus(100, 0)).toBe('UNPAID');
    expect(deriveTicketPaymentStatus(100, 40)).toBe('PARTIALLY_PAID');
    expect(deriveTicketPaymentStatus(100, 100)).toBe('PAID');
    expect(deriveTicketPaymentStatus(100, 0, 50)).toBe('REFUNDED');
  });
});
