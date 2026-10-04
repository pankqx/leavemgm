import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    try {
      this.auth.login(this.email(), this.password()).subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message ?? 'Could not sign in.');
        },
      });
    } catch (err: unknown) {
      this.loading.set(false);
      this.error.set(err instanceof Error ? err.message : 'Could not sign in.');
    }
  }

  fillDemo(role: 'employee' | 'manager'): void {
    this.email.set(role === 'employee' ? 'employee@leaflet.dev' : 'manager@leaflet.dev');
    this.password.set('demo');
  }
}
