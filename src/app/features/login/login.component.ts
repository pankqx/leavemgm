import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  /** Demo shortcuts only exist in development builds, never in production. */
  showDemo = !environment.production;

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Could not sign in.'));
      },
    });
  }

  // These accounts are created by `npm run seed` in the backend folder.
  fillDemo(role: 'employee' | 'manager'): void {
    this.email.set(role === 'employee' ? 'employee@leaflet.dev' : 'manager@leaflet.dev');
    this.password.set('Leaflet@123');
  }
}
