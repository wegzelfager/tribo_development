import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OrganizerService } from '../services/organizer.service';
import { OrganizerProfile } from '../models/organizer.models';

const ICONS = {
  grid:      'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z',
  briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2 M2 13h20 M12 12v3',
  user:      'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
} as const;
type IconKey = keyof typeof ICONS;

interface NavTab {
  label: string;
  icon: IconKey;
  path: string;
}

@Component({
  selector: 'app-organizer-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <!-- Desktop Sidebar (1024px and up) -->
      <aside class="sidebar" aria-label="Organizer navigation">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <div class="brand-logo">T</div>
            <div class="brand-info">
              <span class="brand-title">Tribo</span>
              <span class="brand-eyebrow">ORGANIZER PORTAL</span>
            </div>
          </div>

          <nav class="sidebar-nav">
            @for (tab of tabs; track tab.path) {
              <a [routerLink]="tab.path"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: false }"
                 class="sidebar-link"
                 #rlaSidebar="routerLinkActive"
                 [attr.aria-current]="rlaSidebar.isActive ? 'page' : null">
                <svg class="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path [attr.d]="icons[tab.icon]" />
                </svg>
                <span class="link-label">{{ tab.label }}</span>
              </a>
            }
          </nav>
        </div>

        @if (profile(); as p) {
          <div class="sidebar-user">
            @if (p.avatar) {
              <img class="sidebar-avatar" [src]="p.avatar" [alt]="p.name" />
            } @else {
              <div class="sidebar-avatar fallback">{{ initials(p.name) }}</div>
            }
            <div class="sidebar-user-meta">
              <span class="sidebar-user-name">{{ p.name }}</span>
              <span class="sidebar-user-role">ORGANIZER</span>
            </div>
          </div>
        }
      </aside>

      <!-- Main Content Area -->
      <main class="content">
        <router-outlet />
      </main>

      <!-- Floating Bottom Nav (mobile & tablet < 1024px) -->
      <nav class="bottom-bar" aria-label="Mobile navigation">
        <div class="pill">
          @for (tab of tabs; track tab.path) {
            <a [routerLink]="tab.path"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: false }"
               class="tab"
               [attr.aria-label]="tab.label"
               #rlaBottom="routerLinkActive"
               [attr.aria-current]="rlaBottom.isActive ? 'page' : null">
              <svg class="i" viewBox="0 0 24 24" aria-hidden="true">
                <path [attr.d]="icons[tab.icon]" />
              </svg>
              @if (rlaBottom.isActive) {
                <span class="tab-label">{{ tab.label }}</span>
              }
            </a>
          }
        </div>
      </nav>
    </div>
  `,
  styleUrl: './organizer-shell.component.scss',
})
export class OrganizerShellComponent implements OnInit {
  private readonly organizerService = inject(OrganizerService);

  protected readonly icons = ICONS;
  protected readonly profile = signal<OrganizerProfile | null>(null);

  protected readonly tabs: NavTab[] = [
    { label: 'Dashboard', icon: 'grid',      path: '/organizer/dashboard' },
    { label: 'My Trips',  icon: 'briefcase', path: '/organizer/trips'     },
    { label: 'Profile',   icon: 'user',      path: '/organizer/profile'   },
  ];

  ngOnInit(): void {
    this.organizerService.getProfile().subscribe(p => this.profile.set(p));
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
