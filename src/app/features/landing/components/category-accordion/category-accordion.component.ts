import {
  Component, OnInit, OnDestroy, HostListener,
  PLATFORM_ID, Inject, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DecimalPipe } from '@angular/common';

export interface AccordPanel {
  id:     string;
  word:   string;
  label:  string;
  desc:   string;
  img:    string;
  imgAlt: string;
  bg:     string;
}

@Component({
  selector: 'app-category-accordion',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './category-accordion.component.html',
  styleUrl:    './category-accordion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryAccordionComponent implements OnInit, OnDestroy {

  readonly panels: AccordPanel[] = [
    {
      id:     'sky',
      word:   'Sky',
      label:  'Private jets',
      desc:   'Charter by the flight. Your payment stays in escrow until you land.',
      img:    '/assets/images/jet-photoreal.webp',
      imgAlt: 'Private jet top-down view',
      bg:     '/assets/images/sky_view.webp',
    },
    {
      id:     'sea',
      word:   'Sea',
      label:  'Superyachts',
      desc:   'Sail with verified captains. Funds are released only after your voyage.',
      // ⚠ No yacht hero shot yet — uses side view (see summary).
      img:    '/assets/images/yacht-side.png',
      imgAlt: 'Luxury superyacht',
      bg:     '/assets/images/sky-day.png',   // placeholder; replace with ocean image
    },
    {
      id:     'land',
      word:   'Land',
      label:  'Safari & ground',
      desc:   'Private transfers and expeditions, confirmed before you pay in full.',
      img:    '/assets/images/suv-cutout.webp',
      imgAlt: 'Luxury 4×4 SUV',
      bg:     '/assets/images/sky-dusk.png',
    },
    {
      id:     'seal',
      word:   'Seal',
      label:  'Secure escrow',
      desc:   'Every transaction sealed in escrow until delivery is confirmed.',
      img:    '/assets/images/plane-q90.webp',
      imgAlt: 'Tribo secure seal illustration',
      bg:     '/assets/images/sky-dawn.png',
    },
  ];

  activeIndex = 0;
  isMobile    = false;

  private autoTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private cdr: ChangeDetectorRef,
  ) {}

  get activePanel(): AccordPanel { return this.panels[this.activeIndex]; }

  /** Knob offset as a % for the progress track */
  get knobPosition(): number {
    return (this.activeIndex / (this.panels.length - 1)) * 100;
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.checkMobile();
    // Auto-advance every 5 s when not interacted with
    this.autoTimer = setInterval(() => {
      this.setActive((this.activeIndex + 1) % this.panels.length);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
  }

  @HostListener('window:resize')
  onResize(): void { if (isPlatformBrowser(this.platformId)) this.checkMobile(); }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  setActive(i: number): void {
    if (i === this.activeIndex) return;
    this.activeIndex = i;
    // Reset auto-advance timer on user interaction
    if (this.autoTimer) { clearInterval(this.autoTimer); }
    this.autoTimer = setInterval(() => {
      this.setActive((this.activeIndex + 1) % this.panels.length);
    }, 5000);
    this.cdr.markForCheck();
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.setActive((this.activeIndex + 1) % this.panels.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.setActive((this.activeIndex - 1 + this.panels.length) % this.panels.length);
    }
  }
}
