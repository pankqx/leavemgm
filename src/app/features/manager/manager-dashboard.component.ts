import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveRequest } from '../../core/models/leave.model';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './manager-dashboard.component.html',
  styleUrl: './manager-dashboard.component.css',
})
export class ManagerDashboardComponent {
  private leaveSvc = inject(LeaveService);

  all = signal<LeaveRequest[]>([]);
  activeId = signal<string | null>(null);
  comment = signal('');
  busyId = signal<string | null>(null);

  pending = computed(() => this.all().filter((r) => r.status === 'pending'));
  decided = computed(() => this.all().filter((r) => r.status !== 'pending'));

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.leaveSvc.getAll().subscribe((list) => this.all.set(list));
  }

  openComment(id: string): void {
    this.activeId.set(this.activeId() === id ? null : id);
    this.comment.set('');
  }

  decide(req: LeaveRequest, status: 'approved' | 'rejected'): void {
    this.busyId.set(req.id);
    this.leaveSvc.decide(req.id, status, this.comment().trim() || undefined).subscribe(() => {
      this.busyId.set(null);
      this.activeId.set(null);
      this.refresh();
    });
  }
}
