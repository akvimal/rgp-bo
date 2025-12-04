import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AttendanceService } from '../services/attendance.service';
import { Attendance, ClockInDto, ClockOutDto } from '../models/hr.models';

@Component({
  selector: 'app-attendance-clock',
  templateUrl: './attendance-clock.component.html',
  styleUrls: ['./attendance-clock.component.scss']
})
export class AttendanceClockComponent implements OnInit {
  WIDTH = 640;
  HEIGHT = 480;

  @ViewChild('video') video: ElementRef;
  @ViewChild('canvas') canvas: ElementRef;

  today = new Date();
  todayAttendance: Attendance | null = null;
  monthlyAttendance: Attendance[] = [];
  isLoading = false;
  isLoadingHistory = false;
  showCamera = false;
  isCaptured = false;
  capturedImage: string | null = null;
  currentAction: 'clock-in' | 'clock-out' | null = null;

  constructor(
    private attendanceService: AttendanceService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadTodayAttendance();
    this.loadMonthlyAttendance();
  }

  loadTodayAttendance(): void {
    this.isLoading = true;
    this.attendanceService.getTodayAttendance().subscribe({
      next: (attendance) => {
        this.todayAttendance = attendance;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading attendance:', error);
        this.isLoading = false;
      }
    });
  }

  loadMonthlyAttendance(): void {
    this.isLoadingHistory = true;
    const year = this.today.getFullYear();
    const month = this.today.getMonth() + 1;

    this.attendanceService.getMonthlyAttendance(year, month).subscribe({
      next: (records) => {
        this.monthlyAttendance = records.sort((a, b) =>
          new Date(b.attendancedate).getTime() - new Date(a.attendancedate).getTime()
        );
        this.isLoadingHistory = false;
      },
      error: (error) => {
        console.error('Error loading attendance history:', error);
        this.isLoadingHistory = false;
      }
    });
  }

  async startCamera(action: 'clock-in' | 'clock-out'): Promise<void> {
    this.currentAction = action;
    this.showCamera = true;
    this.isCaptured = false;
    this.capturedImage = null;

    setTimeout(async () => {
      await this.setupCamera();
    }, 100);
  }

  async setupCamera(): Promise<void> {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (stream && this.video) {
          this.video.nativeElement.srcObject = stream;
          this.video.nativeElement.play();
        }
      } catch (error) {
        console.error('Camera access denied:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Camera Error',
          detail: 'Unable to access camera. Please grant permission.'
        });
        this.showCamera = false;
      }
    }
  }

  capturePhoto(): void {
    if (!this.canvas || !this.video) return;

    const context = this.canvas.nativeElement.getContext('2d');
    context.drawImage(this.video.nativeElement, 0, 0, this.WIDTH, this.HEIGHT);
    this.capturedImage = this.canvas.nativeElement.toDataURL('image/jpeg');
    this.isCaptured = true;

    // Stop camera stream
    const stream = this.video.nativeElement.srcObject;
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
  }

  retakePhoto(): void {
    this.isCaptured = false;
    this.capturedImage = null;
    this.setupCamera();
  }

  cancelCamera(): void {
    if (this.video && this.video.nativeElement.srcObject) {
      const stream = this.video.nativeElement.srcObject;
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
    this.showCamera = false;
    this.isCaptured = false;
    this.capturedImage = null;
    this.currentAction = null;
  }

  dataURLtoFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  submitClockAction(): void {
    if (!this.capturedImage) return;

    const photo = this.dataURLtoFile(this.capturedImage, `attendance-${Date.now()}.jpg`);

    this.isLoading = true;

    if (this.currentAction === 'clock-in') {
      const dto: ClockInDto = {
        photo
      };

      this.attendanceService.clockIn(dto).subscribe({
        next: (response) => {
          this.todayAttendance = response;
          this.messageService.add({
            severity: 'success',
            summary: 'Clocked In',
            detail: 'Successfully clocked in'
          });

          // Show warning if present
          if (response.warning) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Late Clock In',
              detail: response.warning,
              life: 8000
            });
          }

          this.cancelCamera();
          this.isLoading = false;
          this.loadMonthlyAttendance(); // Refresh history
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Clock In Failed',
            detail: error.error?.message || 'Failed to clock in'
          });
          this.isLoading = false;
        }
      });
    } else if (this.currentAction === 'clock-out') {
      const dto: ClockOutDto = {
        photo
      };

      this.attendanceService.clockOut(dto).subscribe({
        next: (response) => {
          this.todayAttendance = response;
          this.messageService.add({
            severity: 'success',
            summary: 'Clocked Out',
            detail: 'Successfully clocked out'
          });

          // Show warning if present
          if (response.warning) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Early Clock Out',
              detail: response.warning,
              life: 8000
            });
          }

          this.cancelCamera();
          this.isLoading = false;
          this.loadMonthlyAttendance(); // Refresh history
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Clock Out Failed',
            detail: error.error?.message || 'Failed to clock out'
          });
          this.isLoading = false;
        }
      });
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatTime(date: Date | null): string {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  get canClockIn(): boolean {
    return !this.todayAttendance || !this.todayAttendance.clockintime;
  }

  get canClockOut(): boolean {
    return !!this.todayAttendance?.clockintime && !this.todayAttendance?.clockouttime;
  }

  get workedHours(): string {
    if (!this.todayAttendance?.totalhours) return '0h 0m';
    const hours = Math.floor(this.todayAttendance.totalhours);
    const minutes = Math.round((this.todayAttendance.totalhours % 1) * 60);
    return `${hours}h ${minutes}m`;
  }
}
