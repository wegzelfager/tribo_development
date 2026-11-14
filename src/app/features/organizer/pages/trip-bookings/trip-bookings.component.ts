import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-trip-bookings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="placeholder-page">
      <div class="placeholder-box">
        <a routerLink="/organizer/trips" class="back-link">← Back to My Trips</a>
        <h2>Manage Bookings</h2>
        <p class="meta">Trip ID: <code>{{ tripId }}</code></p>
        <p class="desc">Bookings management details and attendee roster will be available here.</p>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-page {
      padding: 48px 16px;
      display: flex;
      justify-content: center;
    }
    .placeholder-box {
      max-width: 600px;
      width: 100%;
      background: var(--o-card);
      border: 1px solid var(--o-border);
      border-radius: var(--o-radius);
      padding: 40px 28px;
      text-align: center;
      box-shadow: var(--o-shadow);
    }
    .back-link {
      display: inline-block;
      margin-bottom: 16px;
      color: var(--o-accent);
      font-weight: 600;
      font-size: 0.875rem;
      text-decoration: none;
      transition: opacity 0.15s;
      &:hover { opacity: 0.8; }
    }
    h2 {
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--o-ink);
      margin-bottom: 8px;
    }
    .meta {
      font-size: 0.8125rem;
      color: var(--o-muted);
      margin-bottom: 8px;
    }
    code {
      background: var(--o-chip);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--o-ink);
    }
    .desc {
      color: var(--o-muted);
      font-size: 0.9375rem;
    }
  `]
})
export class TripBookingsComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
}
