export enum RepairStatus {
  RECEIVED = 'RECEIVED',
  DIAGNOSING = 'DIAGNOSING',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  WAITING_FOR_PARTS = 'WAITING_FOR_PARTS',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  [RepairStatus.RECEIVED]: [RepairStatus.DIAGNOSING, RepairStatus.CANCELLED],
  [RepairStatus.DIAGNOSING]: [
    RepairStatus.WAITING_FOR_APPROVAL,
    RepairStatus.WAITING_FOR_PARTS,
    RepairStatus.IN_PROGRESS,
    RepairStatus.CANCELLED,
  ],
  [RepairStatus.WAITING_FOR_APPROVAL]: [
    RepairStatus.WAITING_FOR_PARTS,
    RepairStatus.IN_PROGRESS,
    RepairStatus.CANCELLED,
  ],
  [RepairStatus.WAITING_FOR_PARTS]: [RepairStatus.IN_PROGRESS, RepairStatus.CANCELLED],
  [RepairStatus.IN_PROGRESS]: [
    RepairStatus.WAITING_FOR_PARTS,
    RepairStatus.WAITING_FOR_APPROVAL,
    RepairStatus.COMPLETED,
    RepairStatus.CANCELLED,
  ],
  [RepairStatus.COMPLETED]: [RepairStatus.READY_FOR_PICKUP],
  [RepairStatus.READY_FOR_PICKUP]: [RepairStatus.DELIVERED],
  [RepairStatus.DELIVERED]: [],
  [RepairStatus.CANCELLED]: [],
};

export function canTransition(from: RepairStatus, to: RepairStatus, reopen = false): boolean {
  if (reopen && from === RepairStatus.CANCELLED) {
    return to === RepairStatus.RECEIVED || to === RepairStatus.DIAGNOSING;
  }
  if (reopen && from === RepairStatus.DELIVERED) {
    return to === RepairStatus.IN_PROGRESS || to === RepairStatus.DIAGNOSING;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
