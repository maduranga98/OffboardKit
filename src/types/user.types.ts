import type { Timestamp } from "firebase/firestore";

export type UserRole = "super_admin" | "hr_admin" | "manager" | "it_admin";

export interface AppUser {
  id: string;
  companyId: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  lastLoginAt: Timestamp;
  createdAt: Timestamp;
}
