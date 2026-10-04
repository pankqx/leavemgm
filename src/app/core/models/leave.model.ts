export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type LeaveType = 'Sick' | 'Casual' | 'Earned' | 'Unpaid';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string; // ISO date
  managerComment?: string;
}

export type UserRole = 'employee' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  leaveBalance: number;
}
