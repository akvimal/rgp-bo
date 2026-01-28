import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-bug-report-fab',
  template: `
    <button
      class="bug-report-fab"
      (click)="onFabClick()"
      title="Report a bug"
      type="button">
      <i class="bi bi-bug-fill"></i>
    </button>
  `,
  styles: [`
    .bug-report-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: #dc3545;
      color: white;
      border: none;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .bug-report-fab:hover {
      background-color: #c82333;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
      transform: scale(1.1);
    }

    .bug-report-fab:active {
      transform: scale(0.95);
    }

    .bug-report-fab i {
      line-height: 1;
    }
  `]
})
export class BugReportFabComponent {
  @Output() fabClick = new EventEmitter<void>();

  onFabClick(): void {
    this.fabClick.emit();
  }
}
