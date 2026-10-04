import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ViewChildren, QueryList,
  PLATFORM_ID, Inject, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
 
type GSAPType = typeof import('gsap').gsap;
type STType = typeof import('gsap/ScrollTrigger').ScrollTrigger;
 
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
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent implements AfterViewInit, OnDestroy {
 
  @ViewChild('cursor')          cursorEl!: ElementRef<HTMLDivElement>;
  @ViewChild('cursorFollower')  cursorFollowerEl!: ElementRef<HTMLDivElement>;
  @ViewChild('navbar')          navbar!: ElementRef<HTMLElement>;
  @ViewChild('heroSection')     heroSection!: ElementRef<HTMLElement>;
  @ViewChild('heroBg')          heroBg!: ElementRef<HTMLDivElement>;
  @ViewChild('windowWrap')      windowWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('skyLayer')        skyLayer?: ElementRef<HTMLDivElement>;   // NEW: used to compute the zoom
  @ViewChild('windowRing')      windowRing!: ElementRef<HTMLDivElement>;
  @ViewChild('windowPill')      windowPill!: ElementRef<HTMLDivElement>;
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
 
  @ViewChild('ascentSection')   ascentSection?: ElementRef<HTMLElement>;
  @ViewChild('phase1Layer')     phase1Layer?: ElementRef<HTMLDivElement>;
  @ViewChild('specsLeft')       specsLeft?: ElementRef<HTMLDivElement>;
  @ViewChild('specsRight')      specsRight?: ElementRef<HTMLDivElement>;
  @ViewChild('jetWrapper')      jetWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentCta')       ascentCta?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentProgress')  ascentProgress?: ElementRef<HTMLDivElement>;
  @ViewChild('blueprintLayer')  blueprintLayer?: ElementRef<HTMLDivElement>;
  @ViewChild('wordmarkEl')      wordmarkEl?: ElementRef<HTMLDivElement>;
  @ViewChild('ascentJetImg')    ascentJetImg?: ElementRef<HTMLImageElement>;
 
  mobileMenuOpen = false;
 
  private gsap!: GSAPType;
  private ST!: STType;
  private lenis?: LenisInstance;
  private mm?: ReturnType<GSAPType['matchMedia']>;
  private tickerCb?: (time: number) => void;
  private mouseMoveHandler?: (e: MouseEvent) => void;
  private destroyed = false;
  // Lenis already smooths the scroll, so scrub must NOT add a second long smoothing
  private scrubValue: number | boolean = 0.6;
  private onLoadRefresh?: () => void;
 
  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private zone: NgZone
  ) {}
 
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
    }
  }
 
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
 
    this.zone.runOutsideAngular(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger')
      ]);
      if (this.destroyed) return;
 
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
      // CHANGED: removed gsap.defaults({ force3D: true }).
      // "true" keeps every animated element on its own GPU layer permanently
      // (more VRAM, worse on phones). The default "auto" promotes only while animating.
      this.gsap = gsap;
      this.ST = ScrollTrigger;
 
      // NEW: reduced motion -> no pin, no scrub, no Lenis. The SCSS shows the static state.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 
      await this.initLenis();
      if (this.destroyed) return;
 
      this.initCursor();
      this.initEntrance();
 
      this.mm = gsap.matchMedia();
      this.mm.add(
        { isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' },
        (ctx) => {
          const isMobile = !!ctx.conditions?.['isMobile'];
          this.buildHero(isMobile);
          this.buildAscent(isMobile);
        }
      );
 
      this.initValueAnim();
 
      const idle: (cb: () => void) => void =
        (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600));
      idle(() => {
        [this.jetImg?.nativeElement, this.ascentJetImg?.nativeElement]
          .forEach(img => img?.decode?.().catch(() => {}));
      });
 
      // Late layout shifts (fonts, images) move trigger positions -> re-measure once
      const refresh = () => ScrollTrigger.refresh();
      (document as any).fonts?.ready?.then(refresh);
      if (document.readyState !== 'complete') {
        this.onLoadRefresh = refresh;
        window.addEventListener('load', refresh, { once: true });
      }
    });
  }
 
  // Lenis only on desktop pointers; touch devices use native scroll (much cheaper).
  private async initLenis(): Promise<void> {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;
 
    // CHANGED: "@studio-freight/lenis" was renamed to "lenis" (npm i lenis)
    const { default: Lenis } = await import('lenis');
    this.lenis = new (Lenis as any)({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: false, // we drive it from the GSAP ticker below
    }) as LenisInstance;
 
    this.scrubValue = true; // 1:1 with Lenis' already-smoothed scroll
    this.tickerCb = (time: number) => this.lenis!.raf(time * 1000);
    this.gsap.ticker.add(this.tickerCb);
    this.gsap.ticker.lagSmoothing(0);
    this.lenis.on('scroll', this.ST.update);
  }
 
  private initCursor(): void {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const gsap = this.gsap;
    const cursor = this.cursorEl.nativeElement;
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
 
  private initEntrance(): void {
    const gsap = this.gsap;
    const texts = [
      ...Array.from(this.heroTextLeft.nativeElement.children),
      ...Array.from(this.heroTextRight.nativeElement.children),
    ];
    gsap.from(texts,
      { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out', stagger: 0.12, delay: 0.3, clearProps: 'opacity,transform' });
    const entity = this.windowWrap.nativeElement.firstElementChild;
    if (entity) {
      gsap.from(entity,
        { opacity: 0, scale: 0.88, duration: 1.4, ease: 'expo.out', delay: 0.2, clearProps: 'opacity,transform' });
    }
  }
 
  // ─── HERO: window zoom → ascent layer ──────────────────────────────────────
  private buildHero(isMobile: boolean): void {
    const gsap = this.gsap;
    const hero      = this.heroSection.nativeElement;
    const bg        = this.heroBg.nativeElement;
    const wrap      = this.windowWrap.nativeElement;
    const sky       = this.skyLayer?.nativeElement;
    const ring      = this.windowRing?.nativeElement;
    const pill      = this.windowPill?.nativeElement;
    const tLeft     = this.heroTextLeft.nativeElement;
    const tRight    = this.heroTextRight.nativeElement;
    const watermark = this.skyWatermark?.nativeElement;
    const cloudText = this.cloudOverlay?.nativeElement;
    const ascent    = this.ascentLayer?.nativeElement;
    const left      = this.ascentLeft?.nativeElement;
    const right     = this.ascentRight?.nativeElement;
    const jetWrap   = this.jetImg?.nativeElement.parentElement as HTMLElement | null;
    const cards     = [this.card1?.nativeElement, this.card2?.nativeElement, this.card3?.nativeElement]
                        .filter(Boolean) as HTMLElement[];
    const nav       = this.navbar?.nativeElement;
 
    if (jetWrap) gsap.set(jetWrap, { xPercent: -50, yPercent: -50 });
    gsap.set(wrap, { x: 0, y: 0, transformOrigin: 'center center' });
 
    // CHANGED: the zoom is computed from the real aperture size instead of a fixed 9.
    // Fixed 9 shows the edges on wide screens (>~1700px) and over-scales on phones
    // (a bigger scale = a bigger GPU surface for nothing).
    // offsetWidth/Height ignore transforms, so this is safe even mid-entrance.
    const zoomTarget = (): number => {
      if (!sky || !sky.offsetWidth || !sky.offsetHeight) return isMobile ? 6 : 9;
      const cover = Math.max(window.innerWidth / sky.offsetWidth, window.innerHeight / sky.offsetHeight);
      return cover * 1.45; // the aperture is an ellipse: x1.45 so the screen corners are covered too
    };
 

   const heavy = [wrap, pill, cloudText, ascent, left, right, jetWrap, ...cards]
                .filter(Boolean) as HTMLElement[];
    let navDark = false;
    let threshold = 0.53;
 
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: isMobile ? '+=250%' : '+=350%',
        pin: true,
        scrub: this.scrubValue,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          heavy.forEach(el => el.style.willChange = self.isActive ? 'transform, opacity' : 'auto');
          hero.classList.toggle('hero--active', self.isActive); // SCSS pauses the ring pulse with this
        },
        onUpdate: (self) => {
          if (!nav) return;
          const dark = self.progress >= threshold;
          if (dark !== navDark) { navDark = dark; nav.classList.toggle('nav--dark', dark); }
        },
      }
    });
 
    // STAGE 1 → 2
    tl
      .to(wrap, { scale: zoomTarget, ease: 'power2.in', duration: 0.65 }, 0)
      .to(watermark, { opacity: 0, duration: 0.05 }, 0)
      .to([tLeft, tRight], { opacity: 0, y: -35, ease: 'power1.out', duration: 0.2 }, 0);
 
    if (pill) tl.to(pill, { opacity: 0, scale: 0.8, ease: 'power1.out', duration: 0.15 }, 0);
    // CHANGED: the ring sits inside `wrap`, which is already scaled, so scaling it x10 on top
    // only made a huge box-shadow surface. Fade it out instead.
    if (ring) tl.to(ring, { opacity: 0, ease: 'power1.out', duration: 0.2 }, 0);
    tl.to(bg, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 0.15);
 
    // STAGE 2: cloud text. CHANGED: autoAlpha (opacity + visibility) so that hidden
    // full-screen layers are skipped by the compositor completely.
    if (cloudText) {
      tl.fromTo(cloudText, { autoAlpha: 0, y: 30 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.14 }, 0.28)
        .to(cloudText, { autoAlpha: 0, y: -25, ease: 'power2.in', duration: 0.12 }, 0.46);
    }
 
    // STAGE 3: ascent layer
    if (ascent) {
      tl.fromTo(ascent, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'power1.inOut', duration: 0.18 }, 0.48);
    }
    if (left) {
      tl.fromTo(left, { x: -70, opacity: 0 }, { x: 0, opacity: 1, ease: 'power2.out', duration: 0.22 }, 0.54);
    }
    if (right) {
      tl.fromTo(right, { x: 70, opacity: 0 }, { x: 0, opacity: 1, ease: 'power2.out', duration: 0.22 }, 0.54);
    }
    if (jetWrap) {
      tl.fromTo(jetWrap,
        { xPercent: -50, yPercent: 40, scale: 0.8 },
        { xPercent: -50, yPercent: -50, scale: 1, ease: 'power2.out', duration: 0.38 }, 0.52);
    }
    if (cards.length) {
      tl.fromTo(cards, { y: 35, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, ease: 'back.out(1.4)', duration: 0.18 }, 0.68);
    }
 
    threshold = 0.52 / tl.duration();
 
    // CHANGED: refreshPriority -1. This trigger measures the value section, which sits AFTER
    // the two pinned sections. If it refreshes before their pin-spacers exist, its start
    // position is wrong (nav stays dark/light at the wrong time, especially after resize).
    if (nav && this.valueSection) {
      this.ST.create({
        trigger: this.valueSection.nativeElement,
        start: 'top 64px',
        refreshPriority: -1,
        onEnter: () => nav.classList.remove('nav--dark'),
        onLeaveBack: () => nav.classList.add('nav--dark'),
      });
    }
  }
 
  // ─── 650ER ASCENT SECTION ──────────────────────────────────────────────────
  private buildAscent(isMobile: boolean): void {
    const gsap = this.gsap;
    const CFG = {
      JET_END_Y:       isMobile ? -70 : -140,
      JET_END_SCALE:   isMobile ? 0.5 : 0.3,
      BLUEPRINT_END_Y: isMobile ? 20 : 40,
      WORD_FROM_Y:     isMobile ? 75 : 150,
      WORD_TO_Y:       isMobile ? -15 : -30,
      SCROLL_LENGTH:   isMobile ? '+=150%' : '+=250%',
    };
 
    const section   = this.ascentSection?.nativeElement;
    const blueprint = this.blueprintLayer?.nativeElement;
    const wordmark  = this.wordmarkEl?.nativeElement;
    const p1        = this.phase1Layer?.nativeElement;
    const jetWrap   = this.jetWrapper?.nativeElement;
    const sLeft     = this.specsLeft?.nativeElement;
    const sRight    = this.specsRight?.nativeElement;
    const cta       = this.ascentCta?.nativeElement;
    const progress  = this.ascentProgress?.nativeElement;
    if (!section || !jetWrap) return;
 
    const specItems = [
      ...(sLeft  ? Array.from(sLeft.querySelectorAll('.ascent__spec-item'))  : []),
      ...(sRight ? Array.from(sRight.querySelectorAll('.ascent__spec-item')) : []),
    ] as HTMLElement[];
 
    gsap.set(jetWrap, { xPercent: -50, yPercent: 0, scale: 1 });
    if (blueprint) gsap.set(blueprint, { yPercent: 0 });
    if (wordmark)  gsap.set(wordmark, { y: CFG.WORD_FROM_Y, opacity: 0 });
    if (p1)        gsap.set(p1, { y: 0, opacity: 1 });
    if (specItems.length) gsap.set(specItems, { opacity: 0, y: 30 });
    if (cta)       gsap.set(cta, { opacity: 0, y: 30 });
 
    const heavy = [jetWrap, blueprint, wordmark, p1].filter(Boolean) as HTMLElement[];
 
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: CFG.SCROLL_LENGTH,
        pin: true,
        scrub: this.scrubValue,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => heavy.forEach(el => el.style.willChange = self.isActive ? 'transform, opacity' : 'auto'),
        onUpdate: (self) => { if (progress) progress.style.transform = `scaleX(${self.progress})`; },
      },
    });
 
    tl.to(jetWrap, { xPercent: -50, yPercent: CFG.JET_END_Y, scale: CFG.JET_END_SCALE, ease: 'power1.in', duration: 0.75 }, 0);
    if (blueprint) tl.to(blueprint, { yPercent: CFG.BLUEPRINT_END_Y, ease: 'power1.in', duration: 0.75 }, 0);
    if (p1)        tl.to(p1, { opacity: 0, y: 40, ease: 'power1.out', duration: 0.30 }, 0);
    if (wordmark)  tl.to(wordmark, { y: CFG.WORD_TO_Y, opacity: 1, ease: 'power2.out', duration: 0.50 }, 0.35);
    if (specItems.length) tl.to(specItems, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12, stagger: 0.02 }, 0.70);
    if (cta)       tl.to(cta, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12 }, 0.85);
  }
 
  private initValueAnim(): void {
    const gsap = this.gsap;
    const cells = this.valueCells.toArray().map(r => r.nativeElement);
    this.ST.create({
      trigger: this.valueSection.nativeElement,
      start: 'top 80%',
      once: true,
      refreshPriority: -1, // CHANGED: refresh after the pinned sections above it (see buildHero)
      onEnter: () => {
        cells.forEach(c => c.style.willChange = 'opacity, transform');
        gsap.to(cells, {
          opacity: 1, y: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out',
          onComplete: () => cells.forEach(c => c.style.willChange = 'auto')
        });
      }
    });
  }
 
  ngOnDestroy(): void {
    this.destroyed = true;
    document.body.style.overflow = '';
    this.mm?.revert();
    this.ST?.getAll().forEach(t => t.kill());
    if (this.tickerCb && this.gsap) this.gsap.ticker.remove(this.tickerCb);
    this.lenis?.destroy();
    if (this.onLoadRefresh) window.removeEventListener('load', this.onLoadRefresh);
    if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
  }
}