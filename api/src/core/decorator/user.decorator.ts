import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return {
    // email: request.user.email,
    roleid:request.user.roleid,
    id: request.user.id,
    // id: Number.parseInt(request.user['custom:id'], 10),
  };
});