import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item" [ngClass]="'toast-' + toast.type">
          <div class="toast-indicator"></div>
          <span class="toast-msg">{{ toast.message }}</span>
          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Close notification">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      width: calc(100vw - 48px);
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #FFFFFF;
      color: #2A211B;
      box-shadow: 0 8px 30px rgba(42, 33, 27, 0.15);
      border: 1px solid #EDE6DC;
      font-size: 0.875rem;
      line-height: 1.4;
      animation: slideIn 0.25s ease-out;
    }
    .toast-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .toast-success .toast-indicator { background: #4A7C59; }
    .toast-error .toast-indicator { background: #B84A39; }
    .toast-info .toast-indicator { background: #C89D66; }
    .toast-warning .toast-indicator { background: #D9822B; }
    .toast-msg {
      flex: 1;
      font-weight: 500;
    }
    .toast-close {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #8A7F73;
      padding: 0 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .toast-close:hover {
      color: #2A211B;
    }
    @keyframes slideIn {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (max-width: 640px) {
      .toast-container {
        bottom: 16px;
        right: 16px;
        left: 16px;
        width: auto;
        max-width: none;
      }
      .toast-item {
        padding: 10px 14px;
        font-size: 0.8125rem;
      }
    }
  `]
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
