// src/auth/interfaces/request-with-user.interface.ts

import { Request } from 'express';
import { User } from '@prisma/client';

export interface RequestWithUser extends Request {
  user: User;
}
