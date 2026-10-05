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
  // FIX: anticipatePin is only useful for native (touch) scroll, where the compositor
  // scrolls a frame ahead of JS. With Lenis (scroll driven from the GSAP ticker) it makes
  // the pin engage EARLY (position:fixed before the scroll reaches the start), which shows
  // up as the section jumping up and then settling at every pin hand-off.
  // Must be decided BEFORE the ScrollTriggers are created (it is read once at creation).
  private anticipate = 1;
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
      // force3D left at the default "auto": it promotes elements only while animating
      // (force3D: true would keep every animated element on its own GPU layer permanently).
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
 
    // "@studio-freight/lenis" was renamed to "lenis" (npm i lenis)
    const { default: Lenis } = await import('lenis');
    this.lenis = new (Lenis as any)({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: false, // we drive it from the GSAP ticker below
    }) as LenisInstance;
 
    this.scrubValue = true; // 1:1 with Lenis' already-smoothed scroll
    this.anticipate = 0;    // FIX: Lenis drives scroll from the same ticker, nothing to anticipate
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
 
    const jetStartY = isMobile ? 40 : 100;  // desktop: fully below the bottom edge
    const jetEndY   = isMobile ? -50 : 50;  // desktop: half of the car below the bottom edge
    if (jetWrap) gsap.set(jetWrap, { xPercent: -50, yPercent: isMobile ? -50 : jetStartY });
    gsap.set(wrap, { x: 0, y: 0, transformOrigin: 'center center' });
 
    // The zoom is computed from the real aperture size instead of a fixed 9.
    // Fixed 9 shows the edges on wide screens (>~1700px) and over-scales on phones
    // (a bigger scale = a bigger GPU surface for nothing).
    // offsetWidth/Height ignore transforms, so this is safe even mid-entrance.
    const zoomTarget = (): number => {
      if (!sky || !sky.offsetWidth || !sky.offsetHeight) return isMobile ? 6 : 9;
      const cover = Math.max(window.innerWidth / sky.offsetWidth, window.innerHeight / sky.offsetHeight);
      return cover * 1.6; // the aperture is an ellipse: x1.6 so the screen corners are covered too (enlarged sky layer)
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
        anticipatePin: this.anticipate, // FIX: 0 with Lenis, 1 for native (touch) scroll
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
    // The ring sits inside `wrap`, which is already scaled, so scaling it x10 on top
    // only made a huge box-shadow surface. Fade it out instead.
    if (ring) tl.to(ring, { opacity: 0, ease: 'power1.out', duration: 0.2 }, 0);
    tl.to(bg, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 0.15);
 
    // STAGE 2: cloud text. autoAlpha (opacity + visibility) so that hidden
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
        { xPercent: -50, yPercent: jetStartY, scale: 0.8 },
        { xPercent: -50, yPercent: jetEndY, scale: 1, ease: 'power2.out', duration: 0.38 }, 0.52);
    }
    if (cards.length) {
      tl.fromTo(cards, { y: 35, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, ease: 'back.out(1.4)', duration: 0.18 }, 0.68);
    }
 
    threshold = 0.52 / tl.duration();
 
    // refreshPriority -1: this trigger measures the value section, which sits AFTER
    // the pinned sections. If it refreshes before their pin-spacers exist, its start
    // position is wrong (nav stays dark/light at the wrong time, especially after resize).
    if (nav && this.valueSection) {
      this.ST.create({
        trigger: this.valueSection.nativeElement,
        start: 'top 64px',
        refreshPriority: -1,
        onEnter: () => nav.classList.remove('nav--dark'),
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
        anticipatePin: this.anticipate, // FIX: 0 with Lenis, 1 for native (touch) scroll
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
 
  // ─── ROUTE STORY ──────────────────────────────────────────────────────────
  private buildRoute(isMobile: boolean): void {
    const gsap    = this.gsap;
    const section = this.routeSection?.nativeElement;
    const svg     = this.routeSvg?.nativeElement as SVGSVGElement | undefined;
    if (!section || !svg) return;
 
    // ── Real viewport dimensions — viewBox always matches the CSS box ──────────
    // clientWidth/Height are set after layout; fall back to window if 0 (e.g. SSR).
    const W = section.clientWidth  || window.innerWidth;
    const H = section.clientHeight || window.innerHeight;
 
    // ── Layout flags ───────────────────────────────────────────────────────────
    const vertical = isMobile || window.matchMedia('(orientation: portrait)').matches;
 
    // ── Car size proportional to viewport width ────────────────────────────────
    const carW    = W * (vertical ? 0.088 : 0.032);
    const carH    = carW * (1030 / 472);   // suv-cutout.webp native ratio
    const coneEnd = carH * 2.1;
    const cone    = `${-carW * 0.35},${-carH / 2} ${carW * 0.35},${-carH / 2} ${carW * 1.3},${-coneEnd} ${-carW * 1.3},${-coneEnd}`;
 
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
 
    // ── Build SVG ─────────────────────────────────────────────────────────────
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="routeCone" gradientUnits="userSpaceOnUse"
            x1="0" y1="${-carH / 2}" x2="0" y2="${-coneEnd}">
          <stop offset="0" stop-color="#FFEBC2" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#FFEBC2" stop-opacity="0"/>
        </linearGradient>
        <filter id="routeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="${d}" fill="none"
            stroke="rgba(255,255,255,0.045)" stroke-width="${(carW * 0.9).toFixed(1)}"
            stroke-linecap="round"/>
      <path d="${d}" fill="none"
            stroke="rgba(200,157,102,0.35)" stroke-width="2"
            stroke-dasharray="3 10" stroke-linecap="round"/>
      <path id="routeTrail" d="${d}" fill="none"
            stroke="#D9B97F" stroke-width="2.5"
            stroke-linecap="round" filter="url(#routeGlow)"/>
      <g id="routeNodes"></g>
      <g id="routeCar">
        <polygon points="${cone}" fill="url(#routeCone)"/>
        <image href="assets/images/suv-cutout.webp"
               x="${(-carW / 2).toFixed(1)}" y="${(-carH / 2).toFixed(1)}"
               width="${carW.toFixed(1)}" height="${carH.toFixed(1)}"/>
      </g>`;
 
    const NS     = 'http://www.w3.org/2000/svg';
    const trail  = svg.querySelector('#routeTrail') as SVGPathElement;
    const carEl  = svg.querySelector('#routeCar')   as SVGGElement;
    const nodesG = svg.querySelector('#routeNodes') as SVGGElement;
    const len    = trail.getTotalLength();
 
    trail.style.strokeDasharray  = `${len}`;
    trail.style.strokeDashoffset = `${len}`;
 
    // ── Milestone markers ──────────────────────────────────────────────────────
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
 
    // ── Scrub proxy ───────────────────────────────────────────────────────────
    const proxy = { p: 0 };
 
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: isMobile ? '+=200%' : '+=250%',
        pin: true,
        scrub: this.scrubValue,
        anticipatePin: this.anticipate, // FIX: 0 with Lenis, 1 for native (touch) scroll
        invalidateOnRefresh: true,
      },
      onUpdate: () => {
        const p = proxy.p;
 
        // Trail draw
        trail.style.strokeDashoffset = String(len * (1 - p));
 
        // Car position + tangent rotation
        const a0 = Math.max(0, Math.min(len - 0.01, len * p));
        const a1 = Math.max(0, Math.min(len,         len * p + 0.5));
        const pos  = trail.getPointAtLength(a0);
        const pos2 = trail.getPointAtLength(a1);
        const angle = Math.atan2(pos2.y - pos.y, pos2.x - pos.x) * (180 / Math.PI) + 90;
        carEl.setAttribute('transform', `translate(${pos.x},${pos.y}) rotate(${angle})`);
 
        // Milestone reveals
        NODES.forEach((n, i) => {
          const op = p >= n.f - 0.03 ? '1' : '0';
          nodeEls[i].ring.setAttribute('opacity',  op);
          nodeEls[i].dot.setAttribute('opacity',   op);
          nodeEls[i].label.setAttribute('opacity', op);
        });
 
        // Ghost word crossfade
        const idx = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
        words.forEach((w, i) => gsap.set(w, {
          opacity: i === idx ? 1 : 0,
          visibility: i === idx ? 'visible' : 'hidden',
        }));
      },
    });
 
    tl.to(proxy, { p: 1, duration: 1, ease: 'none' });
 
    // Set initial car at path start
    const p0 = trail.getPointAtLength(0);
    carEl.setAttribute('transform', `translate(${p0.x},${p0.y}) rotate(0)`);
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
    this.mm?.revert();
    this.ST?.getAll().forEach(t => t.kill());
    if (this.tickerCb && this.gsap) this.gsap.ticker.remove(this.tickerCb);
    this.lenis?.destroy();
    if (this.onLoadRefresh) window.removeEventListener('load', this.onLoadRefresh);
    if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
  }
}