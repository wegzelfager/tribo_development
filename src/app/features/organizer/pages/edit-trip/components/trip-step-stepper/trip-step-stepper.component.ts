import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-trip-step-stepper',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-step-stepper.component.html',
  styleUrl: './trip-step-stepper.component.scss',
})
export class TripStepStepperComponent {
  @Input() steps: string[] = ['Basics', 'Description', 'Itinerary', 'Pricing'];
  @Input() currentStep = 1;
  @Output() stepSelect = new EventEmitter<number>();

  onStepClick(stepNumber: number): void {
    if (stepNumber < this.currentStep) {
      this.stepSelect.emit(stepNumber);
    }
  }
}
