import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductsService } from "../../products.service";
import { MessageService } from 'primeng/api';
import { PropsService } from "src/app/shared/props.service";
import { HsnService } from "../../hsn/hsn.service";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

@Component({
    templateUrl: 'product-form.component.html'
})
export class ProductFormComponent {

    productProps$?:Observable<any>;
    hsnCodes: any[] = [];
    selectedHsn: any = null;
    ocrProcessing: boolean = false;
    ocrResults: any[] = [];
    selectedFiles: File[] = [];
    mergedProductInfo: any = null;

    form:FormGroup = new FormGroup({
        id: new FormControl(''),
        title: new FormControl('', Validators.required),
        hsn: new FormControl(''),
        code: new FormControl(''),
        pack: new FormControl('1'),
        category: new FormControl(''),
        mfr: new FormControl(''),
        brand: new FormControl(''),
        description: new FormControl(''),
        props: new FormControl('')
      });

      pdata:any = {};
      props:any = [];
      brand:string = '';
      pack:string = '';

      isNew:boolean = false;
      previousCategory:string = '';
      savedPropsValues:any = {}; // Store props values when switching categories

      constructor(private propsService:PropsService,
        private service:ProductsService,
        private hsnService: HsnService,
        private messageService: MessageService,
        private http: HttpClient,
        private router:Router,
        private route:ActivatedRoute){
          this.productProps$ = this.propsService.productProps$;
        }

      ngOnInit(){

        this.isNew = this.route.snapshot.url[0].path === 'new';

        // Load all active HSN codes
        this.loadHsnCodes();

        const id = this.route.snapshot.paramMap.get('id');

        id && this.service.findById(id).subscribe((data:any) => {
          this.form.controls['id'].setValue(id);
          this.form.controls['title'].setValue(data.title);
          this.form.controls['hsn'].setValue(data.hsnCode || data.hsn_code || data.hsn);
          this.form.controls['code'].setValue(data.productCode || data.product_code || data.code);
          this.form.controls['pack'].setValue(data.pack);
          this.form.controls['category'].setValue(data.category);
          this.form.controls['mfr'].setValue(data.mfr);
          this.form.controls['brand'].setValue(data.brand);
          this.form.controls['description'].setValue(data.description);

          this.props = data.props;
          this.populateProps(data.category,data.props);

          // Find and set selected HSN
          const hsnValue = data.hsnCode || data.hsn_code || data.hsn;
          if (hsnValue) {
            this.selectedHsn = this.hsnCodes.find(h => h.hsncode === hsnValue);
          }
        })
      }

      loadHsnCodes(): void {
        this.hsnService.getAllHsnTaxCodes({ activeOnly: true }).subscribe({
          next: (data: any[]) => {
            // Sort HSN codes in ascending order by hsncode
            this.hsnCodes = data.sort((a, b) => {
              const codeA = a.hsncode || '';
              const codeB = b.hsncode || '';
              return codeA.localeCompare(codeB);
            });
          },
          error: (error) => {
            console.error('Error loading HSN codes:', error);
          }
        });
      }

      onHsnSelect(event: any): void {
        const hsnCode = event.target.value;
        this.selectedHsn = this.hsnCodes.find(h => h.hsncode === hsnCode);
        this.form.controls['hsn'].setValue(hsnCode);
      }

      populateProps(category:any,values:any){
        console.log('category: ',category);
        console.log('this.form.controls: ',this.form.controls);
        console.log(this.form.contains('props'));

        // Save current props values before changing category
        if(this.form.contains('props') && this.previousCategory) {
          this.savedPropsValues[this.previousCategory] = this.form.get('props')?.value;
        }

        if(category == '' && this.form.contains('props'))
            this.form.removeControl('props')

        this.propsService.productProps$.subscribe((data:any) => {
          this.props = [];
          const catProps = data.find((d:any) => d.category === category);
          console.log('catProps: ',catProps);

          if(catProps){
            this.props = catProps.props;
            let pps = {};
            for(let i=0;i<this.props.length;i++){
              const pname = this.props[i].id;

              // Try to restore saved value for this category, otherwise use provided value or default
              let value = null;
              if(this.savedPropsValues[category] && this.savedPropsValues[category][pname] !== undefined) {
                value = this.savedPropsValues[category][pname];
              } else if(values && values[pname] !== undefined) {
                value = values[pname];
              } else {
                value = this.props[i].default;
              }

              const fc = new FormControl(value||'');

              // Enable validation for required fields
              if(this.props[i].required) {
                fc.setValidators(Validators.required);
              }

              pps = {...pps, [pname]:fc}
            }
            console.log('setting prps form group');

            this.form.setControl('props', new FormGroup(pps));
            this.previousCategory = category;
          } else {
            console.log('this.form.controls: ',this.form.controls);
            if(this.form.contains('props'))
            this.form.removeControl('props')
          }
        });
      }

      selectProps(event:any,values:any){
        console.log('populating props..');
        
          this.populateProps(event.target.value,undefined);
      }

