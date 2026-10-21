import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
  PLATFORM_ID, Inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';

type GSAPType = typeof import('gsap').gsap;

interface Check {
  s:    number;
  el:   HTMLInputElement | null;
  file?: boolean;
  ok?:  (v: string) => boolean;
  msg:  string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, NavbarComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements AfterViewInit, OnDestroy {

  // ── Step state ────────────────────────────────────────────────────────────
  readonly STEPS      = 3;
  readonly stepLabels = ['About you', 'Account', 'Verify'];
  readonly leads = [
    'Create your account and start planning your first journey.',
    "Set up the details you'll use to sign in.",
    'Last step: verify your identity.'
  ];
  currentStep = 0;

  // ── UI state ──────────────────────────────────────────────────────────────
  errorMsg      = '';
  errorOk       = false;
  showStamp     = false;
  showCheckmark = false;
  buttonLabel   = 'Next';
  showPassword  = false;
  isSubmitting  = false;
  selectedRole: 'traveller' | 'organizer' = 'traveller';

  // ── Stub state ────────────────────────────────────────────────────────────
  passengerName  = 'Your name';
  passengerClass = 'Traveller';
  readyCount     = 0;

  // ── Upload tile state ─────────────────────────────────────────────────────
  photoHas = false; photoHint = 'Tap to upload';
  idfHas   = false; idfHint   = 'Tap to upload';
  idbHas   = false; idbHint   = 'Tap to upload';

  // ── Private ───────────────────────────────────────────────────────────────
  private gsap!: GSAPType;
  private prefersReducedMotion = false;
  private wantLabel  = 'Next';
  private photoUrl   = '';
  private idfUrl     = '';
  private idbUrl     = '';
  private revTimeout?: ReturnType<typeof setTimeout>;

  // ── ViewChilds ────────────────────────────────────────────────────────────
  @ViewChild('formEl')    formEl!:    ElementRef<HTMLFormElement>;
  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;
  @ViewChild('ageInput')  ageInput!:  ElementRef<HTMLInputElement>;
  @ViewChild('emailInput')emailInput!:ElementRef<HTMLInputElement>;
  @ViewChild('pwInput')   pwInput!:   ElementRef<HTMLInputElement>;
  @ViewChild('photoInput')photoInput!:ElementRef<HTMLInputElement>;
  @ViewChild('idfInput')  idfInput!:  ElementRef<HTMLInputElement>;
  @ViewChild('idbInput')  idbInput!:  ElementRef<HTMLInputElement>;
  @ViewChild('photoTile') photoTile!: ElementRef<HTMLLabelElement>;
  @ViewChild('idfTile')   idfTile!:   ElementRef<HTMLLabelElement>;
  @ViewChild('idbTile')   idbTile!:   ElementRef<HTMLLabelElement>;
  @ViewChild('goBtn')     goBtn!:     ElementRef<HTMLButtonElement>;
  @ViewChild('labEl')     labEl!:     ElementRef<HTMLSpanElement>;
  @ViewChild('fillEl')    fillEl!:    ElementRef<HTMLSpanElement>;
  @ViewChild('okPath')    okPath!:    ElementRef<SVGPathElement>;
  @ViewChild('planeEl')   planeEl!:   ElementRef<HTMLDivElement>;
  @ViewChild('trailEl')   trailEl!:   ElementRef<SVGPathElement>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.initGsap();
    });
  }

  ngOnDestroy(): void {
    [this.photoUrl, this.idfUrl, this.idbUrl].forEach(u => u && URL.revokeObjectURL(u));
    if (this.revTimeout) clearTimeout(this.revTimeout);
  }

  private async initGsap(): Promise<void> {
    if (!this.prefersReducedMotion) {
      const { gsap } = await import('gsap');
      this.gsap = gsap;
      this.initHoverAnim();
    }
    this.updateProgress();
    this.updateStub();
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

  // ── Checks ────────────────────────────────────────────────────────────────
  private get checks(): Check[] {
    return [
      { s:0, el: this.nameInput?.nativeElement,
        ok: v => v.trim().length > 0 && v.trim().length <= 50,
        msg: 'Enter your name (up to 50 characters).' },
      { s:0, el: this.ageInput?.nativeElement,
        ok: v => v !== '' && +v >= 18 && Math.floor(+v) === +v,
        msg: 'You must be 18 or older to join.' },
      { s:1, el: this.emailInput?.nativeElement,
        ok: v => /^\S+@\S+\.\S+$/.test(v.trim()),
        msg: 'Enter a valid email address.' },
      { s:1, el: this.pwInput?.nativeElement,
        ok: v => v.length >= 6,
        msg: 'Password must be at least 6 characters.' },
      { s:2, el: this.photoInput?.nativeElement, file: true, msg: 'Add a profile photo.' },
      { s:2, el: this.idfInput?.nativeElement,   file: true, msg: 'Add the front of your ID card.' },
      { s:2, el: this.idbInput?.nativeElement,   file: true, msg: 'Add the back of your ID card.' }
    ];
  }

  private isValid(c: Check): boolean {
    if (!c.el) return false;
    return c.file ? (c.el.files?.length ?? 0) > 0 : c.ok!(c.el.value);
  }

  private clearInvalid(): void {
    this.checks.forEach(c => c.el?.removeAttribute('aria-invalid'));
  }

  private fail(c: Check, msg?: string): void {
    this.clearInvalid();
    this.errorMsg = msg ?? c.msg;
    this.errorOk  = false;
    c.el?.setAttribute('aria-invalid', 'true');
    c.el?.focus();
  }

  // ── Step management ───────────────────────────────────────────────────────
  show(n: number, dir: number, quiet = false): void {
    this.currentStep = n;
    this.formEl?.nativeElement.style.setProperty('--dx', `${dir < 0 ? -18 : 18}px`);
    this.errorMsg = '';
    this.errorOk  = false;
    this.clearInvalid();
    this.setLabel(n < this.STEPS - 1 ? 'Next' : 'Create account');
    this.showCheckmark = false;
    if (!quiet) {
      setTimeout(() => {
        const panels = document.querySelectorAll<HTMLElement>('.reg-step');
        panels[n]?.querySelector<HTMLInputElement>('input')?.focus();
      }, 50);
    }
  }

  goBack(): void {
    if (this.currentStep > 0) this.show(this.currentStep - 1, -1);
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  updateProgress(): void {
    const n = this.checks.filter(c => this.isValid(c)).length;
    const p = (n / this.checks.length) * 100;
    this.readyCount = n;

    const plane = this.planeEl?.nativeElement;
    const trail = this.trailEl?.nativeElement;
    if (plane && !plane.classList.contains('fly'))
      plane.style.offsetDistance = `${p}%`;
    if (trail && !trail.classList.contains('fly'))
      trail.style.strokeDashoffset = `${100 - p}`;
  }

  // ── Stub live update ──────────────────────────────────────────────────────
  updateStub(): void {
    this.passengerName  = this.nameInput?.nativeElement?.value?.trim() || 'Your name';
    this.passengerClass = this.selectedRole === 'organizer' ? 'Organizer' : 'Traveller';
  }

  onInput(): void {
    this.errorMsg = '';
    this.clearInvalid();
    this.ngZone.runOutsideAngular(() => { this.updateProgress(); this.updateStub(); });
  }

  // ── Password toggle ───────────────────────────────────────────────────────
  togglePassword(): void {
    this.showPassword = !this.showPassword;
    const el = this.pwInput?.nativeElement;
    if (el) el.type = this.showPassword ? 'text' : 'password';
  }

  // ── File uploads ──────────────────────────────────────────────────────────
  onFileChange(which: 'photo' | 'idf' | 'idb', event: Event): void {
    const MAX   = 5 * 1024 * 1024;
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    const tileMap = { photo: this.photoTile, idf: this.idfTile, idb: this.idbTile };
    const tile  = tileMap[which]?.nativeElement;

    // Revoke old URL
    if (which === 'photo' && this.photoUrl) { URL.revokeObjectURL(this.photoUrl); this.photoUrl = ''; }
    if (which === 'idf'   && this.idfUrl)   { URL.revokeObjectURL(this.idfUrl);   this.idfUrl   = ''; }
    if (which === 'idb'   && this.idbUrl)   { URL.revokeObjectURL(this.idbUrl);   this.idbUrl   = ''; }

    // Reset state
    if (which === 'photo') { this.photoHas = false; this.photoHint = 'Tap to upload'; }
    if (which === 'idf')   { this.idfHas   = false; this.idfHint   = 'Tap to upload'; }
    if (which === 'idb')   { this.idbHas   = false; this.idbHint   = 'Tap to upload'; }
    if (tile) tile.style.backgroundImage = '';

    if (file && !/^image\//.test(file.type)) {
      input.value = '';
      this.fail({ s:2, el: input, msg: 'Choose an image file.' });
    } else if (file && file.size > MAX) {
      input.value = '';
      this.fail({ s:2, el: input, msg: 'Image must be under 5 MB.' });
    } else if (file) {
      const url = URL.createObjectURL(file);
      if (which === 'photo') { this.photoUrl = url; this.photoHas = true; this.photoHint = 'Tap to replace'; }
      if (which === 'idf')   { this.idfUrl   = url; this.idfHas   = true; this.idfHint   = 'Tap to replace'; }
      if (which === 'idb')   { this.idbUrl   = url; this.idbHas   = true; this.idbHint   = 'Tap to replace'; }
      if (tile) tile.style.backgroundImage = `url("${url}")`;
    }

    this.updateProgress();
  }

  // ── Button label animation ────────────────────────────────────────────────
  setLabel(t: string): void {
    if (t === this.wantLabel) return;
    this.wantLabel = t;
    if (this.prefersReducedMotion || !this.gsap) { this.buttonLabel = t; return; }

    const lab = this.labEl?.nativeElement;
    if (!lab) { this.buttonLabel = t; return; }

    this.gsap.killTweensOf(lab);
    this.gsap.to(lab, {
      yPercent: -120, opacity: 0, duration: .2, ease: 'power2.in',
      onComplete: () => {
        this.buttonLabel = this.wantLabel;
        this.gsap.fromTo(lab, { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .32, ease: 'power3.out' });
      }
    });
  }

  // ── Success animation ─────────────────────────────────────────────────────
  private showDone(): void {
    this.setLabel('Account created');
    this.showCheckmark = true;

    if (!this.prefersReducedMotion && this.gsap) {
      this.gsap.to(this.fillEl.nativeElement, { opacity: 0, duration: .5 });
      this.gsap.fromTo(this.okPath.nativeElement,
        { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .5, delay: .3, ease: 'power2.out' });
    } else if (this.okPath?.nativeElement) {
      this.okPath.nativeElement.style.strokeDashoffset = '0';
    }

    this.revTimeout = setTimeout(() => {
      if (this.currentStep !== this.STEPS - 1) return;
      this.showCheckmark = false;
      this.setLabel('Create account');
      if (!this.prefersReducedMotion && this.gsap)
        this.gsap.set(this.fillEl.nativeElement, { scaleX: 0, opacity: 1 });
    }, 2200);
  }

  // ── Main next/submit action ───────────────────────────────────────────────
  goNext(): void {
    if (this.isSubmitting) return;
    const isLast = this.currentStep === this.STEPS - 1;

    // Validate current step (or all steps on final submit)
    for (const c of this.checks) {
      if (!isLast && c.s !== this.currentStep) continue;
      if (!this.isValid(c)) {
        if (c.s !== this.currentStep) this.show(c.s, -1, true);
        this.fail(c); return;
      }
    }

    if (!isLast) { this.show(this.currentStep + 1, 1); return; }

    // ── Final submit ─────────────────────────────────────────────────────────
    this.isSubmitting = true;
    this.errorMsg     = '';
    this.showCheckmark = false;
    this.setLabel('Creating account…');
    clearTimeout(this.revTimeout);

    const btn   = this.goBtn?.nativeElement;
    const fill  = this.fillEl?.nativeElement;
    const plane = this.planeEl?.nativeElement;
    const trail = this.trailEl?.nativeElement;

    if (btn) btn.disabled = true;

    if (!this.prefersReducedMotion && this.gsap && btn && fill) {
      this.gsap.to(btn,  { y: 0, scale: 1, duration: .2, overwrite: 'auto' });
      this.gsap.fromTo(fill, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 2.5, ease: 'power1.inOut' });
    }

    this.showStamp = false;
    if (plane && trail) {
      plane.classList.remove('fly'); trail.classList.remove('fly');
      void plane.offsetWidth; // force reflow to restart animation
      plane.classList.add('fly');   trail.classList.add('fly');
      const onEnd = () => {
        plane.classList.remove('fly'); trail.classList.remove('fly');
        this.updateProgress();
        plane.removeEventListener('animationend', onEnd);
      };
      plane.addEventListener('animationend', onEnd);
    }

    // TODO: connect to backend
    // Build: const fd = new FormData();
    // fd.append('name', nameInput.value.trim()); fd.append('age', ageInput.value);
    // fd.append('email', emailInput.value.trim()); fd.append('password', pwInput.value);
    // fd.append('role', selectedRole);
    // fd.append('profileImage', photoInput.files[0]);
    // fd.append('idCardFront',  idfInput.files[0]);
    // fd.append('idCardBack',   idbInput.files[0]);
    // POST fd to /api/auth/register.
    // Server: map idCardFront/idCardBack → idCard.frontImage/backImage;
    // role comes from form (never allow "admin" from client);
    // isVerified and idCard.isVerified start false until manual review.
    setTimeout(() => {
      this.isSubmitting = false;
      if (btn) btn.disabled = false;
      this.showDone();
      this.errorMsg = 'Account created. Your ID is pending verification.';
      this.errorOk  = true;
      this.showStamp = true;
    }, 2600);
  }

  onFormKeydown(e: KeyboardEvent): void {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && t.type !== 'file') {
      e.preventDefault(); this.goNext();
    }
  }
}
