export enum UserRole {
  ADMIN = 'ADMIN',
  TECHNICIAN = 'TECHNICIAN',
  CUSTOMER = 'CUSTOMER',
}

export const ALL_STAFF_ROLES = [UserRole.ADMIN, UserRole.TECHNICIAN] as const;
