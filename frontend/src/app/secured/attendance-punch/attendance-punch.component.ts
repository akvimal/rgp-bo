import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { AttendanceApi } from "../attendance/attendance.service";

/**
 * Mark attendance on a registered store PC: the person taps their name, enters their PIN, and the webcam takes a photo as they mark In or Out.
 * A manager reviews each day (photo and times) later; payroll waits for that review.
 */
@Component({
  selector: "app-attendance-punch",
  template: `
    <div class="pagetitle"><h1>Mark attendance</h1></div>
    <div class="row g-3">
      <div class="col-lg-5">
        <div class="card"><div class="card-body pt-3 text-center">
          <div class="display-6 mb-1" data-testid="ap-clock">{{clock | date:'h:mm a'}}</div>
          <div class="text-muted mb-2">{{clock | date:'EEEE, d MMMM yyyy'}}<span *ngIf="device"> · {{device}}</span></div>
          <video #video autoplay muted playsinline style="width:100%;max-width:420px;border-radius:8px;background:#222;transform:scaleX(-1)" data-testid="ap-video"></video>
          <div class="alert alert-warning py-2 mt-2 mb-0 small" *ngIf="camError" data-testid="ap-camerror">{{camError}}</div>
        </div></div>
      </div>
      <div class="col-lg-7">
        <div class="card"><div class="card-body pt-3">
          <div *ngIf="done" class="alert alert-success" data-testid="ap-done">
            <strong>{{done.name}}</strong>: {{done.kind === 'IN' ? 'In' : 'Out'}} marked at {{done.time}}.
            <span *ngIf="done.flags.includes('LATE')" class="badge bg-warning text-dark ms-1">Late</span>
            <span *ngIf="done.flags.includes('EARLY_OUT')" class="badge bg-warning text-dark ms-1">Early out</span>
          </div>
          <div *ngIf="loadError" class="alert alert-danger py-2" data-testid="ap-loaderror">{{loadError}}</div>

          <ng-container *ngIf="!picked">
            <h6 class="mb-2">Tap your name</h6>
            <div class="text-muted" *ngIf="!loadError && !staff.length">No one is set up to mark attendance here yet. A manager does that under Attendance review, PINs.</div>
            <div class="row g-2">
              <div class="col-6 col-md-4" *ngFor="let s of staff">
                <button type="button" class="btn w-100 py-3 text-start" [ngClass]="s.state === 'DONE' ? 'btn-outline-secondary' : s.state === 'IN' ? 'btn-outline-success' : 'btn-outline-primary'"
                        (click)="pick(s)" data-testid="ap-staff" [attr.data-id]="s.id">
                  <div class="fw-semibold">{{s.name}}</div>
                  <div class="small">{{s.state === 'NONE' ? 'Not in yet' : s.state === 'IN' ? 'In at ' + s.in_time : 'In ' + s.in_time + ', Out ' + s.out_time}}</div>
                </button>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="picked">
            <h5 class="mb-1">{{picked.name}}</h5>
            <div class="text-muted small mb-2">{{picked.state === 'IN' ? 'Marking Out (you came in at ' + picked.in_time + ')' : picked.state === 'DONE' ? 'Already marked In and Out today' : 'Marking In'}}</div>
            <div *ngIf="error" class="alert alert-danger py-2" data-testid="ap-error">{{error}}</div>
            <div class="mb-2"><input type="password" inputmode="numeric" class="form-control form-control-lg text-center" style="letter-spacing:.5em;max-width:260px" maxlength="6" placeholder="PIN"
                   [(ngModel)]="pin" (keyup.enter)="submit()" autocomplete="off" data-testid="ap-pin"></div>
            <div class="d-flex flex-wrap gap-1 mb-3" style="max-width:260px">
              <button type="button" class="btn btn-outline-dark" style="width:80px" *ngFor="let d of keys" (click)="key(d)">{{d}}</button>
              <button type="button" class="btn btn-outline-dark" style="width:80px" (click)="pin = ''">Clear</button>
              <button type="button" class="btn btn-outline-dark" style="width:80px" (click)="key('0')">0</button>
              <button type="button" class="btn btn-outline-dark" style="width:80px" (click)="pin = pin.slice(0, -1)">&larr;</button>
            </div>
            <button type="button" class="btn btn-lg me-2" [ngClass]="picked.state === 'IN' ? 'btn-warning' : 'btn-success'" [disabled]="busy || picked.state === 'DONE' || pin.length < 4 || !!camError" (click)="submit()" data-testid="ap-submit">
              {{busy ? 'Saving...' : picked.state === 'IN' ? 'Mark Out' : 'Mark In'}}</button>
            <button type="button" class="btn btn-outline-secondary btn-lg" (click)="cancel()" data-testid="ap-cancel">Back</button>
            <div class="small text-muted mt-2">Look at the camera. A photo is taken when you mark, and your manager checks it.</div>
          </ng-container>
        </div></div>
      </div>
    </div>`,
})
export class AttendancePunchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("video") video!: ElementRef<HTMLVideoElement>;
  staff: any[] = [];
  device = "";
  loadError = "";
  camError = "";
  error = "";
  picked: any = null;
  pin = "";
  busy = false;
  done: any = null;
  clock = new Date();
  keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  private stream: MediaStream | null = null;
  private timers: any[] = [];

  constructor(private api: AttendanceApi) {}

  ngOnInit() {
    this.load();
    this.timers.push(setInterval(() => (this.clock = new Date()), 20000));
    // a PC left open should show who is in now, and move on to the next day
    this.timers.push(setInterval(() => { if (!this.picked) this.load(); }, 120000));
  }

  ngAfterViewInit() { this.startCamera(); }

  ngOnDestroy() {
    this.timers.forEach(clearInterval);
    this.stream?.getTracks().forEach(t => t.stop());
  }

  load() {
    this.api.staff().subscribe(
      (r: any) => { this.staff = r.staff; this.device = r.device; this.loadError = ""; },
      (e: any) => { this.loadError = this.api.msg(e, "The list could not be loaded."); });
  }

  startCamera() {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      this.camError = "The camera needs a secure page (https). Open the app with its https address on this PC.";
      return;
    }
    md.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then(s => {
        this.stream = s;
        const v = this.video.nativeElement;
        v.srcObject = s;
        v.play().catch(() => undefined);
      })
      .catch(() => { this.camError = "The camera is blocked or not found. Allow the camera for this site (the lock icon in the address bar), then reload."; });
  }

  pick(s: any) { this.picked = s; this.pin = ""; this.error = ""; this.done = null; }
  cancel() { this.picked = null; this.pin = ""; this.error = ""; }
  key(d: string) { this.pin = (this.pin + d).slice(0, 6); }

  /** a JPEG of the camera now, or null (and an error) when the picture is dark or flat, as when the lens is covered */
  private capture(): string | null {
    const v = this.video?.nativeElement;
    if (!v || !v.videoWidth) { this.error = "The camera is not ready yet. Wait a moment and try again."; return null; }
    const c = document.createElement("canvas");
    c.width = 480; c.height = 360;
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(v, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, sumSq = 0, n = 0;
    for (let i = 0; i < px.length; i += 64) { const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; sum += l; sumSq += l * l; n++; }
    const mean = sum / n, sd = Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
    if (mean < 25 || sd < 8) { this.error = "The camera picture is dark or covered. Uncover the lens, face the camera and try again."; return null; }
    return c.toDataURL("image/jpeg", 0.7);
  }

  submit() {
    if (this.busy || !this.picked || this.pin.length < 4) return;
    this.error = "";
    const photo = this.capture();
    if (!photo) return;
    this.busy = true;
    this.api.punch({ employee_id: this.picked.id, pin: this.pin, photo }).subscribe(
      (r: any) => {
        this.busy = false; this.done = r; this.picked = null; this.pin = "";
        this.load();
        this.timers.push(setTimeout(() => (this.done = null), 6000));
      },
      (e: any) => { this.busy = false; this.pin = ""; this.error = this.api.msg(e); });
  }
}
