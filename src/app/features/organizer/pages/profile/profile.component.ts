import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import { injectMyTripsQuery } from '../../../../core/queries/trip.queries';

const ICONS = {
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  mail:     'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
  calendar: 'M5 6.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7.5a1 1 0 011-1zM4 10.5h16M8 4v4M16 4v4',
  user:     'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  check:    'M20 6L9 17l-5-5',
  clock:    'M12 22a10 10 0 110-20 10 10 0 010 20zM12 6v6l4 2',
  alert:    'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  logout:   'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
} as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly myTripsQuery = injectMyTripsQuery();

  protected readonly icons = ICONS;
  protected readonly user = this.authService.currentUserSignal;
  protected readonly loading = signal(!this.authService.currentUserSignal()?.email);
  protected readonly refreshing = signal(false);
  protected readonly loggingOut = signal(false);

  protected readonly tripsHostedCount = computed(() => this.myTripsQuery.data()?.trips?.length ?? 0);
  protected readonly publishedTripsCount = computed(() => {
    const trips = this.myTripsQuery.data()?.trips ?? [];
    return trips.filter(t => t.approvalStatus === 'approved').length;
  });

  protected readonly idStatus = computed(() => this.user()?.idCard?.verificationStatus ?? 'pending');

  ngOnInit(): void {
    this.refreshProfile();
  }

  protected refreshProfile(): void {
    this.refreshing.set(true);
    this.authService.refreshCurrentUser().subscribe({
      next: () => {
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.refreshing.set(false);
      },
    });
  }

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
    });
  }

  protected initials(name: string): string {
    return (name || 'U')
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected maskNationalId(nationalId: string | null | undefined): string {
    if (!nationalId) return '—';
    if (nationalId.length !== 14) return nationalId;
    return `${nationalId.slice(0, 2)}••••••••••${nationalId.slice(-2)}`;
  }
}
