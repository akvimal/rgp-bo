import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { UsersService } from "../secured/settings/users/users.service";
import { RolesService } from "../secured/settings/roles/roles.service";
import { GROUP_LABELS, GUIDE_META, GuideGroup, PageGuide, Walkthrough, DayPlan } from "./app-guide-content";
import { GuideHit, dayKindOf, dayPlanOf, groupedPages, roleMatrix, searchGuide, visiblePages, visibleWalkthroughs } from "./app-guide-rules";

type Tab = 'day' | 'pages' | 'jobs' | 'roles';

/**
 * The app guide: what each page of the app is for and how to do the common jobs, for the pages this login can open. It displays the content in
 * app-guide-content.ts, chosen by the rules in app-guide-rules.ts, and keeps nothing.
 */
@Component({
  templateUrl: "./app-guide.component.html",
  styles: [`
    .guide-nav .nav-link { cursor: pointer; }
    .page-card { border-left: 4px solid var(--bs-primary); }
    .job-card { border-left: 4px solid var(--bs-success); }
    @media print { .no-print { display: none !important; } .card { border: 0 !important; box-shadow: none !important; } }
  `],
})
export class AppGuideComponent implements OnInit {
  readonly meta = GUIDE_META;
  readonly labels = GROUP_LABELS;

  tab: Tab = 'day';
  query = '';
  hits: GuideHit[] = [];
  pages: PageGuide[] = [];
  walks: Walkthrough[] = [];
  groups: { group: GuideGroup; pages: PageGuide[] }[] = [];
  day: DayPlan = dayPlanOf('other');
  roleName = '';
  /** the walk-through or page opened from a search or a link */
  openJob = '';
  openPage = '';

  /** the owner's table: which pages each role opens */
  canSeeRoles = false;
  matrix: { role: string; ids: Set<string> }[] = [];
  matrixLoaded = false;

  constructor(private auth: AuthService, private users: UsersService, private roles: RolesService) {}

  private access() {
    return { has: (...k: string[]) => k.some((x) => this.auth.isActionAuthorized(x)), canOpen: (u: string) => this.auth.isUrlAuthorized(u), pack: (n: string) => this.auth.packOn(n) };
  }

  ngOnInit() {
    const a = this.access();
    this.pages = visiblePages(a);
    this.walks = visibleWalkthroughs(this.pages);
    this.groups = groupedPages(this.pages);
    this.canSeeRoles = a.has('roles');
    this.users.getCurrentUser().subscribe((u: any) => {
      this.roleName = u?.rolename || '';
      this.day = dayPlanOf(dayKindOf(this.roleName));
    }, () => undefined);
  }

  setTab(t: Tab) {
    this.tab = t; this.query = ''; this.hits = [];
    if (t === 'roles' && !this.matrixLoaded) this.loadMatrix();
  }

  search() { this.hits = searchGuide(this.query, this.pages, this.walks); }
  clearSearch() { this.query = ''; this.hits = []; }

  /** a search result: open it on its own tab */
  show(h: GuideHit) {
    this.clearSearch();
    if (h.kind === 'page') { this.tab = 'pages'; this.openPage = h.id; }
    else { this.tab = 'jobs'; this.openJob = h.id; }
  }

  toggleJob(id: string) { this.openJob = this.openJob === id ? '' : id; }
  togglePage(id: string) { this.openPage = this.openPage === id ? '' : id; }

  pageOf(id: string): PageGuide | undefined { return this.pages.find((p) => p.id === id); }

  private loadMatrix() {
    (this.roles.findAll() as any).subscribe((rs: any[]) => {
      this.matrix = roleMatrix((rs || []).map((r: any) => ({ name: r.name, permissions: r.permissions })), (n: string) => this.auth.packOn(n), this.pages);
      this.matrixLoaded = true;
    }, () => { this.matrix = []; this.matrixLoaded = true; });
  }

  print() { window.print(); }
}
