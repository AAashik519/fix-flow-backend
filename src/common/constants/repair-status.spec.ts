import { canTransition, RepairStatus } from './repair-status';

describe('repair status transitions', () => {
  it('allows RECEIVED -> DIAGNOSING', () => {
    expect(canTransition(RepairStatus.RECEIVED, RepairStatus.DIAGNOSING)).toBe(true);
  });

  it('blocks DELIVERED -> DIAGNOSING without reopen', () => {
    expect(canTransition(RepairStatus.DELIVERED, RepairStatus.DIAGNOSING)).toBe(false);
  });

  it('allows reopen from DELIVERED', () => {
    expect(canTransition(RepairStatus.DELIVERED, RepairStatus.DIAGNOSING, true)).toBe(true);
  });

  it('blocks CANCELLED normal transitions', () => {
    expect(canTransition(RepairStatus.CANCELLED, RepairStatus.IN_PROGRESS)).toBe(false);
  });
});
