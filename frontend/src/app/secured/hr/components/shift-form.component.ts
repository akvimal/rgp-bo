import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ShiftService } from '../services/shift.service';
import { Shift } from '../models/hr.models';

@Component({
  selector: 'app-shift-form',
  templateUrl: './shift-form.component.html',
  styleUrls: ['./shift-form.component.scss']
})
export class ShiftFormComponent implements OnInit {
  @Input() shift: Shift | null = null;
  @Output() close = new EventEmitter<boolean>();

  shiftForm: FormGroup;
  isLoading = false;
  visible = true;

  constructor(
    private fb: FormBuilder,
    private shiftService: ShiftService,
    private messageService: MessageService
  ) {
    this.shiftForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      storeid: [1, Validators.required],
      starttime: ['', Validators.required],
      endtime: ['', Validators.required],
      breakduration: [0, [Validators.required, Validators.min(0)]],
      graceperiodminutes: [0, [Validators.min(0)]],
      description: ['']
    });
  }

  ngOnInit(): void {
    if (this.shift) {
      this.shiftForm.patchValue({
        name: this.shift.name,
        storeid: this.shift.storeid,
        starttime: this.parseTime(this.shift.starttime),
        endtime: this.parseTime(this.shift.endtime),
        breakduration: this.shift.breakduration,
        graceperiodminutes: this.shift.graceperiodminutes || 0,
        description: this.shift.description || ''
      });
    }
  }

  parseTime(timeStr: string): Date {
    const today = new Date();
    const [hours, minutes] = timeStr.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return today;
  }

  formatTime(date: Date): string {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }

  saveShift(): void {
    if (this.shiftForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill all required fields correctly'
      });
      return;
    }

    this.isLoading = true;
    const formValue = { ...this.shiftForm.value };

    // Convert time inputs to HH:mm:ss format
    formValue.starttime = this.formatTime(formValue.starttime);
    formValue.endtime = this.formatTime(formValue.endtime);

    const saveOperation = this.shift
      ? this.shiftService.updateShift(this.shift.id, formValue)
      : this.shiftService.createShift(formValue);

    saveOperation.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Shift ${this.shift ? 'updated' : 'created'} successfully`
        });
        this.isLoading = false;
        this.closeDialog(true);
      },
      error: (error) => {
        console.error('Error saving shift:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || `Failed to ${this.shift ? 'update' : 'create'} shift`
        });
        this.isLoading = false;
      }
    });
  }

  closeDialog(saved: boolean = false): void {
    this.visible = false;
    setTimeout(() => this.close.emit(saved), 300);
  }

  get isEditMode(): boolean {
    return this.shift !== null;
  }
}
