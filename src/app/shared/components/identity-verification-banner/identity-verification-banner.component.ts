import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SocketService } from '../../../core/services/socket.service';

type RecoveryTab = 'manual' | 'photos';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-identity-verification-banner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './identity-verification-banner.component.html',
  styleUrl: './identity-verification-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityVerificationBannerComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly socketService = inject(SocketService);
  private readonly fb = inject(FormBuilder);
  private socketSub?: Subscription;

  readonly currentUser = this.authService.currentUserSignal;
  readonly verificationStatus = computed(() => this.currentUser()?.idCard?.verificationStatus ?? null);
  readonly verificationError = computed(
    () =>
      this.currentUser()?.idCard?.verificationError ||
      'We could not verify your Egyptian National ID automatically. Please verify your ID to unlock all features.'
  );

  readonly modalOpen = signal(false);
  readonly activeTab = signal<RecoveryTab>('manual');
  readonly isSubmitting = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly frontFile = signal<File | null>(null);
  readonly backFile = signal<File | null>(null);
  readonly frontPreview = signal<string | null>(null);
  readonly backPreview = signal<string | null>(null);

  readonly manualForm = this.fb.nonNullable.group({
    nationalId: [
      '',
      [Validators.required, Validators.pattern(/^[23]\d{13}$/)],
    ],
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.modalOpen() && !this.isSubmitting()) {
      this.closeModal();
    }
  }

  ngOnInit(): void {
    this.syncAndListenIfPending();
  }

  ngOnDestroy(): void {
    this.stopListening();
    this.revokePreviews();
  }

  openModal(): void {
    this.modalError.set(null);
    this.activeTab.set('manual');
    this.manualForm.reset({ nationalId: '' });
    this.clearFiles();
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSubmitting()) return;
    this.modalOpen.set(false);
    this.modalError.set(null);
    this.clearFiles();
  }

  setTab(tab: RecoveryTab): void {
    if (this.isSubmitting()) return;
    this.activeTab.set(tab);
    this.modalError.set(null);
  }

  onNationalIdInput(): void {
    if (this.modalError()) {
      this.modalError.set(null);
    }
  }

  onFileSelected(side: 'front' | 'back', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.modalError.set('Please select a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.modalError.set('Each ID photo must be 5 MB or smaller.');
      return;
    }

    this.modalError.set(null);
    const objectUrl = URL.createObjectURL(file);

    if (side === 'front') {
      const prev = this.frontPreview();
      if (prev) URL.revokeObjectURL(prev);
      this.frontFile.set(file);
      this.frontPreview.set(objectUrl);
    } else {
      const prev = this.backPreview();
      if (prev) URL.revokeObjectURL(prev);
      this.backFile.set(file);
      this.backPreview.set(objectUrl);
    }
  }

  removeFile(side: 'front' | 'back'): void {
    if (this.isSubmitting()) return;
    if (side === 'front') {
      const prev = this.frontPreview();
      if (prev) URL.revokeObjectURL(prev);
      this.frontFile.set(null);
      this.frontPreview.set(null);
    } else {
      const prev = this.backPreview();
      if (prev) URL.revokeObjectURL(prev);
      this.backFile.set(null);
      this.backPreview.set(null);
    }
  }

  submitManual(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const nationalId = this.manualForm.controls.nationalId.value.trim();
    this.isSubmitting.set(true);
    this.modalError.set(null);

    this.authService.verifyIdentityManual(nationalId).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.modalOpen.set(false);
        this.clearFiles();
        this.toastService.success(res.message || 'Identity verified successfully!');
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.modalError.set(err.message || 'Failed to verify National ID. Please check the number and try again.');
      },
    });
  }

  submitImages(): void {
    const front = this.frontFile();
    const back = this.backFile();

    if (!front && !back) {
      this.modalError.set('Please upload at least the front or back photo of your National ID.');
      return;
    }

    const formData = new FormData();
    if (front) formData.append('idCardFront', front);
    if (back) formData.append('idCardBack', back);

    this.isSubmitting.set(true);
    this.modalError.set(null);

    this.authService.verifyIdentityImages(formData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.modalOpen.set(false);
        this.clearFiles();
        this.toastService.info(
          res.message || 'ID photos uploaded! Verification is processing in the background.'
        );
        this.listenForVerificationUpdates();
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.modalError.set(err.message || 'Failed to upload ID photos. Please try again.');
      },
    });
  }

  private syncAndListenIfPending(): void {
    if (!this.authService.getCurrentUser()) return;
    this.authService.refreshCurrentUser().subscribe((user) => {
      if (user?.idCard?.verificationStatus === 'pending') {
        this.listenForVerificationUpdates();
      } else {
        this.stopListening();
      }
    });
  }

  private listenForVerificationUpdates(): void {
    if (this.socketSub) return;

    this.socketService.connect();
    this.socketSub = this.socketService
      .on<{ type?: string; message?: string }>('new_notification')
      .subscribe((notif) => {
        if (notif?.type !== 'user_verified' && notif?.type !== 'user_unverified') {
          return;
        }
        this.authService.refreshCurrentUser().subscribe((user) => {
          if (user?.idCard?.verificationStatus !== 'pending') {
            this.stopListening();
          }
        });
        if (notif.type === 'user_verified') {
          this.toastService.success(notif.message || 'Your National ID card has been verified.');
        } else {
          this.toastService.warning(notif.message || 'National ID verification failed. Please update your ID.');
        }
      });
  }

  private stopListening(): void {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
      this.socketSub = undefined;
    }
  }

  private clearFiles(): void {
    this.revokePreviews();
    this.frontFile.set(null);
    this.backFile.set(null);
  }

  private revokePreviews(): void {
    const f = this.frontPreview();
    if (f) URL.revokeObjectURL(f);
    const b = this.backPreview();
    if (b) URL.revokeObjectURL(b);
    this.frontPreview.set(null);
    this.backPreview.set(null);
  }
}
