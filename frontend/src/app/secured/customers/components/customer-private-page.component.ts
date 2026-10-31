import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { CustomersService } from "../customers.service";

const BLOCKED = 'customer-print-blocked';

/**
 * Put on every screen that shows customers' details. It does two things:
 *  - a faint watermark of the signed-in person's name and the time over the whole page, so a screenshot or a photo of the screen says who
 *    it came from (it also appears on a printout where printing is allowed);
 *  - printing is turned off for a login that may not read all contact details: the page prints a short notice instead, and the attempt is
 *    kept. Until the screen knows which kind of login this is, printing stays off.
 * A screenshot cannot be blocked in a browser; this makes one traceable.
 */
@Component({
    selector: 'app-private-page',
    template: `
    <div class="cust-watermark" aria-hidden="true" data-testid="cust-watermark">
      <span *ngFor="let t of tiles">{{label}}</span>
    </div>`
})
export class CustomerPrivatePageComponent implements OnInit, OnDestroy {

    @Input() page = 'customers';

    tiles = Array.from({ length: 70 });
    label = '';
    private name = '';
    private blockPrint = true;
    private timer:any;

    constructor(private service:CustomersService){}

    ngOnInit(){
        document.body.classList.add(BLOCKED);          // closed until we know
        this.service.privacy().subscribe(p => {
            this.name = p.userName || '';
            this.blockPrint = !p.canRevealAll;
            this.setPrint();
            this.stamp();
        }, () => { this.name = ''; this.stamp(); });
        this.stamp();
        this.timer = setInterval(() => this.stamp(), 30000);
        window.addEventListener('beforeprint', this.onPrint);
    }

    ngOnDestroy(){
        clearInterval(this.timer);
        window.removeEventListener('beforeprint', this.onPrint);
        document.body.classList.remove(BLOCKED);
    }

    private setPrint(){
        document.body.classList.toggle(BLOCKED, this.blockPrint);
    }

    private stamp(){
        const when = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        this.label = `${this.name || 'Signed in'} · ${when}`;
    }

    private onPrint = () => {
        this.stamp();
        this.service.logEvent('print_attempt', this.page, this.blockPrint).subscribe(() => undefined, () => undefined);
    };
}
