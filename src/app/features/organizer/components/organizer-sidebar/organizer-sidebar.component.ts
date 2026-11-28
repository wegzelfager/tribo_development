import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import gsap from 'gsap';
import { filter } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';

const SIDEBAR_COLLAPSED_KEY = 'tribo_organizer_sidebar_collapsed';

const ICONS = {
  grid:      'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
  user:      'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  chevron:   'M15 18l-6-6 6-6',
  logout:    'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  close:     'M18 6L6 18M6 6l12 12',
} as const;

type IconKey = keyof typeof ICONS;

export interface SidebarNavTab {
  labelKey: string;
  icon: IconKey;
  path: string;
}

@Component({
  selector: 'app-organizer-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './organizer-sidebar.component.html',
  styleUrl: './organizer-sidebar.component.scss',
})
export class OrganizerSidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly i18n        = inject(I18nService);
  private readonly router      = inject(Router);
  private readonly platformId  = inject(PLATFORM_ID);
  private readonly hostRef     = inject(ElementRef<HTMLElement>);
  private readonly ngZone      = inject(NgZone);
  private readonly destroyRef  = inject(DestroyRef);

  protected readonly icons    = ICONS;
  protected readonly user     = this.authService.currentUserSignal;
  private readonly lang       = toSignal(this.i18n.lang$, { initialValue: this.i18n.currentLang });
  protected readonly isArabic = computed(() => this.lang() === 'ar');

  protected readonly isMobile       = signal<boolean>(this.readIsMobile());
  protected readonly collapsed      = signal<boolean>(this.readInitialCollapsedState());
  protected readonly effectiveMini  = computed(() => !this.isMobile() && this.collapsed());
  readonly drawerOpen               = signal<boolean>(false);

  protected readonly tabs: SidebarNavTab[] = [
    { labelKey: 'organizer.shell.nav_dashboard', icon: 'grid',      path: '/organizer/dashboard' },
    { labelKey: 'organizer.shell.nav_my_trips',  icon: 'briefcase', path: '/organizer/trips'     },
    { labelKey: 'organizer.shell.nav_profile',   icon: 'user',      path: '/organizer/profile'   },
  ];

  private gsapCtx?: gsap.Context;
  private reducedMotion = false;
  private readonly rootAbort = new AbortController();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.rootAbort.abort();
      this.gsapCtx?.revert();
    });

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isMobile()) {
          this.closeDrawer();
        }
        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => this.moveInd(!this.reducedMotion));
        });
      });

    afterNextRender(() => {
      this.bindResponsiveMediaQueries();
      this.bindEscapeKey();
      this.ngZone.runOutsideAngular(() => {
        this.initGsap();
      });
    });
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.moveInd(false);
        const closeBtn = this.hostRef.nativeElement.querySelector('.drawer-close') as HTMLElement | null;
        closeBtn?.focus();
      });
    });
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected onNavClick(): void {
    if (this.isMobile()) {
      this.closeDrawer();
    }
  }

  protected toggleLang(): void {
    this.i18n.toggle();
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.moveInd(false);
        if (!this.reducedMotion && !this.isMobile()) {
          this.playIntro();
        }
      });
    });
  }

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    this.saveCollapsedState(next);
    this.hideTooltip();

    this.ngZone.runOutsideAngular(() => {
      this.applyMiniState(this.effectiveMini(), !this.reducedMotion);
    });
  }

  protected logout(): void {
    this.closeDrawer();
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private initGsap(): void {
    const host = this.hostRef.nativeElement;
    this.gsapCtx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduced: '(prefers-reduced-motion: reduce)',
        },
        context => {
          const { reduced } = context.conditions as { motion: boolean; reduced: boolean };
          this.reducedMotion = reduced;

          if (this.isMobile()) {
            this.clearInlineLayoutProps();
          } else {
            this.applyMiniState(this.effectiveMini(), false);
          }
          this.moveInd(false);

          const scopeAbort = new AbortController();
          if (reduced) {
            this.bindTooltipOnlyInteractions(scopeAbort.signal);
          } else {
            this.bindSpotlight(scopeAbort.signal);
            this.bindNavItemInteractions(scopeAbort.signal);
            if (!this.isMobile()) {
              this.playIntro();
            }
          }

          return () => scopeAbort.abort();
        },
      );
    }, host);
  }

  private clearInlineLayoutProps(): void {
    const sb = this.hostRef.nativeElement.querySelector('.sb') as HTMLElement | null;
    if (!sb) return;

    this.gsapCtx?.add(() => {
      gsap.set(sb, { clearProps: 'width,x,opacity,filter,transform' });
      gsap.set('.tx, .nm, .meta, .out, .lang, .tog .ic svg', {
        clearProps: 'opacity,transform',
      });
    });
  }

  private applyMiniState(mini: boolean, animate: boolean): void {
    if (this.isMobile()) return;
    const sb = this.hostRef.nativeElement.querySelector('.sb') as HTMLElement | null;
    if (!sb) return;

    const d = animate && !this.reducedMotion ? 1 : 0;
    this.gsapCtx?.add(() => {
      gsap.to(sb, {
        width: mini ? 84 : 272,
        duration: 0.85 * d,
        ease: 'expo.inOut',
        overwrite: 'auto',
      });
      gsap.to('.tx, .nm, .meta, .out, .lang', {
        opacity: mini ? 0 : 1,
        duration: 0.3 * d,
        overwrite: 'auto',
      });
      gsap.to('.tog .ic svg', {
        rotate: mini ? 180 : 0,
        duration: 0.6 * d,
        ease: 'back.out(2)',
        overwrite: 'auto',
      });
    });
  }

  private playIntro(): void {
    if (this.reducedMotion || this.isMobile()) return;
    const host = this.hostRef.nativeElement;
    const sb = host.querySelector('.sb') as HTMLElement | null;
    if (!sb) return;

    const dirSign = this.isArabic() ? 1 : -1;
    const x = 36 * dirSign;
    const isMini = this.effectiveMini();

    this.gsapCtx?.add(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from(sb, {
        x: x * 2,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 1.2,
        clearProps: 'filter,transform',
      }).from(
        '.mark',
        {
          scale: 0,
          rotate: 140 * dirSign,
          duration: 1,
          ease: 'back.out(2)',
          clearProps: 'transform',
        },
        0.2,
      );

      if (!isMini) {
        tl.from(
          '.nm > *, .lang',
          {
            y: 14,
            opacity: 0,
            stagger: 0.08,
            duration: 0.7,
            clearProps: 'transform,opacity',
          },
          0.4,
        );
      }

      tl.from(
        '.nav .it',
        {
          x,
          opacity: 0,
          stagger: 0.07,
          duration: 0.9,
          clearProps: 'transform,opacity',
        },
        0.5,
      )
        .from(
          '.ind',
          {
            scaleX: 0,
            opacity: 0,
            duration: 0.9,
            clearProps: 'scaleX',
          },
          0.9,
        )
        .from(
          '.prof',
          {
            y: 26,
            opacity: 0,
            duration: 0.9,
            clearProps: 'transform,opacity',
          },
          0.95,
        );
    });
  }

  private moveInd(animate: boolean): void {
    const host = this.hostRef.nativeElement;
    const nav = host.querySelector('.nav') as HTMLElement | null;
    const ind = host.querySelector('.ind') as HTMLElement | null;
    const activeEl = nav?.querySelector('.it.on') as HTMLElement | null;
    if (!nav || !ind || !activeEl) return;

    const y = activeEl.offsetTop;
    const height = activeEl.offsetHeight;

    this.gsapCtx?.add(() => {
      if (!animate || this.reducedMotion) {
        gsap.set(ind, { y, height, opacity: 1 });
        return;
      }

      gsap.to(ind, {
        y,
        height,
        opacity: 1,
        duration: 0.75,
        ease: 'expo.out',
        overwrite: 'auto',
      });
      gsap.fromTo(
        ind,
        { scaleX: 0.94 },
        {
          scaleX: 1,
          duration: 0.9,
          ease: 'elastic.out(1, 0.5)',
          overwrite: 'auto',
        },
      );
    });
  }

  private bindSpotlight(signal: AbortSignal): void {
    const host = this.hostRef.nativeElement;
    const sb = host.querySelector('.sb') as HTMLElement | null;
    const glow = host.querySelector('.glow') as HTMLElement | null;
    if (!sb || !glow) return;

    const gx = gsap.quickTo(glow, 'x', { duration: 0.5, ease: 'power3' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.5, ease: 'power3' });

    sb.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (this.isMobile() || this.reducedMotion) return;
        const r = sb.getBoundingClientRect();
        gx(e.clientX - r.left - 120);
        gy(e.clientY - r.top - 120);
      },
      { signal },
    );

    sb.addEventListener(
      'mouseenter',
      () => {
        if (this.isMobile() || this.reducedMotion) return;
        this.gsapCtx?.add(() => {
          gsap.to(glow, { opacity: 1, duration: 0.4, overwrite: 'auto' });
        });
      },
      { signal },
    );

    sb.addEventListener(
      'mouseleave',
      () => {
        this.gsapCtx?.add(() => {
          gsap.to(glow, { opacity: 0, duration: 0.4, overwrite: 'auto' });
        });
      },
      { signal },
    );
  }

  private bindNavItemInteractions(signal: AbortSignal): void {
    const host = this.hostRef.nativeElement;
    const navItems = Array.from(host.querySelectorAll('.grp .it')) as HTMLElement[];
    const togBtn = host.querySelector('.tog') as HTMLElement | null;

    navItems.forEach(item => {
      const ic = item.querySelector('.ic') as HTMLElement | null;
      const tx = item.querySelector('.tx') as HTMLElement | null;
      if (!ic || !tx) return;

      item.addEventListener(
        'mouseenter',
        () => {
          const rtl = this.isArabic();
          this.showTooltip(item);
          this.gsapCtx?.add(() => {
            gsap.to(ic, {
              scale: 1.2,
              rotate: rtl ? 8 : -8,
              duration: 0.45,
              ease: 'back.out(3)',
              overwrite: 'auto',
            });
            if (!this.effectiveMini()) {
              gsap.to(tx, {
                x: rtl ? -5 : 5,
                duration: 0.35,
                ease: 'power3.out',
                overwrite: 'auto',
              });
            }
          });
        },
        { signal },
      );

      item.addEventListener(
        'mouseleave',
        () => {
          this.hideTooltip();
          this.gsapCtx?.add(() => {
            gsap.to(ic, {
              scale: 1,
              rotate: 0,
              duration: 0.4,
              ease: 'power3.out',
              overwrite: 'auto',
            });
            gsap.to(tx, {
              x: 0,
              duration: 0.35,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          });
        },
        { signal },
      );

      item.addEventListener('focusin', () => this.showTooltip(item), { signal });
      item.addEventListener('focusout', () => this.hideTooltip(), { signal });

      item.addEventListener(
        'click',
        () => {
          const rtl = this.isArabic();
          this.hideTooltip();
          this.gsapCtx?.add(() => {
            gsap.fromTo(
              ic,
              { scale: 0.55, rotate: rtl ? 35 : -35 },
              {
                scale: 1,
                rotate: 0,
                duration: 0.9,
                ease: 'elastic.out(1.2, 0.45)',
                overwrite: 'auto',
              },
            );
          });
        },
        { signal },
      );
    });

    if (togBtn) {
      togBtn.addEventListener('mouseenter', () => this.showTooltip(togBtn), { signal });
      togBtn.addEventListener('mouseleave', () => this.hideTooltip(), { signal });
      togBtn.addEventListener('focusin', () => this.showTooltip(togBtn), { signal });
      togBtn.addEventListener('focusout', () => this.hideTooltip(), { signal });
    }
  }

  private bindTooltipOnlyInteractions(signal: AbortSignal): void {
    const host = this.hostRef.nativeElement;
    const targets = Array.from(host.querySelectorAll('.grp .it, .tog')) as HTMLElement[];

    targets.forEach(item => {
      item.addEventListener('mouseenter', () => this.showTooltip(item), { signal });
      item.addEventListener('mouseleave', () => this.hideTooltip(), { signal });
      item.addEventListener('focusin', () => this.showTooltip(item), { signal });
      item.addEventListener('focusout', () => this.hideTooltip(), { signal });
      item.addEventListener('click', () => this.hideTooltip(), { signal });
    });
  }

  private bindResponsiveMediaQueries(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const mqlMobile = window.matchMedia('(max-width: 767px)');
    const mqlTablet = window.matchMedia('(max-width: 1023px)');

    mqlMobile.addEventListener(
      'change',
      e => {
        this.isMobile.set(e.matches);
        if (!e.matches) {
          this.drawerOpen.set(false);
        }
        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => {
            if (e.matches) {
              this.clearInlineLayoutProps();
            } else {
              this.applyMiniState(this.effectiveMini(), false);
            }
            this.moveInd(false);
          });
        });
      },
      { signal: this.rootAbort.signal },
    );

    mqlTablet.addEventListener(
      'change',
      e => {
        if (e.matches) {
          this.collapsed.set(true);
        } else {
          this.collapsed.set(this.readCollapsedState());
        }
        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => {
            if (!this.isMobile()) {
              this.applyMiniState(this.effectiveMini(), !this.reducedMotion);
            }
          });
        });
      },
      { signal: this.rootAbort.signal },
    );
  }

  private bindEscapeKey(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.drawerOpen()) {
          this.closeDrawer();
        }
      },
      { signal: this.rootAbort.signal },
    );
  }

  private showTooltip(target: HTMLElement): void {
    if (!this.effectiveMini()) return;
    const tip = this.hostRef.nativeElement.querySelector('.sb-tooltip') as HTMLElement | null;
    const label = target.dataset['tip'] || target.getAttribute('aria-label');
    if (!tip || !label) return;

    const hostRect = this.hostRef.nativeElement.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const centerY = rect.top - hostRect.top + rect.height / 2;

    tip.textContent = label;
    tip.style.top = `${centerY}px`;
    tip.classList.add('visible');
  }

  private hideTooltip(): void {
    const tip = this.hostRef.nativeElement.querySelector('.sb-tooltip') as HTMLElement | null;
    tip?.classList.remove('visible');
  }

  private readIsMobile(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return window.innerWidth < 768;
  }

  private readInitialCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (window.innerWidth < 1024 && window.innerWidth >= 768) {
      return true;
    }
    return this.readCollapsedState();
  }

  private readCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private saveCollapsedState(value: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
    } catch {
      // Ignore storage failures in restricted modes
    }
  }
}
