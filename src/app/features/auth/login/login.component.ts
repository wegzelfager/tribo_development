import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
  PLATFORM_ID, Inject, ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { AuthService } from '../../../core/services/auth.service';

type GSAPType = typeof import('gsap').gsap;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NavbarComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements AfterViewInit, OnDestroy {

  // ── UI state ──────────────────────────────────────────────────────────────
  errorMsg      = '';
  errorOk       = false;
  showPassword  = false;
  showCheckmark = false;
  buttonLabel   = 'Sign in';
  isSubmitting  = false;

  // ── Private ───────────────────────────────────────────────────────────────
  private gsap!: GSAPType;
  private prefersReducedMotion = false;
  private wantLabel  = 'Sign in';
  private revTimeout?: ReturnType<typeof setTimeout>;

  // ── ViewChilds ────────────────────────────────────────────────────────────
  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pwInput')    pwInput!:    ElementRef<HTMLInputElement>;
  @ViewChild('goBtn')      goBtn!:      ElementRef<HTMLButtonElement>;
  @ViewChild('labEl')      labEl!:      ElementRef<HTMLSpanElement>;
  @ViewChild('fillEl')     fillEl!:     ElementRef<HTMLSpanElement>;
  @ViewChild('okPath')     okPath!:     ElementRef<SVGPathElement>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.initGsap();
    });
  }

  ngOnDestroy(): void {
    if (this.revTimeout) clearTimeout(this.revTimeout);
  }

  private async initGsap(): Promise<void> {
    if (this.prefersReducedMotion) return;
    const { gsap } = await import('gsap');
    this.gsap = gsap;
    this.initHoverAnim();
  }

  private initHoverAnim(): void {
    const btn = this.goBtn?.nativeElement;
    if (!btn) return;
    const lift = (y: number, s: number) =>
      this.gsap.to(btn, { y, scale: s, duration: .35, ease: 'power3.out', overwrite: 'auto' });
    btn.addEventListener('pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse' && !btn.disabled) lift(-2, 1); });
    btn.addEventListener('pointerleave', ()                 => lift(0, 1));
    btn.addEventListener('pointerdown',  ()                 => { if (!btn.disabled) lift(0, .98); });
    btn.addEventListener('pointerup',    (e: PointerEvent) => { if (!btn.disabled) lift(e.pointerType === 'mouse' ? -2 : 0, 1); });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  togglePassword(): void {
    this.showPassword = !this.showPassword;
    const el = this.pwInput?.nativeElement;
    if (el) el.type = this.showPassword ? 'text' : 'password';
  }

  onInput(): void {
    this.errorMsg = '';
    this.emailInput?.nativeElement?.removeAttribute('aria-invalid');
    this.pwInput?.nativeElement?.removeAttribute('aria-invalid');
  }

  private fail(el: HTMLInputElement, msg: string): void {
    this.errorMsg = msg;
    this.errorOk  = false;
    this.emailInput?.nativeElement?.removeAttribute('aria-invalid');
    this.pwInput?.nativeElement?.removeAttribute('aria-invalid');
    el.setAttribute('aria-invalid', 'true');
    el.focus();
  }

  setLabel(t: string): void {
    if (t === this.wantLabel && this.buttonLabel === t) return;
    this.wantLabel = t;

    if (this.prefersReducedMotion || !this.gsap) {
      this.buttonLabel = t;
      this.cdr.markForCheck();
      return;
    }

    const lab = this.labEl?.nativeElement;
    if (!lab) {
      this.buttonLabel = t;
      this.cdr.markForCheck();
      return;
    }

    this.gsap.killTweensOf(lab);
    this.gsap.to(lab, {
      yPercent: -120, opacity: 0, duration: .2, ease: 'power2.in',
      onComplete: () => {
        this.ngZone.run(() => {
          this.buttonLabel = this.wantLabel;
          this.cdr.markForCheck();
        });
        this.gsap.fromTo(lab, { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .32, ease: 'power3.out' });
      }
    });
  }

  private showDone(): void {
    this.setLabel('Welcome back!');
    this.showCheckmark = true;

    if (!this.prefersReducedMotion && this.gsap) {
      this.gsap.to(this.fillEl.nativeElement, { opacity: 0, duration: .5 });
      this.gsap.fromTo(this.okPath.nativeElement,
        { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .5, delay: .3, ease: 'power2.out' });
    } else if (this.okPath?.nativeElement) {
      this.okPath.nativeElement.style.strokeDashoffset = '0';
    }

    this.revTimeout = setTimeout(() => {
      this.showCheckmark = false;
      this.setLabel('Sign in');
      if (!this.prefersReducedMotion && this.gsap)
        this.gsap.set(this.fillEl.nativeElement, { scaleX: 0, opacity: 1 });
    }, 2200);
  }

  login(): void {
    if (this.isSubmitting) return;

    const emailEl = this.emailInput?.nativeElement;
    const pwEl    = this.pwInput?.nativeElement;
    if (!emailEl || !pwEl) return;

    if (!/^\S+@\S+\.\S+$/.test(emailEl.value.trim())) {
      this.fail(emailEl, 'Enter a valid email address.'); return;
    }
    if (pwEl.value.length < 6) {
      this.fail(pwEl, 'Password must be at least 6 characters.'); return;
    }

    // Start submission
    this.isSubmitting = true;
    this.errorMsg     = '';
    this.showCheckmark = false;
    this.setLabel('Signing in…');
    clearTimeout(this.revTimeout);

    const btn  = this.goBtn?.nativeElement;
    const fill = this.fillEl?.nativeElement;
    if (btn) btn.disabled = true;

    if (!this.prefersReducedMotion && this.gsap && btn && fill) {
      this.gsap.to(btn,  { y: 0, scale: 1, duration: .2, overwrite: 'auto' });
      this.gsap.fromTo(fill, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 2.0, ease: 'power1.inOut' });
    }

    this.authService.login({
      email: emailEl.value.trim(),
      password: pwEl.value
    }).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.isSubmitting = false;
          if (btn) btn.disabled = false;
          this.showDone();
          this.errorMsg = 'Signed in successfully.';
          this.errorOk  = true;
          setTimeout(() => this.router.navigate(['/home']), 1500);
        });
      },
      error: (err: Error) => {
        this.ngZone.run(() => {
          this.isSubmitting = false;
          if (btn) btn.disabled = false;
          if (!this.prefersReducedMotion && this.gsap) {
            if (fill) {
              this.gsap.killTweensOf(fill);
              this.gsap.set(fill, { scaleX: 0, opacity: 1 });
            }
            const lab = this.labEl?.nativeElement;
            if (lab) {
              this.gsap.killTweensOf(lab);
              this.gsap.set(lab, { yPercent: 0, opacity: 1 });
            }
          }
          this.buttonLabel = 'Sign in';
          this.wantLabel = 'Sign in';
          this.fail(emailEl, err.message || 'Invalid email or password.');
          this.cdr.detectChanges();
        });
      }
    });
  }

  onFormKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT') { e.preventDefault(); this.login(); }
  }
}
