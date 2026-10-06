import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ViewChildren, QueryList,
  PLATFORM_ID, Inject, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SmoothScrollService } from '../../core/smooth-scroll.service';
import { ProcessShowcaseComponent } from '../../process-showcase/process-showcase.component';
 
type GSAPType = typeof import('gsap').gsap;
type STType = typeof import('gsap/ScrollTrigger').ScrollTrigger;
 
interface LenisInstance {
  on(event: string, cb: (e: { scroll: number }) => void): void;
  destroy(): void;
  raf(time: number): void;
  resize?(): void;
}
 
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ProcessShowcaseComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements AfterViewInit, OnDestroy {
 
  @ViewChild('cursor')          cursorEl!: ElementRef<HTMLDivElement>;
  @ViewChild('cursorFollower')  cursorFollowerEl!: ElementRef<HTMLDivElement>;
  @ViewChild('navbar')          navbar!: ElementRef<HTMLElement>;
  @ViewChild('heroSection')     heroSection!: ElementRef<HTMLElement>;
  @ViewChild('heroBg')          heroBg!: ElementRef<HTMLDivElement>;
  @ViewChild('windowWrap')      windowWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('skyLayer')        skyLayer?: ElementRef<HTMLDivElement>;   // used to compute the zoom
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
  @ViewChild('routeSection')    routeSection?: ElementRef<HTMLElement>;
  @ViewChild('routeSvg')        routeSvg?: ElementRef<SVGSVGElement>;
  @ViewChild('routeCar')        routeCar?: ElementRef<HTMLDivElement>;
 
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
  // anticipatePin is only useful for native (touch) scroll. With Lenis it makes the pin
  // engage EARLY. Must be decided BEFORE the ScrollTriggers are created.
  private anticipate = 1;
  private onLoadRefresh?: () => void;
 
  // FIX: refresh listener that keeps Lenis' measured page height in sync with ScrollTrigger
  private onSTRefresh?: () => void;
  // FIX: set by buildHero, released by buildAscent once the hero is completely off-screen
  private heroWarm?: (on: boolean) => void;
  private prevScrollBehavior = '';
  private navDark = false;
 
  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private zone: NgZone,
    private smoothScroll: SmoothScrollService,
  ) {}
 
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
    }
  }
 
  // ─── NAV THEME ─────────────────────────────────────────────────────────────
  // One place decides the nav colour, so the section triggers never fight each other.
  // nav--dark = dark text (for light backgrounds).
  private setNavDark(dark: boolean): void {
    if (dark === this.navDark) return;
    this.navDark = dark;
    this.navbar?.nativeElement.classList.toggle('nav--dark', dark);
  }
 
  // The 650ER section follows the OS colour scheme (see :host tokens in the SCSS).
  private prefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
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
      // force3D stays at the default "auto" globally. The few heavy scrubbed tweens that
      // sit on a pin hand-off opt in with force3D: true individually (see below).
      this.gsap = gsap;
      this.ST = ScrollTrigger;
 
      // reduced motion -> no pin, no scrub, no Lenis. The SCSS shows the static state.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 
      // IMPORTANT: initLenis() must stay awaited BEFORE mm.add(...) below, because it sets
      // this.anticipate / this.scrubValue, which the ScrollTriggers read at creation time.
      await this.initLenis();
      if (this.destroyed) return;
 
      this.initCursor();
      this.initEntrance();
 
      this.mm = gsap.matchMedia();
      this.mm.add(
        { isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' },
        (ctx) => {
          const isMobile = !!ctx.conditions?.['isMobile'];
          // Order matters: hero -> ascent -> route (top to bottom of the page).
          // Each one also has an explicit refreshPriority so ScrollTrigger measures them in
          // this order even if another component (ProcessShowcase) created its triggers first.
          this.buildHero(isMobile);
          this.buildAscent(isMobile);
          this.buildRoute(isMobile);
        }
      );
 
      this.initValueAnim();
 
      const idle: (cb: () => void) => void =
        (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600));
      idle(() => {
        [this.jetImg?.nativeElement, this.ascentJetImg?.nativeElement]
          .forEach(img => img?.decode?.().catch(() => {}));
      });
 
      // Late layout shifts (fonts, images) move trigger positions -> re-measure once.
      // sort() puts the triggers in refreshPriority order first, so a pin-spacer always exists
      // before the triggers that sit below it are measured.
      const refresh = () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); };
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
 
    // "@studio-freight/lenis" was renamed to "lenis" (npm i lenis)
    const { default: Lenis } = await import('lenis');
    this.lenis = new (Lenis as any)({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: false, // we drive it from the GSAP ticker below
    }) as LenisInstance;
 
    // FIX: a CSS `scroll-behavior: smooth` on <html> fights Lenis (the browser animates every
    // scrollTo Lenis performs). Force it off while Lenis is alive; restored in ngOnDestroy.
    const root = document.documentElement;
    this.prevScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
 
    this.scrubValue = true; // 1:1 with Lenis' already-smoothed scroll
    this.anticipate = 0;    // Lenis drives scroll from the same ticker, nothing to anticipate
    this.tickerCb = (time: number) => this.lenis!.raf(time * 1000);
    this.gsap.ticker.add(this.tickerCb);
    this.gsap.ticker.lagSmoothing(0);
    this.lenis.on('scroll', () => this.ST.update());
 
    // FIX: pin-spacers change the page height. Lenis re-measures lazily (ResizeObserver +
    // debounce), so for a moment its scroll limit / position is stale. Re-measure right
    // after every ScrollTrigger refresh.
    this.onSTRefresh = () => this.lenis?.resize?.();
    this.ST.addEventListener('refresh', this.onSTRefresh);
 
    // Register with SmoothScrollService so ProcessShowcase can use it
    this.smoothScroll.register(this.lenis as any);
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
 
    const jetStartY = isMobile ? 40 : 100;  // desktop: fully below the bottom edge
    const jetEndY   = isMobile ? -50 : 50;  // desktop: half of the car below the bottom edge
    if (jetWrap) gsap.set(jetWrap, { xPercent: -50, yPercent: isMobile ? -50 : jetStartY });
    gsap.set(wrap, { x: 0, y: 0, transformOrigin: 'center center' });
 
    // The zoom is computed from the real aperture size instead of a fixed 9.
    // offsetWidth/Height ignore transforms, so this is safe even mid-entrance.
    const zoomTarget = (): number => {
      if (!sky || !sky.offsetWidth || !sky.offsetHeight) return isMobile ? 6 : 9;
      const cover = Math.max(window.innerWidth / sky.offsetWidth, window.innerHeight / sky.offsetHeight);
      return cover * 1.6; // the aperture is an ellipse: x1.6 so the screen corners are covered too
    };
 
    // FIX (pin hand-off hitch): will-change is switched ON when the hero becomes active, but it is
    // NOT switched off when the hero's pin ends. At that moment the hero is still fully visible
    // (it scrolls away while the next section comes in), and dropping ~8 compositor layers in
    // that frame forces a re-layerize + re-raster = the stutter you feel at the hand-off.
    // buildAscent() releases it only once the hero is completely off-screen.
    const heavy = [wrap, pill, cloudText, ascent, left, right, jetWrap, ...cards]
      .filter(Boolean) as HTMLElement[];
    const warm = (on: boolean) =>
      heavy.forEach(el => (el.style.willChange = on ? 'transform, opacity' : 'auto'));
    this.heroWarm = warm;
 
    let threshold = 0.53;
    const HIDE_WRAP_AT = 0.66; // the ascent layer is fully opaque from here (0.48 + 0.18)
 
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: isMobile ? '+=250%' : '+=350%',
        pin: true,
        scrub: this.scrubValue,
        anticipatePin: this.anticipate,
        invalidateOnRefresh: true,
        refreshPriority: 3, // measured first: it is the top-most pinned section
        onToggle: (self) => {
          if (self.isActive) warm(true);
          hero.classList.toggle('hero--active', self.isActive); // SCSS pauses the CSS animations with this
        },
        onUpdate: (self) => this.setNavDark(self.progress >= threshold),
      }
    });
 
    // STAGE 1 → 2
    // force3D: true on the big zoom, so GSAP never swaps matrix3d <-> matrix at progress 0 / 1.
    tl.to(wrap, { scale: zoomTarget, ease: 'power2.in', duration: 0.65, force3D: true }, 0);
    if (watermark) tl.to(watermark, { opacity: 0, duration: 0.05 }, 0);
    // autoAlpha (opacity + visibility): hidden layers are skipped by the compositor completely.
    tl.to([tLeft, tRight], { autoAlpha: 0, y: -35, ease: 'power1.out', duration: 0.2 }, 0);
 
    if (pill) tl.to(pill, { autoAlpha: 0, scale: 0.8, ease: 'power1.out', duration: 0.15 }, 0);
    // The ring sits inside `wrap`, which is already scaled. Fade it out instead of scaling it.
    // autoAlpha on purpose: the ring has a CSS keyframe animation on `opacity`, and a running
    // CSS animation overrides GSAP's inline opacity. `visibility` is not animated by the keyframes.
    if (ring) tl.to(ring, { autoAlpha: 0, ease: 'power1.out', duration: 0.2 }, 0);
    tl.to(bg, { autoAlpha: 0, ease: 'power1.in', duration: 0.35 }, 0.15);
 
    // STAGE 2: cloud text.
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
        { xPercent: -50, yPercent: jetStartY, scale: 0.8 },
        { xPercent: -50, yPercent: jetEndY, scale: 1, ease: 'power2.out', duration: 0.38, force3D: true }, 0.52);
    }
    if (cards.length) {
      tl.fromTo(cards, { y: 35, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, ease: 'back.out(1.4)', duration: 0.18 }, 0.68);
    }
 
    // FIX: once the ascent layer is opaque, `wrap` (still ~9x scaled underneath) is invisible work.
    // Hide it so the compositor drops that giant layer for the rest of the hero + the hand-off.
    // It also covers the infinite CSS animations (sky-drift / ring-pulse) that restart when
    // the pin ends: they now run on a `visibility:hidden` layer, so they cost nothing.
    tl.to(wrap, { autoAlpha: 0, duration: 0.01, ease: 'none' }, HIDE_WRAP_AT);
 
    threshold = 0.52 / tl.duration();
 
    // refreshPriority -1: this trigger measures the value section, which sits AFTER the pinned
    // sections. Nav goes light on the dark value section, and dark again when scrolling back up.
    if (this.valueSection) {
      this.ST.create({
        trigger: this.valueSection.nativeElement,
        start: 'top 64px',
        refreshPriority: -1,
        onEnter: () => this.setNavDark(false),
        onLeaveBack: () => this.setNavDark(true),
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
 
    gsap.set(jetWrap, { xPercent: -50, yPercent: 0, scale: 1, force3D: true });
    if (blueprint) gsap.set(blueprint, { yPercent: 0, force3D: true });
    if (wordmark)  gsap.set(wordmark, { y: CFG.WORD_FROM_Y, opacity: 0, force3D: true });
    if (p1)        gsap.set(p1, { y: 0, opacity: 1 });
    if (specItems.length) gsap.set(specItems, { opacity: 0, y: 30 });
    if (cta)       gsap.set(cta, { opacity: 0, y: 30 });
 
    // FIX: no JS will-change toggling here anymore. The SCSS already promotes jet / blueprint /
    // wordmark / phase1 statically, so their layers exist BEFORE the section scrolls in and are
    // never torn down / rebuilt at the pin boundaries.
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: CFG.SCROLL_LENGTH,
        pin: true,
        scrub: this.scrubValue,
        anticipatePin: this.anticipate,
        invalidateOnRefresh: true,
        refreshPriority: 2,
        onEnter: () => {
          // The hero is completely off-screen now -> safe to drop its compositor layers.
          this.heroWarm?.(false);
          this.setNavDark(!this.prefersDark());
        },
        onLeaveBack: () => {
          // Going back up: re-promote the hero layers before it scrolls into view.
          this.heroWarm?.(true);
          this.setNavDark(true);
        },
        onUpdate: (self) => { if (progress) progress.style.transform = `scaleX(${self.progress})`; },
      },
    });
 
    tl.to(jetWrap, { xPercent: -50, yPercent: CFG.JET_END_Y, scale: CFG.JET_END_SCALE, ease: 'power1.in', duration: 0.75, force3D: true }, 0);
    if (blueprint) tl.to(blueprint, { yPercent: CFG.BLUEPRINT_END_Y, ease: 'power1.in', duration: 0.75, force3D: true }, 0);
    if (p1)        tl.to(p1, { opacity: 0, y: 40, ease: 'power1.out', duration: 0.30 }, 0);
    if (wordmark)  tl.to(wordmark, { y: CFG.WORD_TO_Y, opacity: 1, ease: 'power2.out', duration: 0.50, force3D: true }, 0.35);
    if (specItems.length) tl.to(specItems, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12, stagger: 0.02 }, 0.70);
    if (cta)       tl.to(cta, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.12 }, 0.85);
  }
 
  // ─── ROUTE STORY ──────────────────────────────────────────────────────────
  // Perf design:
  //  - NO SVG filter. The glow is a second, wider, translucent stroke.
  //  - The car + light cone are a plain HTML element moved with transform only.
  //  - The path is sampled ONCE into a lookup table. Scrolling only interpolates numbers.
  //  - Per-frame work = 3 style writes. Node markers and ghost words are touched only when
  //    their state really changes.
  //  - A plain ScrollTrigger (no timeline / proxy tween). Progress is 1:1 with the scroll.
  private buildRoute(isMobile: boolean): void {
    const section = this.routeSection?.nativeElement;
    const svg     = this.routeSvg?.nativeElement as SVGSVGElement | undefined;
    const car     = this.routeCar?.nativeElement;
    if (!section || !svg || !car) return;
 
    // ── Coordinate space = the SVG's real CSS box (viewBox always matches it) ──────────
    const box0 = svg.getBoundingClientRect();
    const W = box0.width  || window.innerWidth;
    const H = box0.height || window.innerHeight;
 
    // ── Layout flags ───────────────────────────────────────────────────────────
    const vertical = isMobile || window.matchMedia('(orientation: portrait)').matches;
 
    // ── Car size proportional to viewport width ────────────────────────────────
    const carW = W * (vertical ? 0.088 : 0.032);
    const carH = carW * (1030 / 472);   // suv-cutout.webp native ratio
    // The SCSS sizes the car + light cone from these two custom properties
    car.style.setProperty('--car-w', `${carW.toFixed(1)}px`);
    car.style.setProperty('--car-h', `${carH.toFixed(1)}px`);
 
    // ── Path: all coordinates are fractions of W × H ──────────────────────────
    // Vertical S (mobile/portrait): enters top-right → curves left → exits bottom-left
    // Wide S (desktop): enters bottom-left → curves right → exits top-right
    const x = (f: number) => (f * W).toFixed(1);
    const y = (f: number) => (f * H).toFixed(1);
 
    const d = vertical
      ? `M ${x(0.85)} ${y(0.08)} ` +
        `C ${x(0.12)} ${y(0.14)}, ${x(0.12)} ${y(0.38)}, ${x(0.50)} ${y(0.44)} ` +
        `S ${x(0.88)} ${y(0.60)}, ${x(0.50)} ${y(0.68)} ` +
        `S ${x(0.12)} ${y(0.82)}, ${x(0.15)} ${y(0.92)}`
      : `M ${x(0.06)} ${y(0.76)} ` +
        `C ${x(0.20)} ${y(0.30)}, ${x(0.33)} ${y(0.20)}, ${x(0.45)} ${y(0.39)} ` +
        `S ${x(0.70)} ${y(0.80)}, ${x(0.80)} ${y(0.53)} ` +
        `S ${x(0.90)} ${y(0.28)}, ${x(0.95)} ${y(0.21)}`;
 
    // ── Typography scaled to viewport ─────────────────────────────────────────
    const fTitle  = Math.round(W * (vertical ? 0.036 : 0.011));
    const fSub    = Math.round(W * (vertical ? 0.030 : 0.009));
    const margin  = W * 0.12;   // label is clamped so it never touches the edge
 
    const NODES = [
      { f: 0.14, title: 'Request confirmed',    sub: 'Jet, yacht or safari' },
      { f: 0.50, title: 'Funds held in escrow', sub: 'Zero financial risk' },
      { f: 0.86, title: 'Trip delivered',       sub: 'Funds released on arrival' },
    ];
 
    // ── Build SVG (static road + dashed line + glow/core trail). No <filter>. ──────────
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <path d="${d}" fill="none"
            stroke="rgba(255,255,255,0.045)" stroke-width="${(carW * 0.9).toFixed(1)}"
            stroke-linecap="round"/>
      <path d="${d}" fill="none"
            stroke="rgba(200,157,102,0.35)" stroke-width="2"
            stroke-dasharray="3 10" stroke-linecap="round"/>
      <path id="routeGlow" d="${d}" fill="none"
            stroke="#D9B97F" stroke-opacity="0.22" stroke-width="9"
            stroke-linecap="round"/>
      <path id="routeTrail" d="${d}" fill="none"
            stroke="#D9B97F" stroke-width="2.5"
            stroke-linecap="round"/>
      <g id="routeNodes"></g>`;
 
    const NS     = 'http://www.w3.org/2000/svg';
    const trail  = svg.querySelector('#routeTrail') as SVGPathElement;
    const glow   = svg.querySelector('#routeGlow')  as SVGPathElement;
    const nodesG = svg.querySelector('#routeNodes') as SVGGElement;
    const len    = trail.getTotalLength();
 
    const dash = String(len);
    trail.style.strokeDasharray = dash;  trail.style.strokeDashoffset = dash;
    glow.style.strokeDasharray  = dash;  glow.style.strokeDashoffset  = dash;
 
    // ── Milestone markers (created once, toggled only when their state changes) ────────
    const nodeEls: { ring: SVGCircleElement; dot: SVGCircleElement; label: SVGGElement }[] = [];
    NODES.forEach(n => {
      const pt  = trail.getPointAtLength(len * n.f);
      const lx  = Math.max(margin, Math.min(W - margin, pt.x));
      // Push label below the dot; on vertical layout it occasionally overlaps — offset by 8 % H
      const ly  = pt.y + H * (vertical ? 0.05 : 0.035);
 
      const ring = document.createElementNS(NS, 'circle') as SVGCircleElement;
      ring.setAttribute('cx', String(pt.x));  ring.setAttribute('cy', String(pt.y));
      ring.setAttribute('r', String(carW * 0.22));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#C89D66'); ring.setAttribute('stroke-width', '1.5');
      ring.setAttribute('opacity', '0');
 
      const dot = document.createElementNS(NS, 'circle') as SVGCircleElement;
      dot.setAttribute('cx', String(pt.x)); dot.setAttribute('cy', String(pt.y));
      dot.setAttribute('r', String(carW * 0.09));
      dot.setAttribute('fill', '#D9B97F'); dot.setAttribute('opacity', '0');
 
      const lbl = document.createElementNS(NS, 'g') as SVGGElement;
      lbl.setAttribute('opacity', '0');
      const t1 = document.createElementNS(NS, 'text') as SVGTextElement;
      t1.setAttribute('x', String(lx));       t1.setAttribute('y', String(ly));
      t1.setAttribute('text-anchor', 'middle');
      t1.setAttribute('font-family', 'Syne, sans-serif');
      t1.setAttribute('font-size', String(fTitle));
      t1.setAttribute('font-weight', '700');
      t1.setAttribute('fill', '#D9B97F');
      t1.textContent = n.title;
      const t2 = document.createElementNS(NS, 'text') as SVGTextElement;
      t2.setAttribute('x', String(lx));       t2.setAttribute('y', String(ly + fTitle + 3));
      t2.setAttribute('text-anchor', 'middle');
      t2.setAttribute('font-family', 'Inter, sans-serif');
      t2.setAttribute('font-size', String(fSub));
      t2.setAttribute('fill', 'rgba(250,247,242,0.55)');
      t2.textContent = n.sub;
      lbl.appendChild(t1); lbl.appendChild(t2);
 
      nodesG.appendChild(ring); nodesG.appendChild(dot); nodesG.appendChild(lbl);
      nodeEls.push({ ring, dot, label: lbl });
    });
 
    // ── Ghost words ───────────────────────────────────────────────────────────
    const words = Array.from(section.querySelectorAll('.route__word')) as HTMLElement[];
 
    // ── Path lookup table: sampled ONCE, interpolated per frame ───────────────────────
    // Layout: [x, y, angleDeg] per sample. Angles are unwrapped so linear interpolation
    // never spins the car the long way round at the ±180° seam.
    const N   = 600;
    const lut = new Float32Array((N + 1) * 3);
    const px: number[] = [];
    const py: number[] = [];
    for (let i = 0; i <= N; i++) {
      const pt = trail.getPointAtLength((len * i) / N);
      px.push(pt.x); py.push(pt.y);
    }
    let prevAng = 0;
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
      let ang = Math.atan2(py[b] - py[a], px[b] - px[a]) * (180 / Math.PI) + 90;
      if (i > 0) {
        while (ang - prevAng > 180)  ang -= 360;
        while (ang - prevAng < -180) ang += 360;
      }
      prevAng = ang;
      lut[i * 3] = px[i]; lut[i * 3 + 1] = py[i]; lut[i * 3 + 2] = ang;
    }
 
    // The car is positioned in px, the SVG scales with its box. Keep them in sync after a
    // resize/refresh (measured on refresh only, never per frame).
    let sx = 1, sy = 1;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      sx = r.width  / W || 1;
      sy = r.height / H || 1;
    };
 
    // ── Render: runs on scroll. 3 style writes; everything else only on state change ───
    const shown = [false, false, false];
    let lastWord = -1;
    let lastP = -1;
 
    const render = (progress: number, force = false) => {
      const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
      if (!force && p === lastP) return;
      lastP = p;
 
      // Car: interpolate the LUT, move by transform only (compositor layer)
      const f = p * N;
      const i = f >= N ? N - 1 : f | 0;
      const t = f - i;
      const o = i * 3;
      const cx  = (lut[o]     + (lut[o + 3] - lut[o])     * t) * sx;
      const cy  = (lut[o + 1] + (lut[o + 4] - lut[o + 1]) * t) * sy;
      const ang =  lut[o + 2] + (lut[o + 5] - lut[o + 2]) * t;
      car.style.transform =
        `translate3d(${(cx - carW / 2).toFixed(1)}px, ${(cy - carH / 2).toFixed(1)}px, 0) rotate(${ang.toFixed(2)}deg)`;
 
      // Trail draw (core + glow share the same offset)
      const off = String(len * (1 - p));
      trail.style.strokeDashoffset = off;
      glow.style.strokeDashoffset  = off;
 
      // Milestones: only touch the DOM when one flips
      for (let k = 0; k < NODES.length; k++) {
        const on = p >= NODES[k].f - 0.03;
        if (on === shown[k]) continue;
        shown[k] = on;
        const op = on ? '1' : '0';
        nodeEls[k].ring.setAttribute('opacity',  op);
        nodeEls[k].dot.setAttribute('opacity',   op);
        nodeEls[k].label.setAttribute('opacity', op);
      }
 
      // Ghost words: class toggle (CSS handles the fade) only when the active word changes
      const idx = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
      if (idx !== lastWord) {
        lastWord = idx;
        for (let k = 0; k < words.length; k++) words[k].classList.toggle('is-active', k === idx);
      }
    };
 
    this.ST.create({
      trigger: section,
      start: 'top top',
      end: isMobile ? '+=200%' : '+=250%',
      pin: true,
      anticipatePin: this.anticipate,
      refreshPriority: 1, // after hero (3) and ascent (2), before everything else
      onUpdate:  (self) => render(self.progress),
      onRefresh: (self) => { measure(); render(self.progress, true); },
      // The route background is dark, so the nav must be light here. When leaving it forward,
      // restore the previous behaviour (dark) for the sections below, until the value section.
      onEnter:     () => this.setNavDark(false),
      onLeave:     () => this.setNavDark(true),
      onEnterBack: () => this.setNavDark(false),
      onLeaveBack: () => this.setNavDark(!this.prefersDark()),
    });
 
    // Initial state: car at the path start, first word visible
    measure();
    render(0, true);
  }
 
  private initValueAnim(): void {
    const gsap = this.gsap;
    const cells = this.valueCells.toArray().map(r => r.nativeElement);
    this.ST.create({
      trigger: this.valueSection.nativeElement,
      start: 'top 80%',
      once: true,
      refreshPriority: -1, // refresh after the pinned sections above it (see buildHero)
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
    this.smoothScroll.unregister();
    this.mm?.revert();
    if (this.onSTRefresh) this.ST?.removeEventListener('refresh', this.onSTRefresh);
    this.ST?.getAll().forEach(t => t.kill());
    if (this.tickerCb && this.gsap) this.gsap.ticker.remove(this.tickerCb);
    this.lenis?.destroy();
    if (this.lenis) document.documentElement.style.scrollBehavior = this.prevScrollBehavior;
    this.heroWarm = undefined;
    if (this.onLoadRefresh) window.removeEventListener('load', this.onLoadRefresh);
    if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
  }
}