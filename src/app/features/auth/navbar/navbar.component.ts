import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, HostListener,
  PLATFORM_ID, Inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavStop {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── Config ────────────────────────────────────────────────────────────────
  // The four middle stops config. Non-navigating links for now.
  // TODO: point to real routes when they exist
  readonly stops: NavStop[] = [
    { label: 'Explore', path: '/explore' },
    { label: 'Trips', path: '/trips' },
    { label: 'Organizers', path: '/organizers' },
    { label: 'How it works', path: '/how-it-works' },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  isOpen = false;
  hover = -1;

  // ── ViewChilds ────────────────────────────────────────────────────────────
  @ViewChild('navEl')    navEl?:    ElementRef<HTMLElement>;
  @ViewChild('burgerEl') burgerEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('routeEl')  routeEl?:  ElementRef<HTMLElement>;

  // ── Private ───────────────────────────────────────────────────────────────
  private mobileQuery?: MediaQueryList;
  private mobileQueryListener?: (e: MediaQueryListEvent) => void;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.mobileQuery = window.matchMedia('(max-width: 860px)');
      this.mobileQueryListener = () => {
        this.setOpen(false);
        this.place();
      };
      if (this.mobileQuery.addEventListener) {
        this.mobileQuery.addEventListener('change', this.mobileQueryListener);
      } else {
        // Fallback for older browsers
        (this.mobileQuery as any).addListener(this.mobileQueryListener);
      }
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.place();
      requestAnimationFrame(() => this.place());
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.place());
      }
    }
  }

  ngOnDestroy(): void {
    if (this.mobileQuery && this.mobileQueryListener) {
      if (this.mobileQuery.removeEventListener) {
        this.mobileQuery.removeEventListener('change', this.mobileQueryListener);
      } else {
        (this.mobileQuery as any).removeListener(this.mobileQueryListener);
      }
    }
  }

  // ── Position & measurement ────────────────────────────────────────────────
  private centre(el: HTMLElement): { x: number; y: number } {
    return {
      x: el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetTop + el.offsetHeight / 2
    };
  }

  place(): void {
    if (!isPlatformBrowser(this.platformId) || !this.routeEl?.nativeElement) {
      return;
    }
    const route = this.routeEl.nativeElement;
    const stops = Array.from(route.querySelectorAll<HTMLElement>('.stop'));
    if (stops.length === 0) {
      return;
    }

    // Active stop by aria-current, if any (defaults to 0 if none match)
    let active = 0;
    let hasActiveAria = false;
    stops.forEach((s, i) => {
      if (s.getAttribute('aria-current') === 'page') {
        active = i;
        hasActiveAria = true;
      }
    });

    const cur = this.hover >= 0 ? this.hover : active;
    const c = this.centre(stops[cur] || stops[0]);
    const f = this.centre(stops[0]);
    const l = this.centre(stops[stops.length - 1]);

    const set = (k: string, v: number) => route.style.setProperty(k, `${v}px`);
    set('--cx', c.x);
    set('--cy', c.y);
    set('--fx', f.x);
    set('--fy', f.y);
    set('--lx', l.x);
    set('--ly', l.y);

    stops.forEach((s, i) => {
      s.classList.toggle('lit', i <= cur);
      const isHot = (this.hover >= 0) && (i === this.hover) && !(hasActiveAria && i === active);
      s.classList.toggle('hot', isHot);
    });
  }

  // ── Menu actions ──────────────────────────────────────────────────────────
  setOpen(open: boolean, focusBurger = false): void {
    this.isOpen = open;
    if (open) {
      requestAnimationFrame(() => this.place());
    }
    if (!open && focusBurger && this.burgerEl?.nativeElement) {
      this.burgerEl.nativeElement.focus();
    }
  }

  toggleMenu(): void {
    this.setOpen(!this.isOpen);
  }

  closeMenu(focusBurger = false): void {
    if (this.isOpen) {
      this.setOpen(false, focusBurger);
    }
  }

  // ── Route stops interaction ───────────────────────────────────────────────
  onStopPointerEnter(event: PointerEvent, index: number): void {
    if (event.pointerType === 'mouse') {
      this.hover = index;
      this.place();
    }
  }

  onStopPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this.hover = -1;
      this.place();
    }
  }

  onStopFocus(event: FocusEvent, index: number): void {
    const target = event.target as HTMLElement;
    if (target?.matches(':focus-visible')) {
      this.hover = index;
      this.place();
    } else {
      requestAnimationFrame(() => {
        if (document.activeElement === target && target?.matches(':focus-visible')) {
          this.hover = index;
          this.place();
        }
      });
    }
  }

  onStopBlur(): void {
    this.hover = -1;
    this.place();
  }

  onStopClick(event: MouseEvent, index: number): void {
    event.preventDefault();
    // TODO: point to real routes when they exist
    if (this.isOpen) {
      this.setOpen(false, true);
    }
  }

  // ── Host Listeners ────────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.setOpen(false, true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && this.navEl?.nativeElement && !this.navEl.nativeElement.contains(event.target as Node)) {
      this.setOpen(false);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.place();
  }
}
