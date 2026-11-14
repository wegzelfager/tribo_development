import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../core/services/trip.service';
import { Trip, TripFormData } from '../../../../core/models/trip.model';
import { TripStepStepperComponent } from './components/trip-step-stepper/trip-step-stepper.component';
import {
  TripLivePreviewComponent,
  ChecklistStatus,
} from './components/trip-live-preview/trip-live-preview.component';

type AgeOption = 'any' | '12' | '16' | '18' | '21';

@Component({
  selector: 'app-edit-trip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TripStepStepperComponent,
    TripLivePreviewComponent,
  ],
  templateUrl: './edit-trip.component.html',
  styleUrl: './edit-trip.component.scss',
})
export class EditTripComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly steps = ['Basics', 'Description', 'Itinerary', 'Pricing'];

  protected tripId: string | null = null;
  protected currentStep = signal(1);
  protected loading = signal(false);
  protected submitting = signal(false);
  protected errorMsg = signal('');
  protected titleCharCount = signal(0);

  /* Cover & Images */
  protected coverFile: File | null = null;
  protected coverPreview: string | null = null;
  protected existingCoverUrl: string | null = null;
  protected imageFiles: File[] = [];
  protected imagePreviews: string[] = [];
  protected coverError = false;

  /* Age restriction */
  protected selectedAge = signal<AgeOption>('any');
  protected readonly ageOptions: { value: AgeOption; label: string }[] = [
    { value: 'any', label: 'Any age' },
    { value: '12', label: '12+' },
    { value: '16', label: '16+' },
    { value: '18', label: '18+' },
    { value: '21', label: '21+' },
  ];

  /* ── Presets for instant 1-click additions ──────────────── */
  protected readonly presetHighlights = [
    '4x4 Off-Road Dunes',
    'Desert Stargazing Camp',
    'Traditional Bedouin Meals',
    'Natural Oasis Springs',
    'Historical Landmark Tours',
    'Sunset Photography Stops',
  ];

  protected readonly presetTimelineEvents = [
    '07:00 AM · Convoy Departure',
    '12:30 PM · Traditional Oasis Lunch',
    '04:30 PM · Sunset Sandboarding',
    '07:30 PM · Fireside Dinner & Astronomy',
  ];

  protected readonly presetIncluded = [
    '4x4 Transport & Fuel',
    'All Meals & Bottled Water',
    'Camping Gear & Tents',
    'Certified Desert Guide',
    'National Park Permits',
  ];

  protected readonly presetExcluded = [
    'Personal Expenses & Souvenirs',
    'Travel & Medical Insurance',
    'Alcoholic & Soft Beverages',
    'Tips & Gratuities',
  ];

  protected form!: FormGroup;

  /* ── Computed Live-Preview properties ───────────────────── */
  protected get previewTitle(): string {
    return this.form?.get('title')?.value ?? '';
  }
  protected get previewLocation(): string {
    return this.form?.get('location')?.value ?? '';
  }
  protected get previewDuration(): number {
    return Number(this.form?.get('durationDays')?.value || 1);
  }
  protected get previewCapacity(): number {
    return Number(this.form?.get('maxCapacity')?.value || 10);
  }
  protected get previewPrice(): number {
    return Number(this.form?.get('pricePerPerson')?.value || 0);
  }
  protected get previewAgeText(): string {
    const v = this.selectedAge();
    return v === 'any' ? 'All ages' : `${v}+`;
  }

  /* ── Step 1 checklist ───────────────────────────────────── */
  protected get checklist(): ChecklistStatus {
    const f = this.form;
    const titleVal: string = f?.get('title')?.value ?? '';
    const locVal: string = f?.get('location')?.value ?? '';
    const meetVal: string = f?.get('meetingPoint')?.value ?? '';
    const hasCover = !!(this.coverFile || this.coverPreview || this.existingCoverUrl);
    return {
      titleDone: titleVal.trim().length > 0,
      locationDone: locVal.trim().length > 0,
      meetingDone: meetVal.trim().length > 0,
      coverDone: hasCover,
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

  /* ── Step 2 properties ──────────────────────────────────── */
  protected get descriptionLength(): number {
    return (this.form?.get('description')?.value ?? '').length;
  }
  protected get descriptionDone(): boolean {
    return (this.form?.get('description')?.value ?? '').trim().length >= 10;
  }
  protected get highlightsDone(): boolean {
    return this.highlights.length > 0;
  }
  protected get highlightsCount(): number {
    return this.highlights.length;
  }

  /* ── Step 3 properties ──────────────────────────────────── */
  protected get daysCount(): number {
    return this.itinerary.length;
  }
  protected get eventsCount(): number {
    return this.itinerary.controls.reduce(
      (acc, c) => acc + ((c as FormGroup).get('timelineEvents')?.value?.length || 0),
      0
    );
  }
  protected get itineraryDone(): boolean {
    return (
      this.itinerary.length > 0 &&
      this.itinerary.controls.every(c => !!(c as FormGroup).get('dayTitle')?.value?.trim())
    );
  }

  /* ── Step 4 properties ──────────────────────────────────── */
  protected get includedCount(): number {
    return this.includedItems.length;
  }
  protected get excludedCount(): number {
    return this.excludedItems.length;
  }

  ngOnInit(): void {
    this.tripId = this.route.snapshot.paramMap.get('id');
    this.buildForm();

    this.form.get('title')?.valueChanges.subscribe((v: string) => {
      this.titleCharCount.set((v ?? '').length);
      this.cdr.markForCheck();
    });

    this.form.valueChanges.subscribe(() => {
      this.cdr.markForCheck();
    });

    if (this.tripId) {
      this.loadTrip(this.tripId);
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      location: ['', Validators.required],
      durationDays: [1, [Validators.required, Validators.min(1), Validators.max(60)]],
      maxCapacity: [10, [Validators.required, Validators.min(1), Validators.max(50)]],
      meetingPoint: ['', Validators.required],
      ageRestriction: this.fb.group({
        type: ['Any Age'],
        minAge: [null],
        maxAge: [null],
      }),
      description: ['', Validators.required],
      highlights: this.fb.array([]),
      itinerary: this.fb.array([this.createDayGroup()]),
      pricePerPerson: [0, [Validators.required, Validators.min(0)]],
      includedItems: this.fb.array([]),
      excludedItems: this.fb.array([]),
    });
  }

  private createDayGroup(day?: { dayTitle?: string; activitySummary?: string; timelineEvents?: string[] }): FormGroup {
    return this.fb.group({
      dayTitle: [day?.dayTitle ?? '', Validators.required],
      activitySummary: [day?.activitySummary ?? ''],
      timelineEvents: [day?.timelineEvents ?? [] as string[]],
    });
  }

  private loadTrip(id: string): void {
    this.loading.set(true);
    this.tripService.getTripById(id).subscribe({
      next: (res) => {
        const t: Trip = res.data.trip;
        this.existingCoverUrl = t.coverImage ?? null;

        // Populate highlights
        const hlArray = this.form.get('highlights') as FormArray;
        hlArray.clear();
        (t.highlights ?? []).forEach(h => hlArray.push(this.fb.control(h)));

        // Populate itinerary
        const itArray = this.form.get('itinerary') as FormArray;
        itArray.clear();
        (t.itinerary ?? []).forEach(day => {
          itArray.push(this.createDayGroup({
            dayTitle: day.dayTitle,
            activitySummary: day.activitySummary,
            timelineEvents: day.timelineEvents ?? [],
          }));
        });
        if (itArray.length === 0) itArray.push(this.createDayGroup());

        // Populate includedItems / excludedItems
        const inclArray = this.form.get('includedItems') as FormArray;
        inclArray.clear();
        (t.includedItems ?? []).forEach(item => inclArray.push(this.fb.control(item)));

        const exclArray = this.form.get('excludedItems') as FormArray;
        exclArray.clear();
        (t.excludedItems ?? []).forEach(item => exclArray.push(this.fb.control(item)));

        // Images preview
        if (t.images?.length) {
          this.imagePreviews = [...t.images];
        }

        // Age
        if (t.ageRestriction?.type === 'Custom Limit') {
          const m = String(t.ageRestriction.minAge);
          if (['12', '16', '18', '21'].includes(m)) {
            this.selectedAge.set(m as AgeOption);
          } else {
            this.selectedAge.set('18');
          }
        } else {
          this.selectedAge.set('any');
        }

        this.form.patchValue({
          title: t.title,
          location: t.location,
          durationDays: t.durationDays,
          maxCapacity: t.maxCapacity,
          meetingPoint: t.meetingPoint,
          description: t.description,
          pricePerPerson: t.pricePerPerson,
          ageRestriction: {
            type: t.ageRestriction?.type ?? 'Any Age',
            minAge: t.ageRestriction?.minAge ?? null,
            maxAge: t.ageRestriction?.maxAge ?? null,
          },
        });

        this.titleCharCount.set((t.title ?? '').length);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMsg.set('Failed to load trip data. Please try again.');
        this.loading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Accessors ──────────────────────────────────────────────
  get highlights(): FormArray {
    return this.form.get('highlights') as FormArray;
  }

  get itinerary(): FormArray {
    return this.form.get('itinerary') as FormArray;
  }

  get includedItems(): FormArray {
    return this.form.get('includedItems') as FormArray;
  }

  get excludedItems(): FormArray {
    return this.form.get('excludedItems') as FormArray;
  }

  // ── Validation helpers ─────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  protected isDayInvalid(index: number, field: string): boolean {
    const dayGroup = this.itinerary.at(index) as FormGroup;
    const ctrl = dayGroup?.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  // ── Age selection ──────────────────────────────────────────
  protected selectAge(value: AgeOption): void {
    this.selectedAge.set(value);
    const ageGroup = this.form.get('ageRestriction') as FormGroup;
    if (value === 'any') {
      ageGroup.patchValue({ type: 'Any Age', minAge: null, maxAge: null });
    } else {
      ageGroup.patchValue({ type: 'Custom Limit', minAge: Number(value), maxAge: 99 });
    }
    this.cdr.markForCheck();
  }

  // ── Stepper controls (- / +) ──────────────────────────────
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

  // ── Cover Photo Upload & Drag-Drop ─────────────────────────
  protected onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && this.isValidImage(file)) this.setCoverFile(file);
  }

  protected onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onCoverChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.isValidImage(file)) this.setCoverFile(file);
    input.value = '';
  }

  protected removeCover(): void {
    this.coverFile = null;
    this.coverPreview = null;
    this.existingCoverUrl = null;
    this.coverError = false;
    this.cdr.markForCheck();
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

  // ── Additional Photos ──────────────────────────────────────
  protected onImagesChange(event: Event): void {
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

  // ── Highlights helpers ─────────────────────────────────────
  protected addHighlight(input: HTMLInputElement): void {
    const val = input.value.trim();
    if (!val) return;
    this.highlights.push(this.fb.control(val));
    input.value = '';
    this.cdr.markForCheck();
  }

  protected addPresetHighlight(text: string): void {
    if (!this.highlights.controls.some(c => c.value === text)) {
      this.highlights.push(this.fb.control(text));
      this.cdr.markForCheck();
    }
  }

  protected removeHighlight(index: number): void {
    this.highlights.removeAt(index);
    this.cdr.markForCheck();
  }

  // ── Inclusions helpers ─────────────────────────────────────
  protected addIncluded(input: HTMLInputElement): void {
    const val = input.value.trim();
    if (!val) return;
    this.includedItems.push(this.fb.control(val));
    input.value = '';
    this.cdr.markForCheck();
  }

  protected addPresetIncluded(text: string): void {
    if (!this.includedItems.controls.some(c => c.value === text)) {
      this.includedItems.push(this.fb.control(text));
      this.cdr.markForCheck();
    }
  }

  protected removeIncluded(index: number): void {
    this.includedItems.removeAt(index);
    this.cdr.markForCheck();
  }

  protected addExcluded(input: HTMLInputElement): void {
    const val = input.value.trim();
    if (!val) return;
    this.excludedItems.push(this.fb.control(val));
    input.value = '';
    this.cdr.markForCheck();
  }

  protected addPresetExcluded(text: string): void {
    if (!this.excludedItems.controls.some(c => c.value === text)) {
      this.excludedItems.push(this.fb.control(text));
      this.cdr.markForCheck();
    }
  }

  protected removeExcluded(index: number): void {
    this.excludedItems.removeAt(index);
    this.cdr.markForCheck();
  }

  // ── Itinerary helpers ──────────────────────────────────────
  protected addDay(): void {
    this.itinerary.push(this.createDayGroup());
    this.cdr.markForCheck();
  }

  protected removeDay(index: number): void {
    if (this.itinerary.length > 1) {
      this.itinerary.removeAt(index);
      this.cdr.markForCheck();
    }
  }

  protected syncDaysWithDuration(): void {
    const target = this.previewDuration;
    while (this.itinerary.length < target) {
      this.addDay();
    }
    this.cdr.markForCheck();
  }

  protected getDayEvents(index: number): string[] {
    return (this.itinerary.at(index) as FormGroup).get('timelineEvents')?.value ?? [];
  }

  protected addDayEvent(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    if (!val) return;
    const ctrl = (this.itinerary.at(index) as FormGroup).get('timelineEvents');
    if (ctrl) ctrl.setValue([...ctrl.value, val]);
    input.value = '';
    this.cdr.markForCheck();
  }

  protected addDayEventByBtn(index: number): void {
    const inputEl = document.getElementById('ev-' + index) as HTMLInputElement | null;
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (!val) return;
    const ctrl = (this.itinerary.at(index) as FormGroup).get('timelineEvents');
    if (ctrl) ctrl.setValue([...ctrl.value, val]);
    inputEl.value = '';
    this.cdr.markForCheck();
  }

  protected addPresetTimelineEvent(dayIndex: number, text: string): void {
    const ctrl = (this.itinerary.at(dayIndex) as FormGroup).get('timelineEvents');
    if (!ctrl) return;
    const current: string[] = ctrl.value || [];
    if (!current.includes(text)) {
      ctrl.setValue([...current, text]);
      this.cdr.markForCheck();
    }
  }

  protected removeDayEvent(dayIndex: number, eventIndex: number): void {
    const ctrl = (this.itinerary.at(dayIndex) as FormGroup).get('timelineEvents');
    if (!ctrl) return;
    const events: string[] = [...ctrl.value];
    events.splice(eventIndex, 1);
    ctrl.setValue(events);
    this.cdr.markForCheck();
  }

  // ── Step Navigation ────────────────────────────────────────
  private stepFields: Record<number, string[]> = {
    1: ['title', 'location', 'durationDays', 'maxCapacity', 'meetingPoint'],
    2: ['description'],
    3: [],
    4: ['pricePerPerson'],
  };

  protected onStepSelect(stepNumber: number): void {
    if (stepNumber < this.currentStep()) {
      this.currentStep.set(stepNumber);
      this.errorMsg.set('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected nextStep(): void {
    const fields = this.stepFields[this.currentStep()];
    fields.forEach(f => this.form.get(f)?.markAsTouched());

    if (this.currentStep() === 1) {
      if (!this.tripId && !this.coverFile && !this.existingCoverUrl) {
        this.coverError = true;
        this.cdr.markForCheck();
        return;
      }
    }

    const invalid = fields.some(f => this.form.get(f)?.invalid);
    if (invalid) {
      this.cdr.markForCheck();
      return;
    }

    if (this.currentStep() === 3) {
      this.itinerary.controls.forEach(ctrl => {
        (ctrl as FormGroup).get('dayTitle')?.markAsTouched();
      });
      const anyDayInvalid = this.itinerary.controls.some(
        ctrl => (ctrl as FormGroup).get('dayTitle')?.invalid
      );
      if (anyDayInvalid) return;

      const duration = Number(this.form.get('durationDays')?.value || 1);
      if (this.itinerary.length > duration) {
        this.errorMsg.set(
          `The itinerary has ${this.itinerary.length} days, but trip duration is set to ${duration} days in Step 1. Please adjust duration or remove extra days.`
        );
        return;
      }
    }

    this.currentStep.update(s => s + 1);
    this.errorMsg.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected prevStep(): void {
    this.currentStep.update(s => s - 1);
    this.errorMsg.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Submit ─────────────────────────────────────────────────
  protected onSubmit(): void {
    this.form.markAllAsTouched();

    if (!this.tripId && !this.coverFile && !this.existingCoverUrl) {
      this.coverError = true;
      this.currentStep.set(1);
      return;
    }

    if (this.form.invalid) {
      this.errorMsg.set('Please fix validation errors before submitting.');
      return;
    }

    const duration = Number(this.form.get('durationDays')?.value || 1);
    if (this.itinerary.length > duration) {
      this.errorMsg.set(
        `Trip duration (${duration} days) cannot be less than the number of days in the itinerary (${this.itinerary.length} days).`
      );
      this.currentStep.set(3);
      return;
    }

    const raw = this.form.getRawValue();

    const formData: TripFormData = {
      title: raw['title'].trim(),
      location: raw['location'].trim(),
      durationDays: Number(raw['durationDays']),
      maxCapacity: Number(raw['maxCapacity']),
      meetingPoint: raw['meetingPoint'].trim(),
      ageRestriction: raw['ageRestriction'],
      description: raw['description'].trim(),
      highlights: (raw['highlights'] as string[]),
      itinerary: (raw['itinerary'] as Array<{ dayTitle: string; activitySummary: string; timelineEvents: string[] }>).map(
        (d, i) => ({
          dayNumber: i + 1,
          dayTitle: d.dayTitle,
          activitySummary: d.activitySummary,
          timelineEvents: d.timelineEvents ?? [],
        })
      ),
      includedItems: raw['includedItems'] as string[],
      excludedItems: raw['excludedItems'] as string[],
      pricePerPerson: Number(raw['pricePerPerson']),
    };

    const fd = this.tripService.buildTripFormData(formData, this.coverFile, this.imageFiles);

    this.submitting.set(true);
    this.errorMsg.set('');

    const request$ = this.tripId
      ? this.tripService.updateTrip(this.tripId, fd)
      : this.tripService.createTrip(fd);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/organizer/trips']);
      },
      error: (err) => {
        this.submitting.set(false);
        let msg = 'An error occurred. Please try again.';
        if (err?.error?.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0) {
          msg = err.error.errors
            .map((e: any) => `${e.field ? '• ' + e.field + ': ' : '• '}${e.message}`)
            .join('\n');
        } else if (err?.error?.message) {
          msg = err.error.message;
        }
        this.errorMsg.set(msg);
        this.cdr.markForCheck();
      },
    });
  }
}