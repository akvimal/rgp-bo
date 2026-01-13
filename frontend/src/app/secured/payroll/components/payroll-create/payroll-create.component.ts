import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { MONTH_NAMES } from '../../models/payroll.models';

@Component({
  selector: 'app-payroll-create',
  templateUrl: './payroll-create.component.html',
  styleUrls: ['./payroll-create.component.css']
})
export class PayrollCreateComponent implements OnInit {
  payrollForm: FormGroup;
  loading = false;
  submitted = false;

  // Dropdown options
  years: number[] = [];
  months: Array<{ value: number; label: string }> = [];

  constructor(
    private fb: FormBuilder,
    private payrollService: PayrollService,
    private router: Router
  ) {
    // Initialize form
    this.payrollForm = this.fb.group({
      year: ['', Validators.required],
      month: ['', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.initializeDropdowns();
    this.setDefaultValues();
  }

  initializeDropdowns(): void {
    // Generate years (current year - 1 to current year + 1)
    const currentYear = new Date().getFullYear();
    this.years = [currentYear - 1, currentYear, currentYear + 1];

    // Generate months
    this.months = MONTH_NAMES.map((name, index) => ({
      value: index + 1,
      label: name
    }));
  }

  setDefaultValues(): void {
    const { year, month } = this.payrollService.getCurrentPeriod();

    // Set default year and month
    this.payrollForm.patchValue({
      year: year,
      month: month
    });

    // Auto-generate title
    this.updateTitle();
  }

  onYearChange(): void {
    this.updateTitle();
  }

  onMonthChange(): void {
    this.updateTitle();
  }

  updateTitle(): void {
    const year = this.payrollForm.get('year')?.value;
    const month = this.payrollForm.get('month')?.value;

    if (year && month) {
      const monthName = MONTH_NAMES[month - 1];
      const title = `${monthName} ${year} Payroll`;
      this.payrollForm.patchValue({ title }, { emitEvent: false });
    }
  }

  onSubmit(): void {
    this.submitted = true;

    // Validate form
    if (this.payrollForm.invalid) {
      this.markFormGroupTouched(this.payrollForm);
      return;
    }

    // Confirm creation
    const formValue = this.payrollForm.value;
    const monthName = MONTH_NAMES[formValue.month - 1];

    if (!confirm(
      `Create payroll run for ${monthName} ${formValue.year}?\n\n` +
      `Title: ${formValue.title}\n` +
      `This will create a new payroll run in DRAFT status.`
    )) {
      return;
    }

    // Create payroll run
    this.loading = true;
    this.payrollService.createPayrollRun(formValue).subscribe({
      next: (result) => {
        alert(
          `Payroll run created successfully!\n\n` +
          `Run ID: ${result.id}\n` +
          `Status: ${result.status}\n\n` +
          `You can now calculate payroll for this run.`
        );
        this.router.navigate(['/secure/payroll', result.id, 'details']);
      },
      error: (error) => {
        console.error('Error creating payroll run:', error);
        alert('Error creating payroll run: ' + (error.error?.message || error.message));
        this.loading = false;
      }
    });
  }

  onCancel(): void {
    if (this.payrollForm.dirty) {
      if (!confirm('Discard changes and go back?')) {
        return;
      }
    }
    this.router.navigate(['/secure/payroll']);
  }

  // Helper method to mark all fields as touched for validation display
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  // Validation helper methods
  isFieldInvalid(fieldName: string): boolean {
    const field = this.payrollForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.submitted));
  }

  getFieldError(fieldName: string): string {
    const field = this.payrollForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) {
        return 'This field is required';
      }
      if (field.errors['maxlength']) {
        const maxLength = field.errors['maxlength'].requiredLength;
        return `Maximum ${maxLength} characters allowed`;
      }
    }

    return '';
  }
}
