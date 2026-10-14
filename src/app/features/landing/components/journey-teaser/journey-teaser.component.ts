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
  @ViewChild('sectionEl') private sectionEl!: ElementRef<HTMLElement>;
  @ViewChild('innerEl')   private innerEl!:   ElementRef<HTMLElement>;
  @ViewChild('headlineEl')private headlineEl!:ElementRef<HTMLElement>;

  private resizeObs?: ResizeObserver;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => {
      this.initFit();
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  private initFit(): void {
    const section = this.sectionEl.nativeElement;

    // Run on init
    this.fit();

    // ResizeObserver on the section container
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.fit());
      this.resizeObs.observe(section);
    }

    // Recalculate once web fonts finish loading
    if (typeof document !== 'undefined' && document.fonts?.load) {
      document.fonts.load('800 100px Syne').then(() => {
        this.fit();
      });
    }

    // Preload 3D model when idle
    if (typeof document !== 'undefined' && !document.querySelector('link[href*="plane.glb"]')) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = '/assets/plane.glb';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
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

    const pad = parseFloat(window.getComputedStyle(inner).paddingLeft) || 0;
    const avail = W - 2 * pad;
    const wide = avail >= 640 && W / H > 1.25;

    section.setAttribute('data-layout', wide ? 'wide' : 'narrow');
    if (H < 480) {
      section.setAttribute('data-short', '');
    } else {
      section.removeAttribute('data-short');
    }

    // Probe widest line width at 100px
    h1.style.setProperty('--fs', '100px');
    const w100 = h1.getBoundingClientRect().width;
    if (!w100) return;

    const lines = wide ? 2 : 4;
    const reserve = Math.min(300, H * 0.42);
    const fs = Math.max(18, Math.min(
      (avail * 0.985 / w100) * 100,
      (H - reserve) / (lines * 0.98),
      wide ? 150 : 112
    ));

    h1.style.setProperty('--fs', `${fs.toFixed(2)}px`);
  }
}
