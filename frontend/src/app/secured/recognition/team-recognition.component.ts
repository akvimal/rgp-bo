import { Component, OnInit } from "@angular/core";
import { RecognitionService, TeamMember } from "./recognition.service";

/**
 * "Your team's recognition" for the Business Head and the Store Head: everyone's badges in name order (no ranking, no points) and a line of thanks.
 * A person whose new badges are paused by an item of their own is marked, so the head can help rather than blame.
 */
@Component({
    selector: 'app-team-recognition',
    template: `
    <section class="card mb-3" *ngIf="team.length" aria-label="Team recognition" data-testid="team-recognition">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h2 class="h6 mb-0">Your team's recognition <span class="text-muted fw-normal small">everyone's badges, in name order: no ranking</span></h2>
          <button class="btn btn-sm btn-link" (click)="collapsed = !collapsed" [attr.aria-expanded]="!collapsed" data-testid="tr-toggle">{{collapsed ? 'Show (' + team.length + ')' : 'Hide'}}</button>
        </div>
        <div class="row g-2 mt-1" *ngIf="!collapsed">
          <div class="col-md-6 col-xl-4" *ngFor="let p of shown">
            <div class="border rounded p-2 h-100">
              <div class="d-flex justify-content-between"><strong>{{p.name}}</strong><span class="small text-muted">{{p.role}}</span></div>
              <div class="d-flex flex-wrap gap-1 my-1">
                <span class="badge bg-success" *ngFor="let b of p.badges">{{b.name}}</span>
                <span class="small text-muted" *ngIf="!p.badges.length">No badge yet</span>
              </div>
              <div class="small text-warning" *ngIf="p.paused">New badges are paused: an item of theirs is late.</div>
              <div class="d-flex gap-1 mt-1" *ngIf="open !== p.id">
                <button class="btn btn-sm" [ngClass]="p.thanked ? 'btn-success' : p.recent ? 'btn-outline-primary' : 'btn-outline-secondary'" (click)="open = p.id; text = ''" [attr.data-testid]="'tr-thank-' + p.id">{{p.thanked ? 'Thanked' : p.recent ? 'Send thanks' : 'Send a note'}}</button>
              </div>
              <div *ngIf="open === p.id" class="mt-1">
                <input class="form-control form-control-sm mb-1" [(ngModel)]="text" maxlength="300" placeholder="One line of thanks" [attr.aria-label]="'Thanks to ' + p.name">
                <button class="btn btn-sm btn-primary me-1" [disabled]="text.trim().length < 3" (click)="send(p)">Send</button>
                <button class="btn btn-sm btn-outline-secondary" (click)="open = null">Cancel</button>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary mt-2" *ngIf="!collapsed && team.length > limit" (click)="showAll = !showAll" data-testid="tr-all">{{showAll ? 'Show fewer' : 'Show all ' + team.length}}</button>
        <div class="small text-success mt-2" *ngIf="sent" role="status">{{sent}}</div>
      </div>
    </section>`
})
export class TeamRecognitionComponent implements OnInit {
    team: TeamMember[] = [];
    /** a long team is shown in part, and the card can be folded away, so it does not push the charts down the page */
    readonly limit = 6;
    showAll = false;
    collapsed = false;
    get shown(): TeamMember[] { return this.showAll ? this.team : this.team.slice(0, this.limit); }
    open: number | null = null;
    text = '';
    sent = '';

    constructor(private service: RecognitionService) {}

    ngOnInit() { this.load(); }

    load() { this.service.team().subscribe({ next: (t) => (this.team = t), error: () => (this.team = []) }); }

    send(p: TeamMember) {
        this.service.thank(p.id, this.text.trim()).subscribe({
            next: () => { this.sent = `Thanks sent to ${p.name}.`; this.open = null; this.load(); },
            error: (e) => (this.sent = e?.error?.message || 'That did not send'),
        });
    }
}
