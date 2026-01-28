import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VendorsService } from '../../vendors/vendors.service';
import { Vendor } from '../../vendors/vendor.model';

@Component({
  selector: 'app-vendor-quick-add',
  templateUrl: './vendor-quick-add.component.html',
  styles: [`
    .quick-add-form {
      max-width: 600px;
    }
  `]
})
export class VendorQuickAddComponent {

  @Input() visible: boolean = false;
  @Input() prefillName: string = '';
  @Input() prefillGstin: string = '';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() vendorCreated = new EventEmitter<Vendor>();
  @Output() cancelled = new EventEmitter<void>();

  vendorForm: FormGroup;
  saving: boolean = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private vendorService: VendorsService
  ) {
    this.vendorForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      gstn: ['', [Validators.pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)]],
      contactname: [''],
      contactphone: ['', [Validators.pattern(/^[0-9]{10}$/)]],
      address: [''],
      comments: ['']
    });
  }

  ngOnChanges() {
    // Pre-fill form when dialog opens
    if (this.visible && (this.prefillName || this.prefillGstin)) {
      this.vendorForm.patchValue({
        name: this.prefillName || '',
        gstn: this.prefillGstin || ''
      });
    }
  }

  saveVendor() {
    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const vendorData: Vendor = this.vendorForm.value;

    this.vendorService.save(vendorData).subscribe({
      next: (response: any) => {
        console.log('Vendor created successfully:', response);
        this.saving = false;

        // Emit the created vendor with its ID
        const createdVendor: Vendor = {
          id: response.id,
          ...vendorData
        };

        this.vendorCreated.emit(createdVendor);
        this.closeDialog();
      },
      error: (error) => {
        console.error('Error creating vendor:', error);
        this.saving = false;
        this.errorMessage = error.error?.message || 'Failed to create vendor. Please try again.';
      }
    });
  }

  closeDialog() {
    this.vendorForm.reset();
    this.errorMessage = '';
    this.visible = false;
    this.visibleChange.emit(false);
  }

  cancel() {
    this.closeDialog();
    this.cancelled.emit();
  }
}
