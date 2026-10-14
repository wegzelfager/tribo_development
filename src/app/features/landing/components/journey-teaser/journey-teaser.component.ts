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
  @ViewChild('content') private content!: ElementRef<HTMLElement>;

  private obs?: IntersectionObserver;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => this.initReveal());
  }

  ngOnDestroy(): void { this.obs?.disconnect(); }

  private initReveal(): void {
    const el = this.content.nativeElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { el.classList.add('teaser__content--visible'); return; }

    this.obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        el.classList.add('teaser__content--visible');
        this.obs?.disconnect();
      }
    }, { threshold: 0.15 });
    this.obs.observe(el);
  }
}
