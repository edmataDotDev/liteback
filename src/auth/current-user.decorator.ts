import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload } from './jwt-payload.types';

type RequestWithUser = Request & { user?: AccessTokenPayload };

export const CurrentUser = createParamDecorator(
  (
    property: keyof AccessTokenPayload | undefined,
    ctx: ExecutionContext,
  ): AccessTokenPayload | AccessTokenPayload[keyof AccessTokenPayload] => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      return undefined as never;
    }
    if (property !== undefined) {
      return user[property];
    }
    return user;
  },
);
