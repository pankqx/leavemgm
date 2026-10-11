import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/http-error';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  // Same look as the sign-in page.
  styleUrl: '../login/login.component.css',
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = signal('');
  email = signal('');
  password = signal('');
  confirm = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  mismatch = computed(() => this.confirm().length > 0 && this.password() !== this.confirm());
  canSubmit = computed(
    () =>
      this.name().trim().length >= 2 &&
      this.email().includes('@') &&
      this.password().length >= 8 &&
      this.password() === this.confirm()
  );

  submit(): void {
    if (!this.canSubmit()) return;
    this.error.set(null);
    this.loading.set(true);
    this.auth.register(this.name(), this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Could not create your account.'));
      },
    });
  }
}
