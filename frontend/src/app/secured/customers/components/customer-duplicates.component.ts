import { Component, OnInit } from "@angular/core";
import { CustomersService } from "../customers.service";

@Component({
    templateUrl: 'customer-duplicates.component.html'
})
export class CustomerDuplicatesComponent implements OnInit {

    groups: any[] = [];
    loading = false;
    message = '';
    error = '';
    keep: { [mobile: string]: number } = {};
    picked: { [id: number]: boolean } = {};
    working = '';

    constructor(private service: CustomersService) {}

    ngOnInit() { this.load(); }

    load() {
        this.loading = true;
        this.service.duplicates().subscribe((g: any[]) => {
            this.groups = g || [];
            this.loading = false;
            for (const grp of this.groups) {
                if (!(grp.mobile in this.keep)) this.keep[grp.mobile] = grp.members[0].id;   // the busiest record
            }
        }, err => { this.loading = false; this.error = this.msg(err, 'Could not load the duplicates.'); });
    }

    toMerge(g: any): number[] {
        return g.members.filter((m: any) => m.id !== this.keep[g.mobile] && this.picked[m.id]).map((m: any) => m.id);
    }

    merge(g: any) {
        const ids = this.toMerge(g);
        if (!ids.length) return;
        this.working = g.mobile;
        this.message = '';
        this.error = '';
        this.service.merge(this.keep[g.mobile], ids).subscribe((r: any) => {
            this.working = '';
            this.message = `${r.merged.length} record(s) merged into ${String(r.keep.name).trim()}: bills and history now sit on that customer.`;
            for (const id of ids) delete this.picked[id];
            this.load();
        }, err => { this.working = ''; this.error = this.msg(err, 'Could not merge.'); });
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return Array.isArray(m) ? m.join(' ') : (m || fallback);
    }
}
