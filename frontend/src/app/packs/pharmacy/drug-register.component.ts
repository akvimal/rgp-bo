import { Component, OnInit } from "@angular/core";
import { saveAs } from "file-saver";
import { DrugRegisterService } from "./drug-register.service";

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/**
 * The online register of Schedule H, H1 and X drugs (pharmacy pack): every scheduled drug supplied, with the patient and the prescriber, in the
 * register's own numbering. Printed for an inspector, or downloaded to Excel. The counter writes it through the bill.
 */
@Component({
    templateUrl: './drug-register.component.html'
})
export class DrugRegisterComponent implements OnInit {

    data: any = null;
    error = '';
    loading = false;
    f: any = { schedule: '', from: '', to: '', storeid: null, q: '', superseded: false };

    constructor(private service: DrugRegisterService) {}

    ngOnInit() {
        const now = new Date();
        this.f.to = iso(now);
        this.f.from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
        this.load();
    }

    private msg(err: any, fallback: string): string {
        const m = err?.error?.message;
        return (Array.isArray(m) ? m.join(' ') : m) || fallback;
    }

    private query() { return { ...this.f, superseded: this.f.superseded ? 'true' : '' }; }

    load() {
        this.error = ''; this.loading = true;
        this.service.register(this.query()).subscribe((r: any) => { this.data = r; this.loading = false; }, (e: any) => { this.loading = false; this.error = this.msg(e, 'Could not load the register.'); });
    }

    month(offset: number) {
        const n = new Date();
        const a = new Date(n.getFullYear(), n.getMonth() + offset, 1), b = new Date(n.getFullYear(), n.getMonth() + offset + 1, 0);
        this.f.from = iso(a); this.f.to = iso(offset === 0 ? n : b); this.load();
    }

    year() {
        const n = new Date();
        const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
        this.f.from = `${y}-04-01`; this.f.to = iso(n); this.load();
    }

    print() {
        this.error = '';
        this.service.file('pdf', this.query()).subscribe((b: Blob) => {
            const url = URL.createObjectURL(b);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, async (e: any) => { this.error = await this.blobMsg(e, 'Could not make the register.'); });
    }

    download() {
        this.error = '';
        this.service.file('xlsx', this.query()).subscribe((b: Blob) => saveAs(b, `drug-register-${this.f.from}-to-${this.f.to}.xlsx`), async (e: any) => { this.error = await this.blobMsg(e, 'Could not make the file.'); });
    }

    private async blobMsg(e: any, fallback: string): Promise<string> {
        try { return JSON.parse(await e.error.text()).message || fallback; } catch { return fallback; }
    }
}
