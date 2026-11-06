import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export type AppLang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly STORAGE_KEY = 'tribo_lang';
  private readonly SUPPORTED: AppLang[] = ['en', 'ar'];
  private readonly DEFAULT: AppLang = 'en';

  private _lang$ = new BehaviorSubject<AppLang>(this.DEFAULT);
  readonly lang$ = this._lang$.asObservable();

  get currentLang(): AppLang { return this._lang$.value; }
  get isRtl(): boolean { return this._lang$.value === 'ar'; }

  constructor(
    private translate: TranslateService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  /** Call once at bootstrap (from app.component or app.config). */
  init(): void {
    this.translate.addLangs(this.SUPPORTED);
    this.translate.setDefaultLang(this.DEFAULT);

    const saved = this.getSaved();
    this.applyLang(saved, false);
  }

  /** Toggle or set a specific language. */
  setLang(lang: AppLang): void {
    if (!this.SUPPORTED.includes(lang)) return;
    if (lang === this._lang$.value) return;
    this.applyLang(lang, true);
  }

  toggle(): void {
    this.setLang(this._lang$.value === 'en' ? 'ar' : 'en');
  }

  private applyLang(lang: AppLang, persist: boolean): void {
    this.translate.use(lang);
    this._lang$.next(lang);

    if (isPlatformBrowser(this.platformId)) {
      const html = document.documentElement;
      html.lang = lang;
      html.dir  = lang === 'ar' ? 'rtl' : 'ltr';
      if (persist) {
        try { localStorage.setItem(this.STORAGE_KEY, lang); } catch { /* private mode */ }
      }
      // Swap Arabic font class on body
      document.body.classList.toggle('lang-ar', lang === 'ar');
      document.body.classList.toggle('lang-en', lang !== 'ar');
    }
  }

  private getSaved(): AppLang {
    if (!isPlatformBrowser(this.platformId)) return this.DEFAULT;
    try {
      const v = localStorage.getItem(this.STORAGE_KEY) as AppLang | null;
      if (v && this.SUPPORTED.includes(v)) return v;
    } catch { /* ignore */ }
    // Browser language hint (only honour 'ar' — default is English)
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang === 'ar') return 'ar';
    return this.DEFAULT;
  }
}

