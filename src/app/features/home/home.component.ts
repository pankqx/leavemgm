import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveRequest } from '../../core/models/leave.model';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private auth = inject(AuthService);
  private leaveSvc = inject(LeaveService);
  private router = inject(Router);

  user = this.auth.currentUser;
  recent = signal<LeaveRequest[]>([]);

  pendingCount = computed(() => this.recent().filter((r) => r.status === 'pending').length);

  constructor() {
    const uid = this.user()?.id;
    if (uid) {
      this.leaveSvc.getForEmployee(uid).subscribe((list) => this.recent.set(list.slice(0, 3)));
    }
  }

  goApply(): void {
    this.router.navigate(['/apply']);
  }
}
