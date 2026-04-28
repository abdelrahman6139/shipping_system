export type Role = 'CLIENT' | 'ADMIN' | 'DRIVER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
