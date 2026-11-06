import {
  Component, OnInit, OnDestroy, HostListener,
  PLATFORM_ID, Inject, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

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
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './category-accordion.component.html',
  styleUrl:    './category-accordion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryAccordionComponent implements OnInit, OnDestroy {

  panels: AccordPanel[] = [];

  activeIndex = 0;
  isMobile    = false;

  private autoTimer?: ReturnType<typeof setInterval>;
  private langSub?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  get activePanel(): AccordPanel { return this.panels[this.activeIndex]; }

  /** Knob offset as a % for the progress track */
  get knobPosition(): number {
    return (this.activeIndex / (this.panels.length - 1)) * 100;
  }

  ngOnInit(): void {
    this.buildPanels();
    // Re-build panels whenever the language changes
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.buildPanels();
      this.cdr.markForCheck();
    });

    if (!isPlatformBrowser(this.platformId)) return;
    this.checkMobile();
    // Auto-advance every 5 s when not interacted with
    this.autoTimer = setInterval(() => {
      this.setActive((this.activeIndex + 1) % this.panels.length);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.langSub?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void { if (isPlatformBrowser(this.platformId)) this.checkMobile(); }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private buildPanels(): void {
    const t = (key: string) => this.translate.instant(key);
    this.panels = [
      {
        id:     'sky',
        word:   t('accordion.sky_word'),
        label:  t('accordion.sky_label'),
        desc:   t('accordion.sky_desc'),
        img:    '/assets/images/jet-photoreal.webp',
        imgAlt: t('accordion.sky_img_alt'),
        bg:     '/assets/images/sky_view.webp',
      },
      {
        id:     'sea',
        word:   t('accordion.sea_word'),
        label:  t('accordion.sea_label'),
        desc:   t('accordion.sea_desc'),
        img:    '/assets/images/yacht-side.png',
        imgAlt: t('accordion.sea_img_alt'),
        bg:     '/assets/images/sky-day.png',
      },
      {
        id:     'land',
        word:   t('accordion.land_word'),
        label:  t('accordion.land_label'),
        desc:   t('accordion.land_desc'),
        img:    '/assets/images/suv-cutout.webp',
        imgAlt: t('accordion.land_img_alt'),
        bg:     '/assets/images/sky-dusk.png',
      },
      {
        id:     'seal',
        word:   t('accordion.seal_word'),
        label:  t('accordion.seal_label'),
        desc:   t('accordion.seal_desc'),
        img:    '/assets/images/plane-q90.webp',
        imgAlt: t('accordion.seal_img_alt'),
        bg:     '/assets/images/sky-dawn.png',
      },
    ];
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
