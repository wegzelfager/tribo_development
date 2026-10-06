import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ElementRef, ViewChild,
  PLATFORM_ID, Inject, NgZone, ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SmoothScrollService } from '../core/smooth-scroll.service';
import { SoundService } from '../core/sound.service';

// ─── Content data ─────────────────────────────────────────────────────────────
export interface ProcessSection {
  left:     string;
  featured: string;
  right:    string;
  slug:     string;
}

export const SECTIONS: readonly ProcessSection[] = [
  { left: 'Jets',   featured: 'Ultra-Long-Range Flights', right: 'Sky',   slug: 'process-01' },
  { left: 'Yachts', featured: 'Superyacht Charters',      right: 'Sea',   slug: 'process-02' },
  { left: 'Safaris',featured: 'Private Expeditions',      right: 'Land',  slug: 'process-03' },
  { left: 'Escrow', featured: 'Paid Only On Arrival',     right: 'Trust', slug: 'process-04' },
] as const;

// ─── GSAP type stubs (avoid @types/gsap conflicts) ────────────────────────────
type GSAPType   = typeof import('gsap').gsap;
type STType     = typeof import('gsap/ScrollTrigger').ScrollTrigger;

// ─── Small state machine ──────────────────────────────────────────────────────
type AnimState = 'idle' | 'transitioning';

