import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../../core/services/i18n.service';
import { AuthService } from '../../../core/services/auth.service';
import { IdentityVerificationBannerComponent } from '../../../shared/components/identity-verification-banner/identity-verification-banner.component';
import { OrganizerSidebarComponent } from '../components/organizer-sidebar/organizer-sidebar.component';

@Component({
  selector: 'app-organizer-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    TranslatePipe,
    IdentityVerificationBannerComponent,
    OrganizerSidebarComponent,
  ],
  template: `
    <div class="shell">
      <!-- Mobile Topbar (< 768px) -->
      <header class="mobile-topbar">
        <button type="button"
                class="mobile-menu-btn"
                (click)="sidebar.openDrawer()"
                [attr.aria-expanded]="sidebar.drawerOpen()"
                aria-controls="organizer-sidebar-aside"
                [attr.aria-label]="'nav.open_menu' | translate">
          <svg class="i" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <div class="mobile-brand">
          <span class="mobile-mark" aria-hidden="true">T</span>
          <span class="mobile-title">{{ 'organizer.shell.brand_title' | translate }}</span>
        </div>

        <button type="button"
                class="mobile-lang-btn"
                (click)="toggleLang()"
                [title]="'organizer.shell.lang_switch_label' | translate"
                [attr.aria-label]="'organizer.shell.lang_switch_label' | translate">
          {{ isArabic() ? 'EN' : 'عربي' }}
        </button>
      </header>

      <app-organizer-sidebar #sidebar />

      <!-- Main Content Area -->
      <main class="content">
        <div class="shell-banner-wrap">
          <app-identity-verification-banner />
        </div>
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './organizer-shell.component.scss',
})
export class OrganizerShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly i18n        = inject(I18nService);

  private readonly lang       = toSignal(this.i18n.lang$, { initialValue: this.i18n.currentLang });
  protected readonly isArabic = computed(() => this.lang() === 'ar');

  ngOnInit(): void {
    this.authService.refreshCurrentUser().subscribe();
  }

  protected toggleLang(): void {
    this.i18n.toggle();
  }
}
