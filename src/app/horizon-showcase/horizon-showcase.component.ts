import {
  Component, AfterViewInit, OnDestroy, ElementRef,
  PLATFORM_ID, Inject, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type GSAPType = typeof import('gsap').gsap;
type STType = typeof import('gsap/ScrollTrigger').ScrollTrigger;
type STInstance = ReturnType<STType['create']>;
type GSTimeline = ReturnType<GSAPType['timeline']>;
type GSTween = ReturnType<GSAPType['to']>;

interface Slide {
  id: string;
  word: string;
  title: string;
  copy: string;
  image: string;
  pos: string;
  fallback: string;
}

const SLIDES: Slide[] = [
  {
    id: 'vetting', word: 'VETTING',
    title: 'Seamless vetting',
    copy: 'Applicant screening and one-click approval workflow, all in one place.',
    image: 'assets/images/process/process-01.webp',
    pos: 'center 60%',
    fallback: 'linear-gradient(180deg,#171a33 0%,#3a2f55 45%,#b9774f 62%,#120f14 62.1%,#0b0910 100%)',
  },
  {
    id: 'chat', word: 'CHAT',
    title: 'Real-time group chat',
    copy: 'Live WebSocket group messaging that keeps organizers and travelers aligned.',
    image: 'assets/images/process/process-02.webp',
    pos: 'center 60%',
    fallback: 'linear-gradient(180deg,#1b2238 0%,#4a3a4a 50%,#c08052 62%,#0d2c33 62.1%,#08191d 100%)',
  },
  {
    id: 'split', word: 'SPLIT',
    title: 'Dynamic split-billing',
    copy: 'Integrated, transparent expense splitting and cost tracking for the whole crew.',
    image: 'assets/images/process/process-03.webp',
    pos: 'center 60%',
    fallback: 'linear-gradient(180deg,#2a2236 0%,#6a4a3a 48%,#c9904e 62%,#2c1c0e 62.1%,#150d06 100%)',
  },
];

const SEG = [22, 50, 78, 100];

@Component({
  selector: 'app-horizon-showcase',
  standalone: true,
  templateUrl: './horizon-showcase.component.html',
  styleUrl: './horizon-showcase.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorizonShowcaseComponent implements AfterViewInit, OnDestroy {

  readonly slides = SLIDES;
  readonly beats = [...SLIDES.map(s => s.word.charAt(0) + s.word.slice(1).toLowerCase()), 'Gemini'];

  private gsap?: GSAPType;
  private trigger?: STInstance;
  private tickFn?: (time: number, deltaMs: number) => void;
  private igniteTl?: GSTimeline;
  private breatheTween?: GSTween;
  private destroyed = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private zone: NgZone,
    private host: ElementRef<HTMLElement>,
  ) {}

  goTo(beat: number): void {
    const sec = this.host.nativeElement.querySelector('.hz') as HTMLElement | null;
    if (!sec) return;
    const max = Math.max(1, sec.offsetHeight - window.innerHeight);
    const top = sec.getBoundingClientRect().top + window.scrollY + max * (beat / SLIDES.length);
    window.scrollTo({ top, behavior: 'auto' });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.zone.runOutsideAngular(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (this.destroyed) return;
      gsap.registerPlugin(ScrollTrigger);
      this.gsap = gsap;
      this.setup(gsap, ScrollTrigger);
    });
  }

  private setup(gsap: GSAPType, ST: STType): void {
    const root = this.host.nativeElement;
    const sec = root.querySelector('.hz') as HTMLElement;
    const row = root.querySelector('.hz__row') as HTMLElement;
    const panels = Array.from(row.children) as HTMLElement[];
    const pick = (sel: string) => panels.map(p => p.querySelector(sel) as HTMLElement);
    const words = pick('.hz__word');
    const labels = pick('.hz__label');
    const infos = pick('.hz__info');
    const fill = root.querySelector('.hz__fill') as HTMLElement;
    const linePulse = root.querySelector('.hz__line-pulse') as HTMLElement | null;
    const seal = root.querySelector('.hz__seal') as HTMLElement;
    const sealDot = root.querySelector('.hz__seal-dot') as HTMLElement;
    const sealGlow = root.querySelector('.hz__seal-glow') as HTMLElement | null;
    const sealSparkle = root.querySelector('.hz__seal-sparkle') as HTMLElement | null;
    const big = root.querySelector('.hz__big') as HTMLElement;
    const sealCopy = root.querySelector('.hz__seal-copy') as HTMLElement;
    const countNow = root.querySelector('.hz__count-now') as HTMLElement;
    const beatBtns = Array.from(root.querySelectorAll('.hz__beat')) as HTMLElement[];

    const N = panels.length;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const base = fine ? 0.2 : 0.11;

    const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const ez = (x: number) => x * x * (3 - 2 * x);
    const seg = (t: number) => {
      const i = Math.min(N - 1, Math.floor(t));
      return SEG[i] + (SEG[i + 1] - SEG[i]) * (t - i);
    };

    let cur = 0, tgt = 0, lastBeat = -1, first = true;
    let slide4Active = false;

    const playSlide4Ignite = () => {
      if (reduce) {
        if (sealGlow) gsap.set(sealGlow, { opacity: 0.65, scale: 1 });
        if (sealSparkle) gsap.set(sealSparkle, { opacity: 1, scale: 1 });
        return;
      }

      this.igniteTl?.kill();
      this.breatheTween?.kill();

      if (sealSparkle) sealSparkle.style.willChange = 'transform, opacity';
      if (sealGlow) sealGlow.style.willChange = 'transform, opacity';
      if (linePulse) linePulse.style.willChange = 'transform, opacity';

      const tl = gsap.timeline({
        onComplete: () => {
          if (sealSparkle) sealSparkle.style.willChange = 'auto';
          if (linePulse) {
            linePulse.style.willChange = 'auto';
            gsap.set(linePulse, { opacity: 0, scaleX: 0 });
          }
          if (slide4Active && sealGlow) {
            // Settle into idle breathing loop (4.8s total loop)
            this.breatheTween = gsap.to(sealGlow, {
              scale: 1.15,
              opacity: 0.85,
              duration: 2.4,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut'
            });
          }
        }
      });
      this.igniteTl = tl;

      // 1. Sparkle scales from 0.6 to 1 and fades in
      if (sealSparkle) {
        tl.fromTo(sealSparkle,
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' },
          0
        );
      }

      // 2. Glow fades in and pulses once
      if (sealGlow) {
        tl.fromTo(sealGlow,
          { scale: 0.7, opacity: 0 },
          { scale: 1.18, opacity: 0.95, duration: 0.45, ease: 'power2.out' },
          0
        ).to(sealGlow,
          { scale: 1.0, opacity: 0.65, duration: 0.65, ease: 'sine.inOut' },
          0.45
        );
      }

      // 3. Soft gradient pulse travels along the gold line from circle outward in both directions
      if (linePulse) {
        tl.fromTo(linePulse,
          { scaleX: 0, opacity: 0 },
          { scaleX: 0.35, opacity: 0.9, duration: 0.35, ease: 'power1.out' },
          0.05
        ).to(linePulse,
          { scaleX: 1.0, opacity: 0.75, duration: 0.55, ease: 'power2.out' },
          0.35
        ).to(linePulse,
          { opacity: 0, duration: 0.3, ease: 'power1.in' },
          0.85
        );
      }
    };

    const deactivateSlide4 = () => {
      this.igniteTl?.kill();
      this.breatheTween?.kill();
      this.igniteTl = undefined;
      this.breatheTween = undefined;

      if (sealSparkle) {
        sealSparkle.style.willChange = 'auto';
      }
      if (sealGlow) {
        sealGlow.style.willChange = 'auto';
        gsap.set(sealGlow, { opacity: 0, scale: 0.8 });
      }
      if (linePulse) {
        linePulse.style.willChange = 'auto';
        gsap.set(linePulse, { opacity: 0, scaleX: 0 });
      }
    };

    const render = (t: number) => {
      const s = ez(cl(t - (N - 1), 0, 1));
      row.style.gap = `${6 * (1 - s)}px`;

      for (let i = 0; i < N; i++) {
        const e = ez(cl(1 - Math.abs(t - i), 0, 1));
        panels[i].style.flexGrow = ((19 + 43 * e) * (1 - s) + (100 / N) * s).toFixed(2);
        words[i].style.opacity = (e * (1 - s)).toFixed(3);
        words[i].style.transform = `translate3d(0,${((1 - e) * 28).toFixed(1)}px,0)`;
        labels[i].style.opacity = ((1 - e) * (1 - s)).toFixed(3);
        infos[i].style.opacity = (cl((e - 0.5) * 2, 0, 1) * (1 - s)).toFixed(3);
      }

      const x = seg(t);
      fill.style.transform = `scaleX(${(x / 100).toFixed(4)})`;
      seal.style.left = `${(x * (1 - s) + 50 * s).toFixed(2)}%`;
      seal.style.setProperty('--s', `${(18 + 114 * s).toFixed(1)}px`);
      sealDot.style.opacity = String(1 - s);
      big.style.opacity = String(s);
      big.style.transform = `translate3d(0,${((1 - s) * 24).toFixed(1)}px,0)`;
      sealCopy.style.opacity = String(cl((s - 0.5) * 2, 0, 1));

      const beat = Math.min(N, Math.round(t));
      if (beat !== lastBeat) {
        lastBeat = beat;
        countNow.textContent = `0${beat + 1}`;
        beatBtns.forEach((b, k) => b.setAttribute('aria-current', k === beat ? 'true' : 'false'));
      }

      // ── Slide 04 state & ignite orchestration ──
      const isSlide4 = (beat === N);
      if (isSlide4 && !slide4Active) {
        slide4Active = true;
        if (!first) {
          playSlide4Ignite();
        } else {
          // Initial mount when already on slide 04: show static / settled state
          if (reduce) {
            if (sealGlow) gsap.set(sealGlow, { opacity: 0.65, scale: 1 });
            if (sealSparkle) gsap.set(sealSparkle, { opacity: 1, scale: 1 });
          } else {
            if (sealGlow) {
              gsap.set(sealGlow, { opacity: 0.65, scale: 1 });
              this.breatheTween = gsap.to(sealGlow, {
                scale: 1.15,
                opacity: 0.85,
                duration: 2.4,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
              });
            }
            if (sealSparkle) gsap.set(sealSparkle, { opacity: 1, scale: 1 });
          }
        }
      } else if (!isSlide4 && slide4Active) {
        slide4Active = false;
        deactivateSlide4();
      }

      if (!slide4Active && sealSparkle) {
        sealSparkle.style.opacity = String(s);
      }
    };

    this.trigger = ST.create({
      trigger: sec,
      start: 'top top',
      end: 'bottom bottom',
      refreshPriority: 0,
      onUpdate: (self) => { tgt = self.progress * N; },
      onRefresh: (self) => {
        tgt = self.progress * N;
        if (first) { first = false; cur = tgt; render(cur); }
      },
    });

    this.tickFn = (_time: number, deltaMs: number) => {
      const d = tgt - cur;
      if (Math.abs(d) < 0.0008) {
        if (cur !== tgt) { cur = tgt; render(cur); }
        return;
      }
      const k = reduce ? 1 : 1 - Math.pow(1 - base, Math.min(deltaMs || 16.7, 64) / 16.667);
      cur += d * k;
      render(cur);
    };
    gsap.ticker.add(this.tickFn);

    render(0);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.igniteTl?.kill();
    this.breatheTween?.kill();
    this.trigger?.kill();
    if (this.gsap && this.tickFn) this.gsap.ticker.remove(this.tickFn);
  }
}
