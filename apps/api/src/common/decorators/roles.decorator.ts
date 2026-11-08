import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@edu-center/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (SystemRole | string)[]) => SetMetadata(ROLES_KEY, roles);
