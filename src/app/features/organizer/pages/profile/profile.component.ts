import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { OrganizerService } from '../../services/organizer.service';
import { OrganizerProfile } from '../../models/organizer.models';

const ICONS = {
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  star:     'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z',
  mail:     'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
  phone:    'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.18 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
  edit:     'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevron:  'M9 18l6-6-6-6',
  trendUp:  'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  check:    'M20 6L9 17l-5-5',
} as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly service = inject(OrganizerService);
  private readonly cdr     = inject(ChangeDetectorRef);

  protected readonly icons = ICONS;
  protected profile = signal<OrganizerProfile | null>(null);
  protected loading = signal(true);

  ngOnInit(): void {
    this.service.getProfile().subscribe(p => {
      this.profile.set(p);
      this.loading.set(false);
      this.cdr.markForCheck();
    });
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  
  protected sparklinePoints(pts: number[]): string {
    if (!pts || !pts.length) return '';
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const step = 100 / (pts.length - 1);
    return pts
      .map((val, idx) => {
        const x = idx * step;
        const y = 34 - ((val - min) / range) * 26;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
}
