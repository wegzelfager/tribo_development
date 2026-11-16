import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

export interface ChecklistStatus {
  titleDone: boolean;
  locationDone: boolean;
  meetingDone: boolean;
  coverDone: boolean;
}

@Component({
  selector: 'app-trip-live-preview',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-live-preview.component.html',
  styleUrl: './trip-live-preview.component.scss',
})
export class TripLivePreviewComponent {
  @Input() currentStep = 1;
  @Input() title = '';
  @Input() location = '';
  @Input() durationDays = 1;
  @Input() maxCapacity = 10;
  @Input() ageText = 'All ages';
  @Input() coverPreview: string | null = null;
  @Input() existingCoverUrl: string | null = null;
  @Input() price = 0;

  /* Step 1 checklist */
  @Input() checklist: ChecklistStatus = {
    titleDone: false,
    locationDone: false,
    meetingDone: false,
    coverDone: false,
  };

  /* Step 2 inputs */
  @Input() descriptionDone = false;
  @Input() descriptionLength = 0;
  @Input() highlightsDone = false;
  @Input() highlightsCount = 0;

  /* Step 3 inputs */
  @Input() itineraryDone = false;
  @Input() daysCount = 1;
  @Input() eventsCount = 0;

  /* Step 4 inputs */
  @Input() includedCount = 0;
  @Input() excludedCount = 0;

  get doneCount(): number {
    let count = 0;
    if (this.checklist.titleDone) count++;
    if (this.checklist.locationDone) count++;
    if (this.checklist.meetingDone) count++;
    if (this.checklist.coverDone) count++;
    return count;
  }

  get isAllDone(): boolean {
    return this.doneCount === 4;
  }

  get currentCover(): string | null {
    return this.coverPreview || this.existingCoverUrl;
  }
}