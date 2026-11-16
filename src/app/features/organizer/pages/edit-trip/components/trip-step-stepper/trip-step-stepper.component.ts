import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-trip-step-stepper',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-step-stepper.component.html',
  styleUrl: './trip-step-stepper.component.scss',
})
export class TripStepStepperComponent {
  @Input() steps: string[] = [
    'organizer.edit_trip.step_basics',
    'organizer.edit_trip.step_desc',
    'organizer.edit_trip.step_itinerary',
    'organizer.edit_trip.step_pricing'
  ];
  @Input() currentStep = 1;
  @Output() stepSelect = new EventEmitter<number>();

  onStepClick(stepNumber: number): void {
    if (stepNumber < this.currentStep) {
      this.stepSelect.emit(stepNumber);
    }
  }
}
