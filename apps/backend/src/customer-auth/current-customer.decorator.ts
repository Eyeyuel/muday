import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CustomerJwtPayload } from './customer-session-types.js';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user?: CustomerJwtPayload }>();
    return request.user!;
  },
);
