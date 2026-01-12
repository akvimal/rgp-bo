import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { LeaveService } from '../services/leave.service';
import { LeaveType, LeaveRequest, LeaveBalance, LeaveRequestStatus } from '../models/hr.models';

@Component({
  selector: 'app-leave-request',
  templateUrl: './leave-request.component.html',
  styleUrls: ['./leave-request.component.scss']
})
export class LeaveRequestComponent implements OnInit {
  leaveTypes: LeaveType[] = [];
  myRequests: LeaveRequest[] = [];
  leaveBalances: LeaveBalance[] = [];

  leaveForm: FormGroup;
  showForm = false;
  isLoading = false;
  currentYear = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private leaveService: LeaveService,
    private messageService: MessageService
  ) {
    this.leaveForm = this.fb.group({
      leaveTypeId: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: ['', Validators.required],
      isFirstHalfDay: [false],
      isLastHalfDay: [false]
    });
  }

  ngOnInit(): void {
    this.loadLeaveTypes();
    this.loadMyRequests();
    this.loadLeaveBalances();
  }

  loadLeaveTypes(): void {
    this.leaveService.getLeaveTypes().subscribe({
      next: (types) => {
        this.leaveTypes = types.filter(t => t.isActive);
      },
      error: (error) => {
        console.error('Error loading leave types:', error);
      }
    });
  }

  loadMyRequests(): void {
    this.isLoading = true;
    this.leaveService.getMyLeaveRequests().subscribe({
      next: (requests) => {
        this.myRequests = requests;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading leave requests:', error);
        this.isLoading = false;
      }
    });
  }

  loadLeaveBalances(): void {
    this.leaveService.getMyLeaveBalance(this.currentYear).subscribe({
      next: (balances) => {
        this.leaveBalances = balances;
      },
      error: (error) => {
        console.error('Error loading leave balances:', error);
      }
    });
  }

  calculateTotalDays(): number {
    const startDate = this.leaveForm.get('startDate')?.value;
    const endDate = this.leaveForm.get('endDate')?.value;
    const isFirstHalfDay = this.leaveForm.get('isFirstHalfDay')?.value;
    const isLastHalfDay = this.leaveForm.get('isLastHalfDay')?.value;

    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (isFirstHalfDay) diffDays -= 0.5;
    if (isLastHalfDay) diffDays -= 0.5;

    return Math.max(0.5, diffDays);
  }

  submitLeaveRequest(): void {
    if (this.leaveForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill all required fields'
      });
      return;
    }

    const formValue = this.leaveForm.value;
    const totalDays = this.calculateTotalDays();

    const request = {
      ...formValue,
      totalDays,
      startDate: this.formatDate(formValue.startDate),
      endDate: this.formatDate(formValue.endDate)
    };

    this.isLoading = true;
    this.leaveService.createLeaveRequest(request).subscribe({
      next: (result) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Leave Request Submitted',
          detail: `Your leave request for ${totalDays} day(s) has been submitted`
        });
        this.leaveForm.reset();
        this.showForm = false;
        this.loadMyRequests();
        this.loadLeaveBalances();
        this.isLoading = false;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Request Failed',
          detail: error.error?.message || 'Failed to submit leave request'
        });
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  getStatusClass(status: LeaveRequestStatus): string {
    const statusMap: Record<LeaveRequestStatus, string> = {
      PENDING: 'badge-warning',
      APPROVED: 'badge-success',
      REJECTED: 'badge-danger',
      CANCELLED: 'badge-secondary'
    };
    return statusMap[status] || 'badge-secondary';
  }

  getBalanceForType(leaveTypeId: number): LeaveBalance | undefined {
    return this.leaveBalances.find(b => b.leaveTypeId === leaveTypeId);
  }
}
