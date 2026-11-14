import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="placeholder-page">
      <div class="placeholder-box">
        <h2>Dashboard</h2>
        <p>Dashboard analytics and expedition performance metrics are coming soon.</p>
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
    h2 {
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--o-ink);
      margin-bottom: 8px;
    }
    p {
      color: var(--o-muted);
      font-size: 0.9375rem;
    }
  `]
})
export class DashboardComponent {}
