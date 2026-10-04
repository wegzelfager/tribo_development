import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, ViewChildren, QueryList,
  PLATFORM_ID, Inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Prevent overlapping scrub animations from fighting each other on fast reverse scroll
ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
// Force all GSAP tweens to use matrix3d (GPU path) even for 2-D transforms
gsap.defaults({ force3D: true });

interface LenisInstance {
  on(event: string, cb: (e: { scroll: number }) => void): void;
  destroy(): void;
  raf(time: number): void;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('cursor')          cursorEl!: ElementRef<HTMLDivElement>;
  @ViewChild('cursorFollower')  cursorFollowerEl!: ElementRef<HTMLDivElement>;
  @ViewChild('navbar')          navbar!: ElementRef<HTMLElement>;
  @ViewChild('heroSection')     heroSection!: ElementRef<HTMLElement>;
  @ViewChild('heroBg')          heroBg!: ElementRef<HTMLDivElement>;
  @ViewChild('windowWrap')      windowWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('windowImg')       windowImg!: ElementRef<HTMLImageElement>;
  @ViewChild('windowRing')      windowRing!: ElementRef<HTMLDivElement>;
  @ViewChild('windowPill')      windowPill!: ElementRef<HTMLDivElement>;
  @ViewChild('skyLayer')        skyLayer!: ElementRef<HTMLDivElement>;
  @ViewChild('skyWatermark')    skyWatermark!: ElementRef<HTMLDivElement>;
  @ViewChild('heroTextLeft')    heroTextLeft!: ElementRef<HTMLDivElement>;
  @ViewChild('heroTextRight')   heroTextRight!: ElementRef<HTMLDivElement>;
  @ViewChild('cloudOverlay')    cloudOverlay?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentLayer')     ascentLayer?: ElementRef<HTMLDivElement>;
  @ViewChild('jetImg')          jetImg!: ElementRef<HTMLImageElement>;
  @ViewChild('ascentLeft')      ascentLeft!: ElementRef<HTMLDivElement>;
  @ViewChild('ascentRight')     ascentRight!: ElementRef<HTMLDivElement>;
  @ViewChild('card1')           card1!: ElementRef<HTMLDivElement>;
  @ViewChild('card2')           card2!: ElementRef<HTMLDivElement>;
  @ViewChild('card3')           card3!: ElementRef<HTMLDivElement>;
  @ViewChild('valueSection')    valueSection!: ElementRef<HTMLElement>;
  @ViewChildren('valueCell')    valueCells!: QueryList<ElementRef<HTMLDivElement>>;

  // ── Ascent Scroll Section refs (3-Phase) ──────────────────────────────
  @ViewChild('ascentSection')   ascentSection?: ElementRef<HTMLElement>;
  @ViewChild('phase1Layer')     phase1Layer?: ElementRef<HTMLDivElement>;
  @ViewChild('specsLeft')       specsLeft?: ElementRef<HTMLDivElement>;
  @ViewChild('specsRight')      specsRight?: ElementRef<HTMLDivElement>;
  @ViewChild('jetWrapper')      jetWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentJetImg')    ascentJetImg?: ElementRef<HTMLImageElement>;
  @ViewChild('jetInterior')    jetInterior?: ElementRef<HTMLImageElement>; // Phase 3 blueprint
  @ViewChild('ascentCta')       ascentCta?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentProgress')  ascentProgress?: ElementRef<HTMLDivElement>;
  @ViewChild('blueprintLayer')  blueprintLayer?: ElementRef<HTMLDivElement>;  // slides DOWN opposite to jet
  @ViewChild('wordmarkEl')      wordmarkEl?: ElementRef<HTMLDivElement>;       // giant "650ER" rises from below
  @ViewChild('scrollHint')      scrollHint?: ElementRef<HTMLDivElement>;       // "Scroll to take off" hint



  mobileMenuOpen = false;

