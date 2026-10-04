import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { LeaveRequest, LeaveStatus } from '../models/leave.model';

/**
 * Mock leave service. Backed by an in-memory signal for now.
 *
 * Backend contract to match once the real API is ready:
 *   GET    /api/leaves?employeeId=          -> LeaveRequest[]
 *   GET    /api/leaves                      -> LeaveRequest[]  (manager, all requests)
 *   POST   /api/leaves                      -> LeaveRequest    (create)
 *   PATCH  /api/leaves/:id                  { status, managerComment } -> LeaveRequest
 *
 * Each method below already returns an Observable, so swapping the
 * mock body for `this.http.get<LeaveRequest[]>(...)` etc. later is a
 * one-line change per method — nothing in the components needs to move.
 */
@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly seed: LeaveRequest[] = [
    {
      id: 'lv-1001',
      employeeId: 'u-101',
      employeeName: 'Asha Rao',
      type: 'Casual',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      days: 1,
      reason: 'Family function',
      status: 'approved',
      appliedOn: '2026-09-01',
      managerComment: 'Enjoy the day off.',
    },
    {
      id: 'lv-1002',
      employeeId: 'u-101',
      employeeName: 'Asha Rao',
      type: 'Sick',
      startDate: '2026-08-20',
      endDate: '2026-08-21',
      days: 2,
      reason: 'Fever, resting at home',
      status: 'approved',
      appliedOn: '2026-08-19',
    },
    {
      id: 'lv-1003',
      employeeId: 'u-101',
      employeeName: 'Asha Rao',
      type: 'Earned',
      startDate: '2026-09-22',
      endDate: '2026-09-24',
      days: 3,
      reason: 'Travelling for a wedding',
      status: 'pending',
      appliedOn: '2026-09-09',
    },
    {
      id: 'lv-0987',
      employeeId: 'u-101',
      employeeName: 'Asha Rao',
      type: 'Unpaid',
      startDate: '2026-07-02',
      endDate: '2026-07-02',
      days: 1,
      reason: 'Personal work',
      status: 'rejected',
      appliedOn: '2026-06-28',
      managerComment: 'Team was short-staffed that day — please replan.',
    },
  ];

  private readonly _requests = signal<LeaveRequest[]>([...this.seed]);
  readonly requests = this._requests.asReadonly();

  getForEmployee(employeeId: string): Observable<LeaveRequest[]> {
    return of(this._requests().filter((r) => r.employeeId === employeeId)).pipe(delay(250));
  }

  getAll(): Observable<LeaveRequest[]> {
    return of([...this._requests()]).pipe(delay(250));
  }

  apply(req: Omit<LeaveRequest, 'id' | 'status' | 'appliedOn'>): Observable<LeaveRequest> {
    const created: LeaveRequest = {
      ...req,
      id: 'lv-' + Math.floor(1000 + Math.random() * 9000),
      status: 'pending',
      appliedOn: new Date().toISOString().slice(0, 10),
    };
    return of(created).pipe(
      delay(400),
      tap(() => this._requests.update((list) => [created, ...list]))
    );
  }

  decide(id: string, status: LeaveStatus, managerComment?: string): Observable<LeaveRequest> {
    this._requests.update((list) =>
      list.map((r) => (r.id === id ? { ...r, status, managerComment } : r))
    );
    const updated = this._requests().find((r) => r.id === id)!;
    return of(updated).pipe(delay(300));
  }
}
