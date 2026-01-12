import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HsnService } from './hsn.service';

@Component({
  selector: 'app-hsn-form',
  templateUrl: './hsn-form.component.html',
  styleUrls: ['./hsn-form.component.scss']
})
export class HsnFormComponent implements OnInit {
  hsnForm: FormGroup;
  isEditMode: boolean = false;
  hsnId: number | null = null;
  categories: string[] = [];
  loading: boolean = false;
  submitted: boolean = false;

  constructor(
    private fb: FormBuilder,
    private hsnService: HsnService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.hsnForm = this.fb.group({
      hsncode: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]],
      hsndescription: [''],
      cgstrate: [0, [Validators.required, Validators.min(0), Validators.max(28)]],
      sgstrate: [0, [Validators.required, Validators.min(0), Validators.max(28)]],
      igstrate: [0, [Validators.required, Validators.min(0), Validators.max(28)]],
      taxcategory: [''],
      effectivefrom: [new Date().toISOString().split('T')[0]],
      effectiveto: ['2099-12-31']
    });

    // Auto-calculate IGST when CGST or SGST changes
    this.hsnForm.get('cgstrate')?.valueChanges.subscribe(() => this.calculateIGST());
    this.hsnForm.get('sgstrate')?.valueChanges.subscribe(() => this.calculateIGST());
  }

  ngOnInit(): void {
    this.loadCategories();

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.hsnId = +params['id'];
        this.loadHsnData();
      }
    });
  }

  loadCategories(): void {
    this.hsnService.getCategories().subscribe({
      next: (data: string[]) => {
        this.categories = data;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadHsnData(): void {
    if (this.hsnId) {
      this.loading = true;
      this.hsnService.getHsnTaxById(this.hsnId).subscribe({
        next: (data: any) => {
          this.hsnForm.patchValue({
            hsncode: data.hsncode,
            hsndescription: data.hsndescription,
            cgstrate: data.cgstrate,
            sgstrate: data.sgstrate,
            igstrate: data.igstrate,
            taxcategory: data.taxcategory,
            effectivefrom: data.effectivefrom ? new Date(data.effectivefrom).toISOString().split('T')[0] : '',
            effectiveto: data.effectiveto ? new Date(data.effectiveto).toISOString().split('T')[0] : '2099-12-31'
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading HSN data:', error);
          alert('Failed to load HSN data');
          this.loading = false;
          this.cancel();
        }
      });
    }
  }

  calculateIGST(): void {
    const cgst = this.hsnForm.get('cgstrate')?.value || 0;
    const sgst = this.hsnForm.get('sgstrate')?.value || 0;
    this.hsnForm.patchValue({ igstrate: cgst + sgst }, { emitEvent: false });
  }

  getTotalTaxRate(): number {
    const cgst = this.hsnForm.get('cgstrate')?.value || 0;
    const sgst = this.hsnForm.get('sgstrate')?.value || 0;
    return cgst + sgst;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.hsnForm.invalid) {
      alert('Please fill all required fields correctly');
      return;
    }

    // Validate IGST = CGST + SGST
    const cgst = this.hsnForm.get('cgstrate')?.value;
    const sgst = this.hsnForm.get('sgstrate')?.value;
    const igst = this.hsnForm.get('igstrate')?.value;

    if (igst !== cgst + sgst) {
      alert('IGST must equal CGST + SGST');
      return;
    }

    this.loading = true;
    const formData = this.hsnForm.value;

    if (this.isEditMode && this.hsnId) {
      this.hsnService.updateHsnTax(this.hsnId, formData).subscribe({
        next: () => {
          alert('HSN code updated successfully');
          this.router.navigate(['/secure/products/hsn']);
        },
        error: (error) => {
          console.error('Error updating HSN code:', error);
          alert(error.error?.message || 'Failed to update HSN code');
          this.loading = false;
        }
      });
    } else {
      this.hsnService.createHsnTax(formData).subscribe({
        next: () => {
          alert('HSN code created successfully');
          this.router.navigate(['/secure/products/hsn']);
        },
        error: (error) => {
          console.error('Error creating HSN code:', error);
          alert(error.error?.message || 'Failed to create HSN code');
          this.loading = false;
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/secure/products/hsn']);
  }

  get f() {
    return this.hsnForm.controls;
  }
}
