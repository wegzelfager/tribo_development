import {
  Component, AfterViewInit, OnDestroy, OnInit,
  ElementRef, ViewChild, NgZone,
  PLATFORM_ID, Inject, ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type GSAPType = typeof import('gsap').gsap;

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── UI state ──────────────────────────────────────────────────────────────
  errorMsg      = '';
  errorOk       = false;
  showPassword  = false;
  showConfirm   = false;
  showCheckmark = false;
  buttonLabel   = 'Reset password';
  isSubmitting  = false;

  /** Set when the token is missing/invalid before even calling the API */
  tokenError    = '';

  // ── Private ───────────────────────────────────────────────────────────────
  private token = '';
  private gsap!: GSAPType;
  private prefersReducedMotion = false;
  private wantLabel  = 'Reset password';
  private revTimeout?: ReturnType<typeof setTimeout>;

  // ── ViewChilds ────────────────────────────────────────────────────────────
  @ViewChild('pwInput')      pwInput!:      ElementRef<HTMLInputElement>;
  @ViewChild('confirmInput') confirmInput!: ElementRef<HTMLInputElement>;
  @ViewChild('goBtn')        goBtn!:        ElementRef<HTMLButtonElement>;
  @ViewChild('labEl')        labEl!:        ElementRef<HTMLSpanElement>;
  @ViewChild('fillEl')       fillEl!:       ElementRef<HTMLSpanElement>;
  @ViewChild('okPath')       okPath!:       ElementRef<SVGPathElement>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Backend sends link as: /reset-password?token=xxx   (query param)
    // Route param  :token is also supported as fallback
    const qToken = this.route.snapshot.queryParamMap.get('token');
    const pToken = this.route.snapshot.paramMap.get('token');
    this.token   = qToken || pToken || '';

    if (!this.token) {
      this.tokenError = 'Invalid or missing reset token. Please request a new reset link.';
    }
  }

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

  toggleConfirm(): void {
    this.showConfirm = !this.showConfirm;
    const el = this.confirmInput?.nativeElement;
    if (el) el.type = this.showConfirm ? 'text' : 'password';
  }

  onInput(): void {
    this.errorMsg = '';
    this.pwInput?.nativeElement?.removeAttribute('aria-invalid');
    this.confirmInput?.nativeElement?.removeAttribute('aria-invalid');
  }

  private fail(el: HTMLInputElement, msg: string): void {
    this.errorMsg = msg;
    this.errorOk  = false;
    this.pwInput?.nativeElement?.removeAttribute('aria-invalid');
    this.confirmInput?.nativeElement?.removeAttribute('aria-invalid');
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
    if (!lab) { this.buttonLabel = t; this.cdr.markForCheck(); return; }

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
    this.setLabel('Password updated!');
    this.showCheckmark = true;

    if (!this.prefersReducedMotion && this.gsap) {
      this.gsap.to(this.fillEl.nativeElement, { opacity: 0, duration: .5 });
      this.gsap.fromTo(this.okPath.nativeElement,
        { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .5, delay: .3, ease: 'power2.out' });
    } else if (this.okPath?.nativeElement) {
      this.okPath.nativeElement.style.strokeDashoffset = '0';
    }

    this.revTimeout = setTimeout(() => {
      this.router.navigate(['/auth/login']);
    }, 2200);
  }

  submit(): void {
    if (this.isSubmitting || this.tokenError) return;

    const pwEl      = this.pwInput?.nativeElement;
    const confirmEl = this.confirmInput?.nativeElement;
    if (!pwEl || !confirmEl) return;

    if (pwEl.value.length < 6) {
      this.fail(pwEl, 'Password must be at least 6 characters.'); return;
    }
    if (pwEl.value !== confirmEl.value) {
      this.fail(confirmEl, 'Passwords do not match.'); return;
    }

    this.isSubmitting  = true;
    this.errorMsg      = '';
    this.showCheckmark = false;
    this.setLabel('Resetting…');
    clearTimeout(this.revTimeout);

    const btn  = this.goBtn?.nativeElement;
    const fill = this.fillEl?.nativeElement;
    if (btn) btn.disabled = true;

    if (!this.prefersReducedMotion && this.gsap && btn && fill) {
      this.gsap.to(btn,  { y: 0, scale: 1, duration: .2, overwrite: 'auto' });
      this.gsap.fromTo(fill, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 2.0, ease: 'power1.inOut' });
    }

    this.authService.resetPassword(this.token, pwEl.value).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.isSubmitting = false;
          if (btn) btn.disabled = false;
          this.showDone();
          this.errorMsg = 'Password changed! Redirecting to login…';
          this.errorOk  = true;
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
          this.buttonLabel = 'Reset password';
          this.wantLabel   = 'Reset password';
          this.fail(pwEl, err.message || 'Failed to reset password. The link may have expired.');
          this.cdr.detectChanges();
        });
      }
    });
  }

  onFormKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT') { e.preventDefault(); this.submit(); }
  }
}

