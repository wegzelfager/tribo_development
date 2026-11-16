import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  sidebarOpen = signal(true);
  user = this.authService.getCurrentUser();

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
    });
  }
}
