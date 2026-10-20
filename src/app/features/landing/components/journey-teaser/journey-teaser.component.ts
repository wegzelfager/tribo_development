import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
  PLATFORM_ID, Inject, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-journey-teaser',
  standalone: true,
  templateUrl: './journey-teaser.component.html',
  styleUrl:    './journey-teaser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyTeaserComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sectionEl')   private sectionEl!:   ElementRef<HTMLElement>;
  @ViewChild('innerEl')     private innerEl!:     ElementRef<HTMLElement>;
  @ViewChild('headlineEl')  private headlineEl!:  ElementRef<HTMLElement>;
  @ViewChild('glowWrapEl')  private glowWrapEl!:  ElementRef<HTMLElement>;
  @ViewChild('line0')       private line0!:       ElementRef<HTMLElement>;
  @ViewChild('line1')       private line1!:       ElementRef<HTMLElement>;
  @ViewChild('line2')       private line2!:       ElementRef<HTMLElement>;
  @ViewChild('line3')       private line3!:       ElementRef<HTMLElement>;
  @ViewChild('scrollCueEl') private scrollCueEl!: ElementRef<HTMLElement>;

  private resizeObs?: ResizeObserver;
  private intersectObs?: IntersectionObserver;
  private rafId?: number;
  private fallbackTimer?: any;
  private entranceFinishTimer?: any;
  private resizeTimer?: any;
  private prefersReducedMotion = false;
  private isOffscreen = false;

  // Cached layout metrics to avoid DOM reads in animation loop
  private cachedSectionTop = 0;
  private cachedSectionHeight = 0;

  // Pointer parallax state (desktop fine pointer only)
  private targetGlowX = 0;
  private targetGlowY = 0;
  private currentGlowX = 0;
  private currentGlowY = 0;

  // RAF throttling state
  private isTicking = false;

  // Listeners cleanup
  private removeListeners?: () => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => {
      this.init();
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    this.intersectObs?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.entranceFinishTimer) clearTimeout(this.entranceFinishTimer);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.removeListeners?.();
  }

  private init(): void {
    const section = this.sectionEl?.nativeElement;
    if (!section) return;

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Initial fit calculation
    this.fit();

    // 2. Debounced resize observer & window resize
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.debouncedFit());
      this.resizeObs.observe(section);
    }

    const onWindowResize = () => this.debouncedFit();
    window.addEventListener('resize', onWindowResize, { passive: true });

    // 3. Pause off-screen via IntersectionObserver
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectObs = new IntersectionObserver(
        (entries) => {
          const isVisible = entries[0]?.isIntersecting ?? true;
          this.isOffscreen = !isVisible;
          if (this.isOffscreen) {
            section.classList.add('is-offscreen');
            if (this.rafId) {
              cancelAnimationFrame(this.rafId);
              this.rafId = undefined;
              this.isTicking = false;
            }
          } else {
            section.classList.remove('is-offscreen');
            this.requestFrame();
          }
        },
        { threshold: 0 }
      );
      this.intersectObs.observe(section);
    }

    // 4. Preload 3D model when idle
    this.preload3D();

    // 5. Entrance sequence
    this.initEntrance();

    // 6. Interactive motion (skip if reduced motion)
    if (!this.prefersReducedMotion) {
      this.initMotion();
    }

    this.removeListeners = () => {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('pointermove', this.onPointerMove);
    };
  }

  private debouncedFit(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.fit();
    }, 120);
  }

  private initEntrance(): void {
    const section = this.sectionEl?.nativeElement;
    if (!section) return;

    if (this.prefersReducedMotion) {
      // Keep everything static and visible
      return;
    }

    // Set pending class to hide elements before entrance
    section.classList.add('is-pending');

    let started = false;
    const triggerEntrance = () => {
      if (started) return;
      started = true;
      if (this.fallbackTimer) {
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = undefined;
      }
      this.fit();
      section.classList.remove('is-pending');
      section.classList.add('is-animating');

      // Remove will-change hints after entrance finishes to free GPU memory
      this.entranceFinishTimer = setTimeout(() => {
        section.classList.remove('is-animating');
      }, 2800);
    };

    // Fall back to starting after 1.1s if fonts are slow
    this.fallbackTimer = setTimeout(triggerEntrance, 1100);

    // Play once on load, after fonts are loaded
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.race([
        document.fonts.load('800 100px Syne'),
        document.fonts.ready,
      ])
        .then(() => {
          requestAnimationFrame(() => {
            this.fit();
            triggerEntrance();
          });
        })
        .catch(() => {
          triggerEntrance();
        });
    }
  }

  private initMotion(): void {
    // Passive scroll listener
    window.addEventListener('scroll', this.onScroll, { passive: true });

    // Desktop pointer parallax only ((hover: hover) and (pointer: fine))
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.prefersReducedMotion || this.isOffscreen) return;
    if (e.pointerType === 'touch') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    if (!W || !H) return;

    // Shift opposite to cursor: about 46px horizontally and 30px vertically max
    const normX = (e.clientX / W - 0.5) * 2; // -1 to 1
    const normY = (e.clientY / H - 0.5) * 2; // -1 to 1
    this.targetGlowX = -normX * 46;
    this.targetGlowY = -normY * 30;

    this.requestFrame();
  };

  private onScroll = (): void => {
    if (this.isOffscreen) return;
    this.requestFrame();
  };

  private requestFrame(): void {
    if (this.isTicking || this.isOffscreen) return;
    this.isTicking = true;
    this.rafId = requestAnimationFrame(this.renderLoop);
  }

  private renderLoop = (): void => {
    this.isTicking = false;
    if (this.isOffscreen) return;

    // 1. Scroll drift update (single transform/opacity write on content wrapper)
    this.updateScrollDrift();

    // 2. Pointer parallax update with lerp .07
    const needsMoreParallax = this.updatePointerParallax();

    if (needsMoreParallax) {
      this.requestFrame();
    }
  };

  private updatePointerParallax(): boolean {
    const glowWrap = this.glowWrapEl?.nativeElement;
    if (!glowWrap) return false;

    const dx = this.targetGlowX - this.currentGlowX;
    const dy = this.targetGlowY - this.currentGlowY;

    if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
      // Smoothed with lerp .07
      this.currentGlowX += dx * 0.07;
      this.currentGlowY += dy * 0.07;
      glowWrap.style.transform = `translate3d(${this.currentGlowX.toFixed(2)}px, ${this.currentGlowY.toFixed(2)}px, 0)`;
      return true;
    }
    return false;
  }

  private updateScrollDrift(): void {
    const inner = this.innerEl?.nativeElement;
    if (!inner) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrolled = Math.max(0, scrollY - this.cachedSectionTop);
    const H = this.cachedSectionHeight || window.innerHeight;
    const progress = Math.min(1, scrolled / H);

    if (scrolled > 0 && progress < 1.3) {
      // Content moves down at 0.32x scroll speed (slower than the page)
      const driftY = scrolled * 0.32;
      // and fades out (opacity = 1 - progress * 1.3)
      const opacity = Math.max(0, 1 - progress * 1.3);

      // Writes ONE transform/opacity pair directly on content wrapper
      inner.style.transform = `translate3d(0, ${driftY.toFixed(2)}px, 0)`;
      inner.style.opacity = `${opacity.toFixed(3)}`;

      // Desktop only (>= 768px): subtle line speed separation. Skipped completely on mobile!
      if (window.innerWidth >= 768) {
        const speeds = [0, 0.04, 0.08, 0.12];
        const lines = [this.line0, this.line1, this.line2, this.line3];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.nativeElement;
          if (line) {
            line.style.transform = `translate3d(0, ${(scrolled * speeds[i]).toFixed(2)}px, 0)`;
          }
        }
      }
    } else if (scrolled === 0) {
      inner.style.transform = '';
      inner.style.opacity = '';
      if (window.innerWidth >= 768) {
        const lines = [this.line0, this.line1, this.line2, this.line3];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.nativeElement;
          if (line) line.style.transform = '';
        }
      }
    }
  }

  private fit(): void {
    const section = this.sectionEl?.nativeElement;
    const inner = this.innerEl?.nativeElement;
    const h1 = this.headlineEl?.nativeElement;
    if (!section || !inner || !h1) return;

    const W = section.clientWidth;
    const H = section.clientHeight;
    if (!W || !H) return;

    // Cache metrics so scroll drift loop NEVER reads DOM layout
    this.cachedSectionTop = section.offsetTop;
    this.cachedSectionHeight = H;

    const computedInner = window.getComputedStyle(inner);
    const padLeft = Math.max(16, parseFloat(computedInner.paddingLeft) || 16);
    const padRight = Math.max(16, parseFloat(computedInner.paddingRight) || 16);
    const avail = Math.max(0, W - padLeft - padRight);

    if (H < 480) {
      section.setAttribute('data-short', '');
    } else {
      section.removeAttribute('data-short');
    }

    // Measure widest line ("SURPRISED?") at probe font-size 100px
    h1.style.setProperty('--fs', '100px');
    const lines = h1.querySelectorAll<HTMLElement>('.teaser__headline-line');
    let maxLineWidth = 0;
    lines.forEach((line) => {
      const w = line.getBoundingClientRect().width;
      if (w > maxLineWidth) maxLineWidth = w;
    });

    if (!maxLineWidth) return;

    // Reduced factor to 0.96 with at least 16px side padding so it never touches screen edge
    const targetWidth = avail * 0.96;
    let fs = (targetWidth / maxLineWidth) * 100;

    // Vertical budget clamp: ensure 4 stacked lines fit comfortably on short landscape viewports
    const reserve = Math.min(260, H * 0.38);
    const maxVerticalFs = (H - reserve) / (4 * 0.96);
    fs = Math.min(fs, Math.max(26, maxVerticalFs));

    // Clamp: 26px to 170px
    fs = Math.max(26, Math.min(170, fs));

    h1.style.setProperty('--fs', `${fs.toFixed(2)}px`);
  }

  private preload3D(): void {
    if (typeof document !== 'undefined' && !document.querySelector('link[href*="plane.glb"]')) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = '/assets/plane.glb';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }
}