@Component({
  selector: 'app-process-showcase',
  standalone: true,
  imports: [],
  templateUrl: './process-showcase.component.html',
  styleUrl:    './process-showcase.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessShowcaseComponent implements AfterViewInit, OnDestroy {

  @ViewChild('wrapper')  wrapperEl!: ElementRef<HTMLElement>;
  @ViewChild('stage')    stageEl!:   ElementRef<HTMLElement>;
  @ViewChild('headerEl') headerEl!:  ElementRef<HTMLElement>;
  @ViewChild('contentEl')contentEl!: ElementRef<HTMLElement>;
  @ViewChild('footerEl') footerEl!:  ElementRef<HTMLElement>;

  // ── Expose to template ──────────────────────────────────────────
  readonly sections = SECTIONS;
  readonly N        = SECTIONS.length;
  activeIndex       = 0;
  currentDisplay    = '01';   // "01" – "04" shown in footer

  // ── Mute toggle (bound to template) ───────────────────────────
  get soundMuted(): boolean { return this.sound.muted; }
  toggleSound(): void { this.sound.toggleMute(); this.cdr.markForCheck(); }

  // ─── Private GSAP / scroll state ──────────────────────────────
  private gsap!: GSAPType;
  private ST!:   STType;
  private ctx?: ReturnType<GSAPType['context']>;

  private animState:    AnimState = 'idle';
  private pendingIndex: number | null = null;

  // Snap positions recomputed in onRefresh
  private snapPositions: number[] = [];
  private mainTrigger?: ReturnType<STType['create']>;

  // SplitText instances for cleanup
  private splitInstances: Array<{ revert(): void }> = [];

  // IntersectionObserver for image preloading
  private imageObserver?: IntersectionObserver;

  // ResizeObserver for dynamic giant type fitting
  private resizeObserver?: ResizeObserver;

  private destroyed = false;
  private isCoarse  = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private zone:   NgZone,
    private cdr:    ChangeDetectorRef,
    private scroll: SmoothScrollService,
    private sound:  SoundService,
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Detect touch/coarse pointer — no snapping on those devices
    this.isCoarse = window.matchMedia('(pointer: coarse)').matches;

    // Initialize dynamic giant font fitting on the stage
    this.initGiantTypeFitting();

    this.zone.runOutsideAngular(async () => {
      const [
        { gsap },
        { ScrollTrigger },
        { SplitText },
        { CustomEase },
      ] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/SplitText'),
        import('gsap/CustomEase'),
      ]);
      if (this.destroyed) return;

      gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
      CustomEase.create('processEase', 'M0,0 C0.86,0 0.07,1 1,1');

      this.gsap = gsap;
      this.ST   = ScrollTrigger;

      // Bail on reduced-motion: instant cross-fades, no snapping
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.ctx = gsap.context(() => {
        this.buildScrollTriggers(reducedMotion);
        this.buildEntrance();
        this.buildExitParallax();
        if (!reducedMotion) this.setupImagePreload();
      }, this.wrapperEl.nativeElement);

      // Refresh after fonts + images
      const refresh = () => { if (!this.destroyed) ScrollTrigger.refresh(); };
      document.fonts?.ready?.then(refresh);

      // Decode images on load
      document.fonts?.ready?.then(() => {
        const imgs = this.wrapperEl.nativeElement.querySelectorAll<HTMLImageElement>('.ps-bg__img');
        imgs.forEach(img => img.decode?.().catch(() => {}));
        ScrollTrigger.refresh();
      });
    });
  }

  // ─── Dynamic Giant Type Fitting (Requirement B.3) ─────────────────────────
  private initGiantTypeFitting(): void {
    const stage = this.stageEl.nativeElement;

    const measureRowAt100 = (text: string, weight: number): number => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${weight} 100px Syne, sans-serif`;
        return ctx.measureText(text).width;
      }
      return text.length * (weight === 800 ? 107 : 100);
    };

    const computeGiant = async () => {
      if (this.destroyed) return;

      try {
        await document.fonts?.ready;
        await Promise.all([
          document.fonts?.load?.('800 100px Syne'),
          document.fonts?.load?.('700 100px Syne'),
        ]);
      } catch {}

      const stageWidth  = stage.clientWidth  || window.innerWidth;
      const stageHeight = stage.clientHeight || window.innerHeight;
      const isDesktop   = stageWidth > 768;

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const sidePad    = Math.min(Math.max(1.25 * rem, 0.045 * stageWidth), 4.5 * rem);
      const navSafeTop = Math.min(Math.max(4.75 * rem, 0.10 * stageHeight), 7 * rem);
      const bottomPad  = Math.max(24, Math.min(Math.max(1.5 * rem, 0.04 * stageHeight), 3 * rem));

      const rowsToMeasure = isDesktop
        ? ['EVERY JOURNEY', 'PROTECTED', 'BEYOND', 'ORDINARY']
        : ['EVERY', 'JOURNEY', 'PROTECTED', 'BEYOND', 'ORDINARY'];

      let weight = 800;
      let longestRowWidthAt100 = Math.max(...rowsToMeasure.map(r => measureRowAt100(r, weight)));

      const totalRows = isDesktop ? 4 : 5;
      const vertAvailable = Math.max(100, stageHeight - navSafeTop - bottomPad - 220);
      const vertConstraint = vertAvailable / (totalRows * 0.88);
      const horizAvailable = Math.max(100, 0.9 * (stageWidth - 2 * sidePad));
      let horizConstraint = (horizAvailable / longestRowWidthAt100) * 100;

      let giant = Math.min(horizConstraint, vertConstraint);

      // If desktop fitted size comes out below about 5vw, drop weight to 700 before shrinking further
      const fiveVw = 0.05 * stageWidth;
      if (isDesktop && giant < fiveVw) {
        weight = 700;
        longestRowWidthAt100 = Math.max(...rowsToMeasure.map(r => measureRowAt100(r, weight)));
        horizConstraint = (horizAvailable / longestRowWidthAt100) * 100;
        giant = Math.min(horizConstraint, vertConstraint);
      }

      const giantPx = Math.max(20, Math.round(giant * 100) / 100);

      stage.style.setProperty('--giant', `${giantPx}px`);
      stage.style.setProperty('--giant-weight', String(weight));
      stage.style.setProperty('--side-pad', `${Math.round(sidePad)}px`);
      stage.style.setProperty('--nav-safe-top', `${Math.round(navSafeTop)}px`);
      stage.style.setProperty('--bottom-pad', `${Math.round(bottomPad)}px`);
    };

    // Run on fonts ready
    document.fonts?.ready?.then(computeGiant);

    // Run on ResizeObserver tick (never per scroll frame)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        computeGiant();
      });
      this.resizeObserver.observe(stage);
    }
  }

  // ─── Main sticky ScrollTrigger ─────────────────────────────────────────────
  private buildScrollTriggers(reducedMotion: boolean): void {
    const gsap = this.gsap;
    const ST   = this.ST;
    const N    = this.N;
    const wrapper = this.wrapperEl.nativeElement;

    let lastIdx = -1;

    this.mainTrigger = ST.create({
      trigger:         wrapper,
      start:           'top top',
      end:             'bottom bottom',
      refreshPriority: -1,
      onUpdate: (self) => {
        const rawIdx = Math.floor(self.progress * N);
        const idx    = Math.max(0, Math.min(N - 1, rawIdx));

        if (idx !== lastIdx) {
          lastIdx = idx;
          const dir = idx > this.activeIndex ? 1 : -1;

          if (reducedMotion) {
            this.setActiveInstant(idx);
          } else if (this.isCoarse) {
            this.setActive(idx, dir);
          } else {
            this.requestTransition(idx);
          }
        }

        this.updateProgress(idx);
      },
      onRefresh: (self) => {
        const range = self.end - self.start;
        this.snapPositions = Array.from({ length: N }, (_, i) =>
          self.start + range * (i + 0.5) / N
        );
      },
    });
  }

  // ─── State machine: requestTransition ─────────────────────────────────────
  private requestTransition(newIdx: number): void {
    if (newIdx === this.activeIndex) return;

    if (this.animState === 'transitioning') {
      this.pendingIndex = newIdx;
      return;
    }
    this.runTransition(newIdx);
  }

  private runTransition(newIdx: number, fromClick = false): void {
    if (newIdx === this.activeIndex && !fromClick) return;

    this.animState = 'transitioning';
    const dir    = newIdx > this.activeIndex ? 1 : -1;
    const oldIdx = this.activeIndex;

    this.setActive(newIdx, dir);

    // Snap scroll on fine pointers when triggered by crossing boundary (not clicks)
    if (!this.isCoarse && !fromClick && this.snapPositions[newIdx] !== undefined) {
      this.scroll.scrollTo(this.snapPositions[newIdx], {
        duration: 0.7,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      });
    }

    // State machine: after animation completes, run pending or go idle
    const DUR = 0.64 * 1000 + 100;
    setTimeout(() => {
      this.animState = 'idle';
      if (this.pendingIndex !== null && this.pendingIndex !== this.activeIndex) {
        const p = this.pendingIndex;
        this.pendingIndex = null;
        this.runTransition(p);
      }
    }, DUR);
  }

  // ─── Visuals: setActive ────────────────────────────────────────────────────
  private setActive(newIdx: number, dir: number): void {
    const gsap   = this.gsap;
    const oldIdx = this.activeIndex;
    if (newIdx === oldIdx) return;

    this.activeIndex = newIdx;
    this.zone.run(() => {
      this.currentDisplay = String(newIdx + 1).padStart(2, '0');
      this.cdr.markForCheck();
    });

    const DUR = 0.64;
    const el  = this.wrapperEl.nativeElement;

    // ── Background wipe ─────────────────────────────────────────
    const bgWrappers = el.querySelectorAll<HTMLElement>('.ps-bg');
    const newBgWrap  = bgWrappers[newIdx];
    const oldBgWrap  = bgWrappers[oldIdx];
    const newBgImg   = newBgWrap?.querySelector<HTMLElement>('.ps-bg__img');
    const oldBgImg   = oldBgWrap?.querySelector<HTMLElement>('.ps-bg__img');

    if (newBgWrap && newBgImg) {
      newBgWrap.style.willChange = 'transform';
      newBgImg.style.willChange  = 'transform';
      gsap.set(newBgWrap, { yPercent: dir > 0 ? 100 : -100, zIndex: 3 });
      gsap.set(newBgImg,  { yPercent: dir > 0 ? -100 : 100 });
      gsap.to(newBgWrap,  { yPercent: 0, duration: DUR, ease: 'processEase',
        onComplete: () => {
          newBgWrap.style.willChange = 'auto';
          newBgImg.style.willChange  = 'auto';
          gsap.set(newBgWrap, { zIndex: 2 });
        }
      });
      gsap.to(newBgImg,   { yPercent: 0, duration: DUR, ease: 'processEase' });
    }

    if (oldBgWrap && oldBgImg) {
      oldBgWrap.style.willChange = 'transform';
      oldBgImg.style.willChange  = 'transform';
      gsap.set(oldBgWrap, { zIndex: 2 });
      gsap.to(oldBgImg, {
        yPercent: dir > 0 ? 5 : -5,
        duration: DUR,
        ease: 'processEase',
      });
      gsap.to(oldBgWrap, {
        opacity: 0,
        delay:   DUR * 0.5,
        duration: DUR * 0.5,
        ease: 'processEase',
        onComplete: () => {
          gsap.set(oldBgWrap, { yPercent: 0, zIndex: 1, opacity: 1 });
          gsap.set(oldBgImg,  { yPercent: 0 });
          oldBgWrap.style.willChange = 'auto';
          oldBgImg.style.willChange  = 'auto';
        },
      });
    }

    // ── Featured phrase word-mask animation ──────────────────────
    const featItems = el.querySelectorAll<HTMLElement>('.ps-featured__item');
    const oldFeat   = featItems[oldIdx];
    const newFeat   = featItems[newIdx];

    if (oldFeat) {
      const oldWords = oldFeat.querySelectorAll<HTMLElement>('.ps-word');
      gsap.to(oldWords, {
        yPercent: dir > 0 ? -110 : 110,
        duration: 0.35,
        stagger:  0.03,
        ease:     'power2.in',
        onComplete: () => {
          oldFeat.style.display = 'none';
          gsap.set(oldWords, { yPercent: 0 });
        },
      });
    }

    if (newFeat) {
      newFeat.style.display = 'flex';
      const newWords = newFeat.querySelectorAll<HTMLElement>('.ps-word');
      gsap.fromTo(newWords,
        { yPercent: dir > 0 ? 110 : -110 },
        {
          yPercent: 0,
          duration: 0.55,
          stagger:  0.04,
          ease:     'processEase',
          delay:    0.15,
        }
      );
    }

    // Sound effect on step transition
    this.sound.play('whoosh');
  }

  // Reduced motion: instant cross-fade, no transforms
  private setActiveInstant(newIdx: number): void {
    const oldIdx = this.activeIndex;
    this.activeIndex = newIdx;
    this.zone.run(() => {
      this.currentDisplay = String(newIdx + 1).padStart(2, '0');
      this.cdr.markForCheck();
    });

    const el = this.wrapperEl.nativeElement;
    const bgWrappers = el.querySelectorAll<HTMLElement>('.ps-bg');
    bgWrappers.forEach((w, i) => {
      w.style.opacity = i === newIdx ? '1' : '0';
      w.style.zIndex  = i === newIdx ? '2' : '1';
    });

    const featItems = el.querySelectorAll<HTMLElement>('.ps-featured__item');
    featItems.forEach((f, i) => {
      f.style.display = i === newIdx ? 'flex' : 'none';
    });
  }

  // ─── Progress bar fill & numbers ───────────────────────────────────────────
  private updateProgress(idx: number): void {
    const el   = this.wrapperEl.nativeElement;
    const fill = el.querySelector<HTMLElement>('.ps-progress__fill');
    if (fill) {
      const scale = (idx + 1) / this.N;
      fill.style.transform = `scaleX(${scale})`;
    }
  }

  // ─── Entrance animation (Requirement B.5: CSS handles opacities) ───────────
  private buildEntrance(): void {
    const gsap    = this.gsap;
    const ST      = this.ST;
    const wrapper = this.wrapperEl.nativeElement;

    const leftBtns  = Array.from(wrapper.querySelectorAll<HTMLElement>('.ps-list--left  .ps-list__btn'));
    const rightBtns = Array.from(wrapper.querySelectorAll<HTMLElement>('.ps-list--right .ps-list__btn'));

    // Initially offset vertically; CSS controls opacities (inactive 0.3, active 1)
    gsap.set([...leftBtns, ...rightBtns], { y: 20 });

    ST.create({
      trigger:         wrapper,
      start:           'top 85%',
      once:            true,
      refreshPriority: -1,
      onEnter: () => {
        gsap.to(leftBtns, {
          y: 0,
          stagger: 0.07,
          duration: 0.7,
          ease: 'power3.out',
          clearProps: 'transform',
        });
        gsap.to(rightBtns, {
          y: 0,
          stagger: 0.07,
          duration: 0.7,
          ease: 'power3.out',
          delay: 0.2,
          clearProps: 'transform',
        });
        // Also animate the featured text in
        const firstFeat = wrapper.querySelector<HTMLElement>('.ps-featured__item');
        if (firstFeat) {
          const words = firstFeat.querySelectorAll<HTMLElement>('.ps-word');
          gsap.from(words, {
            yPercent: 110,
            opacity: 0,
            stagger: 0.06,
            duration: 0.7,
            ease: 'power3.out',
            delay: 0.1,
          });
        }
      },
    });
  }

  // ─── Exit parallax (header / content / footer drift + blur) ───────────────
  private buildExitParallax(): void {
    const gsap    = this.gsap;
    const ST      = this.ST;
    const wrapper = this.wrapperEl.nativeElement;
    const header  = this.headerEl?.nativeElement;
    const content = this.contentEl?.nativeElement;
    const footer  = this.footerEl?.nativeElement;
    if (!header || !content || !footer) return;

    // Single scrubbed trigger — transform only, no height changes
    ST.create({
      trigger:         wrapper,
      start:           'bottom bottom',
      end:             'bottom top',
      scrub:           true,
      refreshPriority: -1,
      onUpdate: (self) => {
        const p = self.progress;
        gsap.set(header,  { yPercent: -p * 30 });
        gsap.set(content, { yPercent: -p * 20 });
        gsap.set(footer,  { yPercent: -p * 10 });
      },
      onEnter: () => {
        wrapper.classList.add('ps--exiting');
      },
      onLeaveBack: () => {
        wrapper.classList.remove('ps--exiting');
        gsap.set([header, content, footer], { yPercent: 0 });
      },
    });
  }

  // ─── IntersectionObserver: preload images when within 1.5 vh ──────────────
  private setupImagePreload(): void {
    const wrapper = this.wrapperEl.nativeElement;
    const imgs    = Array.from(wrapper.querySelectorAll<HTMLImageElement>('.ps-bg__img'));

    this.imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            imgs.forEach(img => img.decode?.().catch(() => {}));
            this.imageObserver?.disconnect();
          }
        });
      },
      { rootMargin: '150%' }
    );
    this.imageObserver.observe(wrapper);
  }

  // ─── Public: click a list item ─────────────────────────────────────────────
  onItemClick(idx: number): void {
    this.sound.unlock();
    this.sound.play('click');
    if (idx === this.activeIndex) return;
    this.runTransition(idx, /* fromClick */ true);
    if (this.snapPositions[idx] !== undefined && !this.isCoarse) {
      this.scroll.scrollTo(this.snapPositions[idx], {
        duration: 0.8,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      });
    }
  }

  onItemHover(): void {
    this.sound.unlock();
    this.sound.play('hover');
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  ngOnDestroy(): void {
    this.destroyed = true;
    this.ctx?.revert();
    this.splitInstances.forEach(s => s.revert());
    this.imageObserver?.disconnect();
    this.resizeObserver?.disconnect();
  }
}
