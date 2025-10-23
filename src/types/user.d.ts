// src/types/user.d.ts
export type UserRole = 'customer' | 'staff' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
}

// For login response
export interface AuthResponse {
  user: User;
  token: string;
}