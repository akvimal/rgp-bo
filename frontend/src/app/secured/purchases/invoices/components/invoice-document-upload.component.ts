import { Component, EventEmitter, Output } from '@angular/core';
import { InvoiceService } from '../invoices.service';

@Component({
  selector: 'app-invoice-document-upload',
  templateUrl: './invoice-document-upload.component.html',
  styles: [`
    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 20px;
      transition: all 0.3s ease;
      background: #fafafa;
    }

    .upload-area.dragover {
      border-color: #007bff;
      background: #e7f3ff;
    }

    .selected-file-info {
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .extracted-data-preview {
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }
  `]
})
export class InvoiceDocumentUploadComponent {

  selectedFile: File | null = null;
  uploading: boolean = false;
  uploadProgress: number = 0;
  extractedData: any = null;
  errorMessage: string = '';
  isDragover: boolean = false;

  @Output() dataExtracted = new EventEmitter<any>();

  constructor(private invoiceService: InvoiceService) {}

  /**
   * Handle file selection from input
   */
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  /**
   * Handle drag over event
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = true;
  }

  /**
   * Handle drag leave event
   */
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = false;
  }

  /**
   * Handle file drop
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragover = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndSetFile(files[0]);
    }
  }

  /**
   * Validate and set the selected file
   */
  validateAndSetFile(file: File) {
    // Reset previous state
    this.errorMessage = '';
    this.extractedData = null;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      this.errorMessage = 'Invalid file type. Please upload PDF, JPG, or PNG files only.';
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.errorMessage = 'File size exceeds 10MB limit. Please upload a smaller file.';
      return;
    }

    this.selectedFile = file;
  }

  /**
   * Upload and extract data from the document
   */
  uploadAndExtract() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    // Create FormData
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('doctype', 'INVOICE_SCAN');

    // Simulate progress
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 200);

    // Call the service to upload and extract
    this.invoiceService.uploadAndExtractDocument(formData).subscribe({
      next: (response: any) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;

        setTimeout(() => {
          this.uploading = false;
          if (response.success && response.extractedData) {
            this.extractedData = response.extractedData;
            this.extractedData.documentId = response.documentId;
          } else {
            this.errorMessage = 'Failed to extract data from document. Please try again or enter manually.';
          }
        }, 500);
      },
      error: (error: any) => {
        clearInterval(progressInterval);
        this.uploading = false;
        this.uploadProgress = 0;
        this.errorMessage = error.error?.message || 'Upload failed. Please try again.';
        console.error('Upload error:', error);
      }
    });
  }

  /**
   * Populate the invoice form with extracted data
   */
  populateForm() {
    if (!this.extractedData) return;

    // Emit the extracted data to parent component
    this.dataExtracted.emit(this.extractedData);

    // Clear the upload component
    this.clearAll();
  }

  /**
   * Clear the selected file
   */
  clearFile() {
    this.selectedFile = null;
    this.errorMessage = '';
  }

  /**
   * Clear all data and reset component
   */
  clearAll() {
    this.selectedFile = null;
    this.uploading = false;
    this.uploadProgress = 0;
    this.extractedData = null;
    this.errorMessage = '';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get confidence score CSS class
   */
  getConfidenceClass(confidence: number): string {
    if (confidence >= 80) return 'text-success fw-bold';
    if (confidence >= 60) return 'text-warning fw-bold';
    return 'text-danger fw-bold';
  }
}
