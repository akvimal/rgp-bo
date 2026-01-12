import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { ShiftService } from '../services/shift.service';
import { Shift } from '../models/hr.models';
import { environment } from 'src/environments/environment';

interface User {
  id: number;
  full_name: string;
  email: string;
}

interface DayOfWeek {
  label: string;
  value: number;
}

@Component({
  selector: 'app-user-shift-assignment',
  templateUrl: './user-shift-assignment.component.html',
  styleUrls: ['./user-shift-assignment.component.scss']
})
export class UserShiftAssignmentComponent implements OnInit {
  @Input() shift: Shift | null = null;
  @Output() close = new EventEmitter<boolean>();

  assignmentForm: FormGroup;
  users: User[] = [];
  isLoading = false;
  visible = true;

  daysOfWeek: DayOfWeek[] = [
    { label: 'Sunday', value: 0 },
    { label: 'Monday', value: 1 },
    { label: 'Tuesday', value: 2 },
    { label: 'Wednesday', value: 3 },
    { label: 'Thursday', value: 4 },
    { label: 'Friday', value: 5 },
    { label: 'Saturday', value: 6 }
  ];

  selectedDays: number[] = [1, 2, 3, 4, 5]; // Default: Monday-Friday

  constructor(
    private fb: FormBuilder,
    private shiftService: ShiftService,
    private http: HttpClient,
    private messageService: MessageService
  ) {
    this.assignmentForm = this.fb.group({
      userid: ['', Validators.required],
      shiftid: ['', Validators.required],
      effectivefrom: ['', Validators.required],
      effectiveto: [''],
      daysofweek: [this.selectedDays, Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.shift) {
      this.assignmentForm.patchValue({
        shiftid: this.shift.id
      });
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<User[]>(`${environment.apiHost}/users`).subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load users'
        });
      }
    });
  }

  onDayToggle(day: number): void {
    const index = this.selectedDays.indexOf(day);
    if (index > -1) {
      this.selectedDays.splice(index, 1);
    } else {
      this.selectedDays.push(day);
    }
    this.selectedDays.sort((a, b) => a - b);
    this.assignmentForm.patchValue({ daysofweek: this.selectedDays });
  }

  isDaySelected(day: number): boolean {
    return this.selectedDays.includes(day);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  assignUser(): void {
    if (this.assignmentForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill all required fields'
      });
      return;
    }

    if (this.selectedDays.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please select at least one day of the week'
      });
      return;
    }

    this.isLoading = true;
    const formValue = { ...this.assignmentForm.value };

    // Format dates
    formValue.effectivefrom = this.formatDate(formValue.effectivefrom);
    if (formValue.effectiveto && formValue.effectiveto !== '') {
      formValue.effectiveto = this.formatDate(formValue.effectiveto);
    } else {
      // Remove the property if empty to send null
      delete formValue.effectiveto;
    }

    this.shiftService.assignUserToShift(formValue).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'User assigned to shift successfully'
        });
        this.isLoading = false;
        this.closeDialog(true);
      },
      error: (error) => {
        console.error('Error assigning user:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Failed to assign user to shift'
        });
        this.isLoading = false;
      }
    });
  }

  closeDialog(saved: boolean = false): void {
    this.visible = false;
    setTimeout(() => this.close.emit(saved), 300);
  }
}
