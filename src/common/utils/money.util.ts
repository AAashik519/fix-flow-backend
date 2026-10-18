export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRepairTotals(input: {
  partsSubtotal: number;
  laborCharge: number;
  discount?: number;
  tax?: number;
  totalPaid?: number;
}) {
  const partsSubtotal = roundMoney(input.partsSubtotal);
  const laborCharge = roundMoney(input.laborCharge);
  const discount = roundMoney(input.discount ?? 0);
  const tax = roundMoney(input.tax ?? 0);
  const subtotal = roundMoney(partsSubtotal + laborCharge);
  const total = roundMoney(Math.max(0, subtotal - discount + tax));
  const totalPaid = roundMoney(input.totalPaid ?? 0);
  const outstandingBalance = roundMoney(Math.max(0, total - totalPaid));
  return { partsSubtotal, laborCharge, discount, tax, subtotal, total, totalPaid, outstandingBalance };
}

export function deriveTicketPaymentStatus(
  total: number,
  totalPaid: number,
  refundedAmount = 0,
): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED' {
  const t = roundMoney(total);
  const paid = roundMoney(totalPaid);
  const refunded = roundMoney(refundedAmount);
  if (refunded > 0 && paid <= 0) return 'REFUNDED';
  if (refunded > 0 && paid > 0) return 'PARTIALLY_REFUNDED';
  if (paid <= 0) return 'UNPAID';
  if (paid + 0.001 < t) return 'PARTIALLY_PAID';
  return 'PAID';
}