  private lenis!: LenisInstance;
  private mouseMoveHandler!: (e: MouseEvent) => void;
  private gsapTickerCb!: (time: number) => void;
  private resizeHandler!: () => void;
  private resizeDebounce: ReturnType<typeof setTimeout> | null = null;
  private ascentMM?: ReturnType<typeof ScrollTrigger.matchMedia>;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit(): void {}

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
      const btn = document.getElementById('nav-hamburger');
      if (btn) btn.setAttribute('aria-expanded', String(this.mobileMenuOpen));
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => {
      this.initLenis();
      this.initCursor();
      this.initHeroAnim();
      this.initAscentMatchMedia();
      this.initValueAnim();
    });
  }

  // AGENT 1: Lenis — driven exclusively by GSAP ticker (no dual RAF loop)
  private async initLenis(): Promise<void> {
    const { default: Lenis } = await import('@studio-freight/lenis');
    this.lenis = new (Lenis as any)({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    }) as LenisInstance;

    // Single driver: GSAP ticker → Lenis. Never call lenis.raf() anywhere else.
    this.gsapTickerCb = (time: number) => this.lenis.raf(time * 1000);
    gsap.ticker.add(this.gsapTickerCb);
    gsap.ticker.lagSmoothing(0);

    // Let ScrollTrigger know about Lenis scroll position
    this.lenis.on('scroll', ScrollTrigger.update);

    // Refresh ScrollTrigger after fonts/images cause layout shifts — debounced 150ms
    this.resizeHandler = () => {
      if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
      this.resizeDebounce = setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  // Custom Cursor — uses quickTo() so zero new tweens are allocated on mousemove
  private initCursor(): void {
    const cursor   = this.cursorEl.nativeElement;
    const follower = this.cursorFollowerEl.nativeElement;

    const qcx = gsap.quickTo(cursor,   'x', { duration: 0.06, ease: 'none' });
    const qcy = gsap.quickTo(cursor,   'y', { duration: 0.06, ease: 'none' });
    const qfx = gsap.quickTo(follower, 'x', { duration: 0.18, ease: 'power2.out' });
    const qfy = gsap.quickTo(follower, 'y', { duration: 0.18, ease: 'power2.out' });

    this.mouseMoveHandler = (e: MouseEvent) => {
      qcx(e.clientX); qcy(e.clientY);
      qfx(e.clientX); qfy(e.clientY);
    };
    document.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
  }

  // Unified Hero & Ascent Scroll Sequence
  private initHeroAnim(): void {
    const hero          = this.heroSection.nativeElement;
    const bg            = this.heroBg.nativeElement;
    const wrap          = this.windowWrap.nativeElement;
    const ring          = this.windowRing?.nativeElement;
    const pill          = this.windowPill?.nativeElement;
    const tLeft         = this.heroTextLeft.nativeElement;
    const tRight        = this.heroTextRight.nativeElement;
    const watermark     = this.skyWatermark?.nativeElement;
    const cloudText     = this.cloudOverlay?.nativeElement;
    const ascent        = this.ascentLayer?.nativeElement;
    const left          = this.ascentLeft?.nativeElement;
    const right         = this.ascentRight?.nativeElement;
    const jet           = this.jetImg?.nativeElement;
    const jetWrap       = jet?.parentElement as HTMLElement;
    const cards         = [this.card1?.nativeElement, this.card2?.nativeElement, this.card3?.nativeElement].filter(Boolean) as HTMLElement[];
    const nav           = this.navbar?.nativeElement;

    // Entrance animation
    gsap.from([tLeft, tRight], { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out', stagger: 0.15, delay: 0.3 });
    gsap.from(wrap, { opacity: 0, scale: 0.88, duration: 1.4, ease: 'expo.out', delay: 0.2 });

    // Pulsing ring ambient animation
    if (ring) {
      gsap.to(ring, { scale: 1.05, opacity: 0.45, duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }

    // Pre-promote all animated elements to GPU compositor layers
    gsap.set(wrap, {
      x: 0, y: 0, z: 0,
      transformOrigin: 'center center',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
    });
    if (ring) gsap.set(ring, { x: 0, y: 0, z: 0, transformOrigin: 'center center', backfaceVisibility: 'hidden' });
    if (pill) gsap.set(pill, { x: 0, y: 0, z: 0, backfaceVisibility: 'hidden' });
    if (cloudText) gsap.set(cloudText, { z: 0, backfaceVisibility: 'hidden' });
    if (ascent) gsap.set(ascent, { z: 0, backfaceVisibility: 'hidden' });
    if (left) gsap.set(left, { z: 0, backfaceVisibility: 'hidden' });
    if (right) gsap.set(right, { z: 0, backfaceVisibility: 'hidden' });
    if (jetWrap) gsap.set(jetWrap, { x: 0, y: 0, xPercent: -50, yPercent: -50, z: 0, backfaceVisibility: 'hidden' });
    if (cards.length) gsap.set(cards, { z: 0, backfaceVisibility: 'hidden' });

    // Single unified scroll sequence — pins heroSection and transitions seamlessly through all 3 stages
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=350%',
        pin: true,
        scrub: 1.2,
        anticipatePin: 1,
        fastScrollEnd: true,
        preventOverlaps: true,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          wrap.style.willChange = self.isActive ? 'transform' : 'auto';
          if (ring) ring.style.willChange = self.isActive ? 'transform, opacity' : 'auto';
          if (pill) pill.style.willChange = self.isActive ? 'opacity, transform' : 'auto';
          if (cloudText) cloudText.style.willChange = self.isActive ? 'opacity, transform' : 'auto';
          if (ascent) ascent.style.willChange = self.isActive ? 'opacity' : 'auto';
          if (left) left.style.willChange = self.isActive ? 'opacity, transform' : 'auto';
          if (right) right.style.willChange = self.isActive ? 'opacity, transform' : 'auto';
          if (jetWrap) jetWrap.style.willChange = self.isActive ? 'transform' : 'auto';
          cards.forEach(c => c.style.willChange = self.isActive ? 'opacity, transform' : 'auto');
        },
      }
    });

    // ── STAGE 1 -> STAGE 2: Window Zoom & Initial Headlines Exit ────────────
    tl
      .to(wrap, { scale: 9, ease: 'power2.in', duration: 0.65 }, 0)
      .to(watermark, { opacity: 0, duration: 0.05 }, 0)
      .to([tLeft, tRight], { opacity: 0, y: -35, ease: 'power1.out', duration: 0.2 }, 0);

    if (pill) tl.to(pill, { opacity: 0, scale: 0.8, ease: 'power1.out', duration: 0.15 }, 0);
    if (ring) tl.to(ring, { scale: 10, opacity: 0, ease: 'power2.in', duration: 0.4 }, 0);
    tl.to(bg, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 0.15);

    // ── STAGE 2: Mid-Scroll Cloud Transition Text Overlay ───────────────────
    if (cloudText) {
      tl.fromTo(cloudText,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, ease: 'power2.out', duration: 0.14 },
        0.28
      )
      .to(cloudText,
        { opacity: 0, y: -25, ease: 'power2.in', duration: 0.12 },
        0.46
      );
    }

    // ── STAGE 3: Post-Zoom Ascent Layer (Gradient, Aircraft & Typography) ───
    if (ascent) {
      tl.fromTo(ascent,
        { opacity: 0 },
        { opacity: 1, ease: 'power1.inOut', duration: 0.18 },
        0.48
      );
    }

    // Adapt navbar link colors so they stay high contrast against light blue/sand sky
    if (nav) {
      const navLinks = nav.querySelectorAll('a');
      tl.to(navLinks, { color: '#1A1615', duration: 0.15, ease: 'power1.inOut' }, 0.52);
    }

    // Left Block: "Fly in" + "Luxury that moves with you"
    if (left) {
      tl.fromTo(left,
        { x: -70, opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out', duration: 0.22 },
        0.54
      );
    }

    // Right Block: "Luxury" + GULFSTREAM / 650ER meta strip
    if (right) {
      tl.fromTo(right,
        { x: 70, opacity: 0 },
        { x: 0, opacity: 1, ease: 'power2.out', duration: 0.22 },
        0.54
      );
    }

    // Center SUV Card: Ascends smoothly into center
    if (jetWrap) {
      tl.fromTo(jetWrap,
        { x: 0, xPercent: -50, yPercent: 40, scale: 0.8 },
        { x: 0, xPercent: -50, yPercent: -50, scale: 1, ease: 'power2.out', duration: 0.38 },
        0.52
      );
    }

    // Bottom Metric Cards: Stagger in
    if (cards.length) {
      tl.fromTo(cards,
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, ease: 'back.out(1.4)', duration: 0.18 },
        0.68
      );
    }
  }

  // ─── ASCENT matchMedia: rebuilds on mobile ↔ desktop swap ───────────────────
  private initAscentMatchMedia(): void {
    this.ascentMM = ScrollTrigger.matchMedia({
      '(max-width: 767px)': () => { this.buildAscent(true); },
      '(min-width: 768px)': () => { this.buildAscent(false); },
    });
  }

  private buildAscent(isMobile: boolean): void {
    // ── Tunables — change these to adjust the animation feel ─────────────────
    const CFG = {
      JET_END_Y:        isMobile ? -70 : -140,
      JET_END_SCALE:    isMobile ? 0.5 : 0.3,
      BLUEPRINT_END_Y:  isMobile ? 20 : 40,
      WORD_FROM_Y:      isMobile ? 75 : 150,
      WORD_TO_Y:        isMobile ? -15 : -30,
      SCROLL_LENGTH:    isMobile ? '+=150%' : '+=250%',
    };

    // ── Element refs ─────────────────────────────────────────────────────────
    const section    = this.ascentSection?.nativeElement   as HTMLElement;
    const blueprint  = this.blueprintLayer?.nativeElement  as HTMLElement;
    const wordmark   = this.wordmarkEl?.nativeElement      as HTMLElement;
    const p1         = this.phase1Layer?.nativeElement     as HTMLElement;
    const jetWrap    = this.jetWrapper?.nativeElement      as HTMLElement;
    const sLeft      = this.specsLeft?.nativeElement       as HTMLElement;
    const sRight     = this.specsRight?.nativeElement      as HTMLElement;
    const cta        = this.ascentCta?.nativeElement       as HTMLElement;
    const progress   = this.ascentProgress?.nativeElement  as HTMLElement;

    if (!section || !jetWrap) return;

    // ── Collect spec items for stagger ───────────────────────────────────────
    const specItems: HTMLElement[] = [
      ...(sLeft  ? Array.from(sLeft.querySelectorAll('.ascent__spec-item'))  : []),
      ...(sRight ? Array.from(sRight.querySelectorAll('.ascent__spec-item')) : []),
    ] as HTMLElement[];

    // ── INITIAL STATES ────────────────────────────────────────────────────────
    gsap.set(jetWrap, { xPercent: -50, yPercent: 0, scale: 1 });
    if (blueprint) gsap.set(blueprint, { yPercent: 0, z: 0 });
    if (wordmark) gsap.set(wordmark, { y: CFG.WORD_FROM_Y, opacity: 0 });
    if (p1) gsap.set(p1, { y: 0, opacity: 1 });
    if (specItems.length) gsap.set(specItems, { opacity: 0, y: 30 });
    if (cta) gsap.set(cta, { opacity: 0, y: 30 });

    // ── GPU compositor pre-promotion ─────────────────────────────────────────
    const gpuEls = [jetWrap, blueprint, wordmark, p1, sLeft, sRight, cta].filter(Boolean) as HTMLElement[];
    gsap.set(gpuEls, { z: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' });

    // ── MASTER SCROLL TIMELINE ────────────────────────────────────────────────
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: CFG.SCROLL_LENGTH,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          const on = self.isActive;
          jetWrap.style.willChange        = on ? 'transform'          : 'auto';
          if (blueprint) blueprint.style.willChange = on ? 'transform' : 'auto';
          if (wordmark)  wordmark.style.willChange  = on ? 'transform, opacity' : 'auto';
          if (p1)        p1.style.willChange        = on ? 'opacity, transform' : 'auto';
        },
        onUpdate: (self) => {
          if (progress) {
            gsap.set(progress, { scaleX: self.progress, transformOrigin: 'left center' });
          }
        },
      },
    });

    // 0 → 0.75  JET
    tl.to(jetWrap, {
      xPercent: -50,
      yPercent: CFG.JET_END_Y,
      scale: CFG.JET_END_SCALE,
      ease: 'power1.in',
      duration: 0.75,
    }, 0);

    // 0 → 0.75  BLUEPRINT
    if (blueprint) {
      tl.to(blueprint, { yPercent: CFG.BLUEPRINT_END_Y, ease: 'power1.in', duration: 0.75 }, 0);
    }

    // 0 → 0.30  PHASE-1 TEXT
    if (p1) {
      tl.to(p1, { opacity: 0, y: 40, ease: 'power1.out', duration: 0.30 }, 0);
    }

    // 0.35 → 0.85  WORDMARK
    if (wordmark) {
      tl.to(wordmark, { y: CFG.WORD_TO_Y, opacity: 1, ease: 'power2.out', duration: 0.50 }, 0.35);
    }

    // 0.70 → 0.96  SPEC ITEMS + CTA
    if (specItems.length) {
      tl.to(specItems, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12, stagger: 0.02 }, 0.70);
    }
    if (cta) {
      tl.to(cta, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12 }, 0.85);
    }
  }


  // Value Grid ScrollTrigger fade-in stagger
  private initValueAnim(): void {
    const cells = this.valueCells.toArray().map(r => r.nativeElement);
    // Pre-promote GPU layers so the fade-in is compositor-only (no mid-animation rasterization)
    gsap.set(cells, { z: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' });

    ScrollTrigger.create({
      trigger: this.valueSection.nativeElement,
      start: 'top 80%',
      onEnter: () => {
        // Activate will-change just before the animation fires
        cells.forEach(c => c.style.willChange = 'opacity, transform');
        gsap.to(cells, {
          opacity: 1, y: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out',
          onComplete: () => {
            // Release will-change after animation completes to free VRAM
            cells.forEach(c => c.style.willChange = 'auto');
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.ascentMM) (this.ascentMM as any).revert();
    if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
    ScrollTrigger.getAll().forEach(t => t.kill());
    if (this.lenis) this.lenis.destroy();
    if (this.gsapTickerCb) gsap.ticker.remove(this.gsapTickerCb);
    if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
  }
}
