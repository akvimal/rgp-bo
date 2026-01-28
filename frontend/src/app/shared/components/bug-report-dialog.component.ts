import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BugReportService, BugReportDto } from '../services/bug-report.service';

@Component({
  selector: 'app-bug-report-dialog',
  templateUrl: './bug-report-dialog.component.html',
  styleUrls: ['./bug-report-dialog.component.scss']
})
export class BugReportDialogComponent implements OnInit {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  bugReportForm: FormGroup;
  isSubmitting: boolean = false;
  submitSuccess: boolean = false;
  submitError: boolean = false;
  errorMessage: string = '';
  issueUrl: string = '';

  constructor(
    private fb: FormBuilder,
    private bugReportService: BugReportService
  ) {
    this.bugReportForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(2000)]],
      stepsToReproduce: ['', [Validators.maxLength(1000)]]
    });
  }

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.bugReportForm.invalid) {
      this.markFormGroupTouched(this.bugReportForm);
      return;
    }

    this.isSubmitting = true;
    this.submitError = false;
    this.submitSuccess = false;

    const formValue = this.bugReportForm.value;
    const systemInfo = this.bugReportService.captureSystemInfo();

    const bugReportDto: BugReportDto = {
      title: formValue.title,
      description: formValue.description,
      stepsToReproduce: formValue.stepsToReproduce || undefined,
      systemInfo: systemInfo
    };

    this.bugReportService.submitBugReport(bugReportDto).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.issueUrl = response.issueUrl;
        this.bugReportForm.reset();

        // Auto-close after 3 seconds
        setTimeout(() => {
          this.hideDialog();
        }, 3000);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitError = true;

        // Handle specific error cases
        if (error.status === 429) {
          this.errorMessage = 'Too many bug reports. Please try again later.';
        } else if (error.status === 503) {
          this.errorMessage = 'Bug reporting service is temporarily unavailable. Please try again later.';
        } else if (error.status === 401) {
          this.errorMessage = 'You must be logged in to report a bug.';
        } else {
          this.errorMessage = 'Failed to submit bug report. Please try again.';
        }

        console.error('Bug report submission error:', error);
      }
    });
  }

  hideDialog(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.submitSuccess = false;
    this.submitError = false;
    this.errorMessage = '';
    this.issueUrl = '';
  }

  onDialogHide(): void {
    this.submitSuccess = false;
    this.submitError = false;
    this.errorMessage = '';
    this.issueUrl = '';
  }

  openIssueUrl(): void {
    if (this.issueUrl) {
      window.open(this.issueUrl, '_blank');
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  get title() {
    return this.bugReportForm.get('title');
  }

  get description() {
    return this.bugReportForm.get('description');
  }

  get stepsToReproduce() {
    return this.bugReportForm.get('stepsToReproduce');
  }
}
