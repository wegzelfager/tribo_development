import {
  Component, AfterViewInit, OnDestroy, ElementRef,
  PLATFORM_ID, Inject, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
 
type GSAPType = typeof import('gsap').gsap;
type STType = typeof import('gsap/ScrollTrigger').ScrollTrigger;
type STInstance = ReturnType<STType['create']>;
 
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
    id: 'sky', word: 'SKY',
    title: 'Private jets',
    copy: 'Charter by the flight. Your payment stays in escrow until you land.',
    image: 'assets/images/process/process-01.webp',
    pos: 'center 60%',
    fallback: 'linear-gradient(180deg,#171a33 0%,#3a2f55 45%,#b9774f 62%,#120f14 62.1%,#0b0910 100%)',
  },
  {
    id: 'sea', word: 'SEA',
    title: 'Superyacht charters',
    copy: 'Crew, route and berth confirmed. Funds are released only when you step aboard.',
    image: 'assets/images/process/process-02.webp',
    pos: 'center 60%',
    fallback: 'linear-gradient(180deg,#1b2238 0%,#4a3a4a 50%,#c08052 62%,#0d2c33 62.1%,#08191d 100%)',
  },
  {
    id: 'land', word: 'LAND',
    title: 'Safari expeditions',
    copy: 'Guides and camps booked in advance. Payment is held until the trip begins.',
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
  readonly beats = [...SLIDES.map(s => s.word.charAt(0) + s.word.slice(1).toLowerCase()), 'Seal'];
 
  private gsap?: GSAPType;
  private trigger?: STInstance;
  private tickFn?: (time: number, deltaMs: number) => void;
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
    const seal = root.querySelector('.hz__seal') as HTMLElement;
    const sealDot = root.querySelector('.hz__seal-dot') as HTMLElement;
    const sealLabel = root.querySelector('.hz__seal-label') as HTMLElement;
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
      sealLabel.style.opacity = String(s);
      big.style.opacity = String(s);
      big.style.transform = `translate3d(0,${((1 - s) * 24).toFixed(1)}px,0)`;
      sealCopy.style.opacity = String(cl((s - 0.5) * 2, 0, 1));
 
      const beat = Math.min(N, Math.round(t));
      if (beat !== lastBeat) {
        lastBeat = beat;
        countNow.textContent = `0${beat + 1}`;
        beatBtns.forEach((b, k) => b.setAttribute('aria-current', k === beat ? 'true' : 'false'));
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
    this.trigger?.kill();
    if (this.gsap && this.tickFn) this.gsap.ticker.remove(this.tickFn);
  }
}
