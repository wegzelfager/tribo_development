import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../core/services/trip.service';
import { TripFormData } from '../../../core/models/trip.model';
import { TripStepStepperComponent } from '../../organizer/pages/edit-trip/components/trip-step-stepper/trip-step-stepper.component';
import {
  TripLivePreviewComponent,
  ChecklistStatus,
} from '../../organizer/pages/edit-trip/components/trip-live-preview/trip-live-preview.component';

type AgeOption = 'any' | '12' | '16' | '18' | '21';

@Component({
  selector: 'app-create-trip-step1',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TripStepStepperComponent,
    TripLivePreviewComponent,
  ],
  templateUrl: './create-trip-step1.component.html',
  styleUrl: './create-trip-step1.component.scss',
})
export class CreateTripStep1Component implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly steps = ['Basics', 'Description', 'Itinerary', 'Pricing'];
  protected readonly currentStep = 1;

  protected submitting = signal(false);
  protected savingDraft = signal(false);
  protected errorMsg = signal('');
  protected titleCharCount = signal(0);

  /* Cover photo */
  protected coverFile: File | null = null;
  protected coverPreview: string | null = null;
  protected coverError = false;

  /* Additional photos */
  protected imageFiles: File[] = [];
  protected imagePreviews: string[] = [];

  /* Age restriction */
  protected selectedAge = signal<AgeOption>('any');
  protected readonly ageOptions: { value: AgeOption; label: string }[] = [
    { value: 'any', label: 'Any age' },
    { value: '12', label: '12+' },
    { value: '16', label: '16+' },
    { value: '18', label: '18+' },
    { value: '21', label: '21+' },
  ];

  protected form!: FormGroup;

  /* Computed live-preview inputs */
  protected get previewTitle(): string {
    return this.form?.get('title')?.value ?? '';
  }
  protected get previewLocation(): string {
    return this.form?.get('location')?.value ?? '';
  }
  protected get previewDuration(): number {
    return Number(this.form?.get('durationDays')?.value ?? 1);
  }
  protected get previewCapacity(): number {
    return Number(this.form?.get('maxCapacity')?.value ?? 10);
  }
  protected get previewAgeText(): string {
    const v = this.selectedAge();
    return v === 'any' ? 'All ages' : `${v}+`;
  }
  protected get checklist(): ChecklistStatus {
    const f = this.form;
    const titleVal: string = f?.get('title')?.value ?? '';
    const locVal: string = f?.get('location')?.value ?? '';
    const meetVal: string = f?.get('meetingPoint')?.value ?? '';
    return {
      titleDone: titleVal.trim().length > 0,
      locationDone: locVal.trim().length > 0,
      meetingDone: meetVal.trim().length > 0,
      coverDone: !!(this.coverFile || this.coverPreview),
    };
  }

  protected get requiredFieldsLeft(): number {
    let left = 0;
    if (!this.checklist.titleDone) left++;
    if (!this.checklist.locationDone) left++;
    if (!this.checklist.meetingDone) left++;
    if (!this.checklist.coverDone) left++;
    return left;
  }

  /** Empty placeholder tiles shown in the photo grid (up to 4) */
  protected get emptyPhotoTiles(): number[] {
    const addTile = this.imagePreviews.length < 10 ? 1 : 0;
    const filled = this.imagePreviews.length + addTile;
    const empty = Math.max(0, Math.min(4, 5 - filled));
    return Array.from({ length: empty }, (_, i) => i);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title:        ['', [Validators.required, Validators.maxLength(40)]],
      location:     ['', Validators.required],
      durationDays: [1,  [Validators.required, Validators.min(1), Validators.max(60)]],
      maxCapacity:  [10, [Validators.required, Validators.min(1), Validators.max(50)]],
      meetingPoint: ['', Validators.required],
    });

    this.form.get('title')?.valueChanges.subscribe((v: string) => {
      this.titleCharCount.set((v ?? '').length);
      this.cdr.markForCheck();
    });

    this.form.valueChanges.subscribe(() => this.cdr.markForCheck());
  }

  /* ── Age selection ──────────────────────────────────────── */
  protected selectAge(value: AgeOption): void {
    this.selectedAge.set(value);
  }

  /* ── Duration stepper ───────────────────────────────────── */
  protected decreaseDuration(): void {
    const ctrl = this.form.get('durationDays')!;
    const val = Number(ctrl.value);
    if (val > 1) ctrl.setValue(val - 1);
  }
  protected increaseDuration(): void {
    const ctrl = this.form.get('durationDays')!;
    const val = Number(ctrl.value);
    if (val < 60) ctrl.setValue(val + 1);
  }

  /* ── Group size stepper ─────────────────────────────────── */
  protected decreaseCapacity(): void {
    const ctrl = this.form.get('maxCapacity')!;
    const val = Number(ctrl.value);
    if (val > 1) ctrl.setValue(val - 1);
  }
  protected increaseCapacity(): void {
    const ctrl = this.form.get('maxCapacity')!;
    const val = Number(ctrl.value);
    if (val < 50) ctrl.setValue(val + 1);
  }

  /* ── Cover photo ────────────────────────────────────────── */
  protected onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && this.isValidImage(file)) this.setCoverFile(file);
  }

  protected onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.isValidImage(file)) this.setCoverFile(file);
    input.value = '';
  }

  protected removeCover(): void {
    this.coverFile = null;
    this.coverPreview = null;
    this.coverError = false;
    this.cdr.markForCheck();
  }

  protected triggerCoverInput(input: HTMLInputElement): void {
    input.click();
  }

  private setCoverFile(file: File): void {
    this.coverFile = file;
    this.coverError = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.coverPreview = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  private isValidImage(file: File): boolean {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  }

  /* ── Additional photos ──────────────────────────────────── */
  protected onMorePhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const remaining = 10 - this.imageFiles.length;
    const newFiles = Array.from(input.files).slice(0, remaining);
    newFiles.forEach(file => {
      this.imageFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  protected removeImage(index: number): void {
    this.imageFiles.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    this.cdr.markForCheck();
  }

  /* ── Validation ─────────────────────────────────────────── */
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  /* ── Submit / Draft ─────────────────────────────────────── */
  protected saveDraft(): void {
    // Save with minimal required fields; navigate to edit-trip for full editing
    this.router.navigate(['/organizer/trips']);
  }

  protected goNext(): void {
    this.form.markAllAsTouched();

    if (!this.coverFile) {
      this.coverError = true;
      this.cdr.markForCheck();
      return;
    }

    const invalid = ['title', 'location', 'durationDays', 'maxCapacity', 'meetingPoint']
      .some(f => this.form.get(f)?.invalid);
    if (invalid) return;

    // Build minimal trip data for step 1
    const raw = this.form.getRawValue();
    const ageVal = this.selectedAge();
    const ageRestriction = ageVal === 'any'
      ? { type: 'Any Age' as const }
      : { type: 'Custom Limit' as const, minAge: Number(ageVal), maxAge: 99 };

    const formData: TripFormData = {
      title:          raw['title'].trim(),
      location:       raw['location'].trim(),
      durationDays:   Number(raw['durationDays']),
      maxCapacity:    Number(raw['maxCapacity']),
      meetingPoint:   raw['meetingPoint'].trim(),
      ageRestriction,
      description:    '',
      highlights:     [],
      itinerary:      Array.from({ length: Number(raw['durationDays']) }, (_, i) => ({
        dayNumber: i + 1,
        dayTitle: `Day ${i + 1}`,
        activitySummary: '',
        timelineEvents: [],
      })),
      includedItems:  [],
      excludedItems:  [],
      pricePerPerson: 0,
    };

    const fd = this.tripService.buildTripFormData(formData, this.coverFile, this.imageFiles);

    this.submitting.set(true);
    this.errorMsg.set('');

    this.tripService.createTrip(fd).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const tripId = res.data.trip._id;
        // Navigate to edit-trip step 2 (Description)
        this.router.navigate(['/organizer/trips', tripId, 'edit']);
      },
      error: (err) => {
        this.submitting.set(false);
        let msg = 'An error occurred. Please try again.';
        if (err?.error?.errors?.length) {
          msg = err.error.errors
            .map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`)
            .join(' · ');
        } else if (err?.error?.message) {
          msg = err.error.message;
        }
        this.errorMsg.set(msg);
        this.cdr.markForCheck();
      },
    });
  }
}
