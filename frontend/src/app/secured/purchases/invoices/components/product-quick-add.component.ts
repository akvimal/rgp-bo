import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../products/products.service';
import { Product } from '../../../products/product.model';

@Component({
  selector: 'app-product-quick-add',
  templateUrl: './product-quick-add.component.html',
  styles: [`
    .quick-add-form {
      max-width: 600px;
    }
  `]
})
export class ProductQuickAddComponent implements OnChanges {

  @Input() visible: boolean = false;
  @Input() prefillTitle: string = '';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() productCreated = new EventEmitter<Product>();
  @Output() cancelled = new EventEmitter<void>();

  productForm: FormGroup;
  saving: boolean = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private productService: ProductsService
  ) {
    this.productForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      pack: ['', [Validators.pattern(/^[0-9]+$/)]],
      mfr: [''],
      category: [''],
      brand: [''],
      description: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('ngOnChanges called', changes);
    console.log('visible:', this.visible);
    console.log('prefillTitle:', this.prefillTitle);

    // Pre-fill form when dialog opens
    if (this.visible && this.prefillTitle) {
      console.log('Patching form with title:', this.prefillTitle);
      this.productForm.patchValue({
        title: this.prefillTitle || ''
      });
      // Mark as pristine to avoid premature validation
      this.productForm.controls['title'].markAsPristine();
      this.productForm.controls['title'].updateValueAndValidity();
      // Clear the form-level error state
      this.errorMessage = '';
      console.log('Form after patch - valid?', this.productForm.valid);
      console.log('Form value:', this.productForm.value);
    }
  }

  saveProduct() {
    console.log('saveProduct called');
    console.log('Form value:', this.productForm.value);
    console.log('Form valid?', this.productForm.valid);
    console.log('Title control value:', this.productForm.controls['title'].value);
    console.log('Title control valid?', this.productForm.controls['title'].valid);
    console.log('Title control errors:', this.productForm.controls['title'].errors);

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();

      // Find which field is actually invalid
      const invalidFields: string[] = [];
      Object.keys(this.productForm.controls).forEach(key => {
        const control = this.productForm.controls[key];
        if (control.invalid) {
          invalidFields.push(key);
          console.log(`Invalid field: ${key}`, control.errors);
        }
      });

      this.errorMessage = `Required field is missing: ${invalidFields.join(', ')}`;
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    // Clean up the form data - convert empty strings to appropriate types
    const formValue = this.productForm.value;
    const productData: any = {
      title: formValue.title,
      description: formValue.description || undefined,
      mfr: formValue.mfr || undefined,
      category: formValue.category || undefined,
      brand: formValue.brand || undefined,
      pack: formValue.pack ? parseInt(formValue.pack) : 0,
      taxpcnt: 0, // Default tax percentage
      isActive: true,
      isArchived: false
    };

    console.log('Sending product data to API:', productData);

    this.productService.save(productData).subscribe({
      next: (response: any) => {
        console.log('Product created successfully:', response);
        this.saving = false;

        // Emit the created product with its ID
        // Use the response data which includes server-generated fields
        const createdProduct: Product = {
          id: response.id,
          title: response.title || productData.title,
          description: response.description,
          mfr: response.mfr,
          category: response.category,
          brand: response.brand,
          pack: response.pack,
          isActive: response.isActive !== undefined ? response.isActive : true,
          isArchived: response.isArchived !== undefined ? response.isArchived : false
        };

        console.log('Emitting created product:', createdProduct);
        this.productCreated.emit(createdProduct);
        this.closeDialog();
      },
      error: (error) => {
        console.error('Error creating product:', error);
        this.saving = false;
        this.errorMessage = error.error?.message || 'Failed to create product. Please try again.';
      }
    });
  }

  closeDialog() {
    this.productForm.reset();
    this.errorMessage = '';
    this.visible = false;
    this.visibleChange.emit(false);
  }

  cancel() {
    this.closeDialog();
    this.cancelled.emit();
  }
}
