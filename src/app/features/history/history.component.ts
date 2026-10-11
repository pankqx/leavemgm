import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveRequest, LeaveStatus } from '../../core/models/leave.model';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

type FilterOption = 'all' | LeaveStatus;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent {
  private auth = inject(AuthService);
  private leaveSvc = inject(LeaveService);

  user = this.auth.currentUser;
  all = signal<LeaveRequest[]>([]);
  filter = signal<FilterOption>('all');
  error = signal<string | null>(null);

  filtered = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.all() : this.all().filter((r) => r.status === f);
  });

  filters: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  constructor() {
    this.leaveSvc.getMine().subscribe({
      next: (list) => this.all.set(list),
      error: () => this.error.set('Could not load your requests. Please refresh.'),
    });
  }

  setFilter(f: FilterOption): void {
    this.filter.set(f);
  }
}
