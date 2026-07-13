import { type UserRole } from '@ppm/contracts';

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: UserRole;
    }
    interface Request {
      id?: string;
      user?: User;
    }
  }
}

export {};
