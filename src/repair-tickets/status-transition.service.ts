import { BadRequestException, Injectable } from '@nestjs/common';
import { canTransition, RepairStatus } from '../common/constants/repair-status';

@Injectable()
export class StatusTransitionService {
  assertTransition(from: RepairStatus, to: RepairStatus, reopen = false) {
    if (from === to) {
      throw new BadRequestException('Ticket is already in this status');
    }
    if (!canTransition(from, to, reopen)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`);
    }
  }
}
