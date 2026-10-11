import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LeaveRequest, LeaveStatus, LeaveType } from '../models/leave.model';

export interface NewLeave {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Talks to the Node/Express API:
 *   GET   /api/leaves/mine   -> LeaveRequest[]  (the signed-in user's own requests)
 *   GET   /api/leaves        -> LeaveRequest[]  (manager only: everyone's requests)
 *   POST  /api/leaves        { type, startDate, endDate, reason } -> LeaveRequest
 *   PATCH /api/leaves/:id    { status, managerComment? }          -> LeaveRequest (manager only)
 *
 * The server decides who owns a request and how many days it covers, so the client
 * only sends what the user actually typed.
 */
@Injectable({ providedIn: 'root' })
export class LeaveService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/leaves`;

  getMine(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.base}/mine`);
  }

  getAll(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(this.base);
  }

  apply(req: NewLeave): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(this.base, req);
  }

  decide(id: string, status: Exclude<LeaveStatus, 'pending'>, managerComment?: string): Observable<LeaveRequest> {
    return this.http.patch<LeaveRequest>(`${this.base}/${id}`, { status, managerComment });
  }
}
