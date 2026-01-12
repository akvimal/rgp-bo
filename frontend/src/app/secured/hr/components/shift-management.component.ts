import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ShiftService } from '../services/shift.service';
import { Shift } from '../models/hr.models';

@Component({
  selector: 'app-shift-management',
  templateUrl: './shift-management.component.html',
  styleUrls: ['./shift-management.component.scss']
})
export class ShiftManagementComponent implements OnInit {
  shifts: Shift[] = [];
  isLoading = false;
  showShiftForm = false;
  showAssignmentForm = false;
  selectedShift: Shift | null = null;
  storeId: number | null = null;

  constructor(
    private shiftService: ShiftService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadShifts();
  }

  loadShifts(): void {
    this.isLoading = true;
    this.shiftService.getAllShifts(this.storeId || undefined).subscribe({
      next: (shifts) => {
        this.shifts = shifts;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading shifts:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load shifts'
        });
        this.isLoading = false;
      }
    });
  }

  openNewShiftForm(): void {
    this.selectedShift = null;
    this.showShiftForm = true;
  }

  editShift(shift: Shift): void {
    this.selectedShift = shift;
    this.showShiftForm = true;
  }

  deleteShift(shift: Shift): void {
    if (confirm(`Are you sure you want to delete shift "${shift.name}"?`)) {
      this.shiftService.deleteShift(shift.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Shift deleted successfully'
          });
          this.loadShifts();
        },
        error: (error) => {
          console.error('Error deleting shift:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Failed to delete shift'
          });
        }
      });
    }
  }

  assignUsers(shift: Shift): void {
    this.selectedShift = shift;
    this.showAssignmentForm = true;
  }

  onShiftFormClose(saved: boolean): void {
    this.showShiftForm = false;
    this.selectedShift = null;
    if (saved) {
      this.loadShifts();
    }
  }

  onAssignmentFormClose(saved: boolean): void {
    this.showAssignmentForm = false;
    this.selectedShift = null;
    if (saved) {
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'User assigned to shift successfully'
      });
    }
  }

  formatTime(time: string): string {
    if (!time) return '';
    return time.substring(0, 5); // Format HH:mm:ss to HH:mm
  }

  calculateShiftDuration(shift: Shift): string {
    const start = shift.starttime.split(':');
    const end = shift.endtime.split(':');
    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    let duration = endMinutes - startMinutes;

    if (duration < 0) {
      duration += 24 * 60; // Handle overnight shifts
    }

    duration -= shift.breakduration || 0;

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    return `${hours}h ${minutes}m`;
  }
}