      dataInput(type:any,key:any,event:any){
        
        // if(key === 'brand'){
        //   this.brand = event.target.value;
        // } else if(key === 'formulation'){
        //   this.pdata.formulation = event.target.value;
        // } else if(key === 'pack'){
        //   this.pack = event.target.value;
        // } 
        // let formattedTitle = (this.brand.trim().toUpperCase()||'') + ' ' + (this.pdata.formulation||'');
        // if(this.form.value.pack > 1)
        //   formattedTitle += ` ${this.pack}'s`;

        // this.form.controls['title'].setValue(formattedTitle);
      }
  
      // isPluralPacking(count:number,formulation:string){
      //   if(formulation === 'TAB' || formulation === 'CAP') {
      //     return count !== undefined ? count + "'s" : '';
      //   }
      //   return "";
      // }

      onRemove(id:any) {
        this.service.remove(id);
      }

      onSave(){
        console.log('Save button clicked');
        console.log('Form valid:', this.form.valid);
        console.log('Session token exists:', !!sessionStorage.getItem('token'));

        const obj = {
          title: this.form.value.title.trim(),
          hsn:this.form.value.hsn.trim(),
          code:this.form.value.code.trim(),
          pack:this.form.value.pack,
          category:this.form.value.category,
          props: this.getTrimmedProps(this.form.value.props),
          mfr:this.form.value.mfr.trim(),
          brand:this.form.value.brand?.trim(),
          description: this.form.value.description?.trim() }

        console.log('Product data to save:', obj);

        const id = this.form.value.id;
        if(id) {
          this.service.update(id, obj).subscribe({
            next: (data) => {
              console.log('Product updated successfully');
              this.gotoList();
            },
            error: (error) => {
              console.error('Update error:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Update Failed',
                detail: error.error?.message || error.message || 'Failed to update product'
              });
            }
          });
        }
        else {
          this.service.save(obj).subscribe({
            next: (data:any) => {
              console.log('Save response:', data);
              if(data.status == 'ERROR') {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: data.message });
              } else {
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Saved Suucessfully' });
                this.gotoList();
              }
            },
            error: (error) => {
              console.error('Save error:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Save Failed',
                detail: error.error?.message || error.message || 'Failed to save product'
              });
            }
          });
        }
      }
  
      getTrimmedProps(props:any){
        return props;
      }

      reset(){
        this.form.reset();
      }

      gotoList() {
        this.router.navigate(['/secure/products/master/list'])
      }

      onLookupInput(event:any, field:string){
        this.form.controls[field].setValue(event.toUpperCase());
      }

      onFileSelected(event: any): void {
        const files = Array.from(event.target.files) as File[];
        if (files && files.length > 0) {
          this.selectedFiles = files;
          this.processMultipleImages();
        }
      }

      processMultipleImages(): void {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please select at least one image file' });
          return;
        }

        this.ocrProcessing = true;
        this.ocrResults = [];
        this.mergedProductInfo = null;

        this.messageService.add({
          severity: 'info',
          summary: 'Processing',
          detail: `Extracting and contextualizing ${this.selectedFiles.length} image(s)...`
        });

        // Create FormData with all files
        const formData = new FormData();
        this.selectedFiles.forEach((file, index) => {
          formData.append('files', file);
        });

        // Make single API call with all images
        this.http.post(`${environment.apiHost}/products/ocr/extract-multiple?entity=product&id=temp`, formData)
          .subscribe({
            next: (response: any) => {
              this.ocrProcessing = false;

              // Debug logging
              console.log('OCR Response received:', response);
              console.log('Response success:', response.success);
              console.log('Product Info:', response.productInfo);

              if (response.success && response.productInfo) {
                // Store OCR results from individual images for display
                if (response.ocrResults) {
                  this.ocrResults = response.ocrResults.map((result: any, index: number) => ({
                    fileName: this.selectedFiles[index]?.name || `Image ${index + 1}`,
                    extractedText: result.text,
                    success: result.success,
                    error: result.success ? null : 'Failed to extract text'
                  }));
                }

                // Store the merged, contextualized product info
                this.mergedProductInfo = response.productInfo;

                this.messageService.add({
                  severity: 'success',
                  summary: 'Extraction Complete',
                  detail: response.message || `Successfully processed ${response.successfulExtractions} of ${response.imageCount} image(s)`
                });
              } else {
                this.messageService.add({
                  severity: 'error',
                  summary: 'Extraction Failed',
                  detail: response.message || 'Could not extract information from images'
                });
              }
            },
            error: (error) => {
              this.ocrProcessing = false;
              console.error('Multi-image OCR error:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Processing Failed',
                detail: 'Failed to process images. Please try again.'
              });
            }
          });
      }


      applyMergedDataToForm(): void {
        if (this.mergedProductInfo) {
          this.populateFormFromOCR(this.mergedProductInfo);
          this.messageService.add({
            severity: 'success',
            summary: 'Form Updated',
            detail: 'Product information has been populated. Please review and edit as needed.'
          });
        }
      }

      populateFormFromOCR(productInfo: any): void {
        // Populate brand
        if (productInfo.brand) {
          this.form.controls['brand'].setValue(productInfo.brand.toUpperCase());
        }

        // Populate manufacturer
        if (productInfo.mfr) {
          this.form.controls['mfr'].setValue(productInfo.mfr.toUpperCase());
        }

        // Populate title
        if (productInfo.title) {
          this.form.controls['title'].setValue(productInfo.title.toUpperCase());
        }

        // Populate pack size - extract numeric value only
        if (productInfo.pack) {
          const packValue = this.extractPackNumber(productInfo.pack);
          this.form.controls['pack'].setValue(packValue);
        }

        // Populate HSN code
        if (productInfo.hsn) {
          this.form.controls['hsn'].setValue(productInfo.hsn);
          // Find and select the HSN in dropdown
          this.selectedHsn = this.hsnCodes.find(h => h.hsncode === productInfo.hsn);
        }

        // Populate category based on productType
        if (productInfo.productType) {
          const category = this.mapProductTypeToCategory(productInfo.productType);
          this.form.controls['category'].setValue(category);
          // Populate props for the selected category
          this.populateProps(category, undefined);
        }

        // Populate description
        if (productInfo.description) {
          this.form.controls['description'].setValue(productInfo.description);
        }

        // Populate composition if available and category is Medicine
        if (productInfo.composition && this.form.value.category === 'Medicine') {
          // Wait for props to be populated, then set composition
          setTimeout(() => {
            const propsGroup = this.form.get('props');
            if (propsGroup && propsGroup.get('composition')) {
              propsGroup.get('composition')?.setValue(productInfo.composition);
            }
          }, 100);
        }
      }

      /**
       * Extract numeric pack value from various formats
       * Examples:
       *  "1 x 15 Tablets" -> 15
       *  "15's" -> 15
       *  "Strip of 10" -> 10
       *  "10" -> 10
       */
      extractPackNumber(packString: string): number {
        if (!packString) return 1;

        // Try to match "X x Y" pattern and take Y
        const xByYPattern = /(\d+)\s*x\s*(\d+)/i;
        const xByYMatch = packString.match(xByYPattern);
        if (xByYMatch) {
          return parseInt(xByYMatch[2], 10); // Return the second number
        }

        // Try to match "N's" pattern
        const apostrophePattern = /(\d+)'s/i;
        const apostropheMatch = packString.match(apostrophePattern);
        if (apostropheMatch) {
          return parseInt(apostropheMatch[1], 10);
        }

        // Try to match "Strip of N" or "Pack of N" pattern
        const ofPattern = /(?:strip|pack)\s+of\s+(\d+)/i;
        const ofMatch = packString.match(ofPattern);
        if (ofMatch) {
          return parseInt(ofMatch[1], 10);
        }

        // Try to extract any number from the string
        const numberPattern = /(\d+)/;
        const numberMatch = packString.match(numberPattern);
        if (numberMatch) {
          return parseInt(numberMatch[1], 10);
        }

        // Default to 1 if no number found
        return 1;
      }

      /**
       * Map productType from OCR to category
       * Examples:
       *  "Tablet", "Capsule", "Syrup" -> "Medicine"
       *  "Dietary Supplement", "Supplement" -> "OTC"
       */
      mapProductTypeToCategory(productType: string): string {
        if (!productType) return 'Medicine'; // Default to Medicine

        const type = productType.toLowerCase();

        // OTC categories
        const otcTypes = ['supplement', 'dietary supplement', 'surgical', 'personal care', 'device', 'treatment'];
        if (otcTypes.some(otc => type.includes(otc))) {
          return 'OTC';
        }

        // Medicine categories (tablets, capsules, syrups, injections, etc.)
        const medicineTypes = ['tablet', 'capsule', 'syrup', 'injection', 'powder', 'cream', 'ointment', 'drop'];
        if (medicineTypes.some(med => type.includes(med))) {
          return 'Medicine';
        }

        // Default to Medicine if unclear
        return 'Medicine';
      }

      /**
       * Determines the column class for dynamic fields based on field type
       * This ensures responsive layout across different screen sizes
       */
      getFieldColumnClass(prop: any): string {
        // Textarea fields (composition) get full width
        if (prop.type === 'TEXT') {
          return 'col-12';
        }
        // Checkbox fields get half width
        if (prop.type === 'CHECK') {
          return 'col-md-6';
        }
        // Single-select dropdowns get appropriate width
        if (prop.type === 'SINGLE-SELECT') {
          // Schedule and document fields are shorter
          if (prop.id === 'schedule' || prop.id === 'document') {
            return 'col-md-4';
          }
          // Subcategory gets more space
          return 'col-md-6';
        }
        // Default for text inputs
        return 'col-md-6';
      }

      /**
       * Checks if a dynamic field is invalid (has been touched and has validation errors)
       * Used to show validation error messages
       */
      isFieldInvalid(fieldId: string): boolean {
        const propsGroup = this.form.get('props') as FormGroup;
        if (!propsGroup) {
          return false;
        }

        const field = propsGroup.get(fieldId);
        return field ? (field.invalid && (field.dirty || field.touched)) : false;
      }

}