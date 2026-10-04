import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveType } from '../../core/models/leave.model';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-apply-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './apply-leave.component.html',
  styleUrl: './apply-leave.component.css',
})
export class ApplyLeaveComponent {
  private auth = inject(AuthService);
  private leaveSvc = inject(LeaveService);
  private router = inject(Router);

  user = this.auth.currentUser;

  leaveTypes: LeaveType[] = ['Casual', 'Sick', 'Earned', 'Unpaid'];

  type = signal<LeaveType>('Casual');
  startDate = signal('');
  endDate = signal('');
  reason = signal('');
  submitting = signal(false);
  submitted = signal(false);
  error = signal<string | null>(null);

  days = computed(() => {
    if (!this.startDate() || !this.endDate()) return 0;
    const start = new Date(this.startDate());
    const end = new Date(this.endDate());
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  });

  canSubmit = computed(
    () => !!this.startDate() && !!this.endDate() && this.days() > 0 && this.reason().trim().length > 4
  );

  submit(): void {
    this.error.set(null);
    if (!this.canSubmit() || !this.user()) return;

    this.submitting.set(true);
    this.leaveSvc
      .apply({
        employeeId: this.user()!.id,
        employeeName: this.user()!.name,
        type: this.type(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        days: this.days(),
        reason: this.reason().trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('Something went wrong submitting your request. Please try again.');
        },
      });
  }

  goHistory(): void {
    this.router.navigate(['/history']);
  }

  applyAnother(): void {
    this.submitted.set(false);
    this.startDate.set('');
    this.endDate.set('');
    this.reason.set('');
    this.type.set('Casual');
  }
}
