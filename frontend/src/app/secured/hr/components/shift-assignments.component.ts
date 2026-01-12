import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ShiftService } from '../services/shift.service';
import { UserShift } from '../models/hr.models';

@Component({
  selector: 'app-shift-assignments',
  templateUrl: './shift-assignments.component.html',
  styleUrls: ['./shift-assignments.component.scss']
})
export class ShiftAssignmentsComponent implements OnInit {
  assignments: UserShift[] = [];
  isLoading = false;

  daysOfWeekLabels: { [key: number]: string } = {
    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat'
  };

  constructor(
    private shiftService: ShiftService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.isLoading = true;
    this.shiftService.getAllAssignments().subscribe({
      next: (assignments) => {
        this.assignments = assignments;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading assignments:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load shift assignments'
        });
        this.isLoading = false;
      }
    });
  }

  formatDaysOfWeek(days: number[]): string {
    if (!days || days.length === 0) return 'None';

    // Check if all 7 days are selected
    if (days.length === 7) return 'All days';

    // Check if it's Mon-Fri (1,2,3,4,5)
    const weekdays = [1, 2, 3, 4, 5];
    if (days.length === 5 && weekdays.every(d => days.includes(d))) {
      return 'Mon-Fri';
    }

    // Otherwise, show individual days
    return days
      .sort((a, b) => a - b)
      .map(day => this.daysOfWeekLabels[day])
      .join(', ');
  }

  formatDate(date: Date | string | null): string {
    if (!date) return 'Indefinite';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(time: string): string {
    if (!time) return '';
    return time.substring(0, 5);
  }

  calculateShiftDuration(starttime: string, endtime: string, breakduration: number): string {
    if (!starttime || !endtime) return '';

    const start = starttime.split(':');
    const end = endtime.split(':');

    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);

    let duration = endMinutes - startMinutes;

    // Subtract break duration
    duration -= breakduration || 0;

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  getStatusClass(effectiveTo: Date | null): string {
    if (!effectiveTo) return 'active-assignment';

    const endDate = new Date(effectiveTo);
    const today = new Date();

    if (endDate < today) return 'expired-assignment';

    // Warning if ending within 7 days
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    if (endDate <= weekFromNow) return 'ending-soon-assignment';

    return 'active-assignment';
  }

  getStatusLabel(effectiveTo: Date | null): string {
    if (!effectiveTo) return 'Active';

    const endDate = new Date(effectiveTo);
    const today = new Date();

    if (endDate < today) return 'Expired';

    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    if (endDate <= weekFromNow) return 'Ending Soon';

    return 'Active';
  }
}
