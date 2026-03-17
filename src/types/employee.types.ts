import type { Timestamp } from "firebase/firestore";

export type ExitType = "voluntary" | "involuntary" | "retirement" | "contract_end";
export type EmployeeStatus = "active" | "offboarding" | "alumni" | "left";

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  managerId: string;
  startDate: Timestamp;
  exitDate: Timestamp;
  lastWorkingDay: Timestamp;
  exitType: ExitType;
  exitReason: string;
  status: EmployeeStatus;
  alumniOptIn: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
