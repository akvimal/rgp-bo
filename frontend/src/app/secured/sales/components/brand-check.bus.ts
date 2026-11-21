import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

/**
 * Joins the Check brand box and the Counter guide in the Sales header to the bill on the page. The bill says it is open (`billOpen`) while it is on screen and
 * listens for a product picked in a dialog ("Add to bill"). On a Sales page with no bill open, a dialog queues the product and opens a new bill; the bill
 * takes what is queued as soon as it appears.
 */
@Injectable({ providedIn: "root" })
export class BrandCheckBus {
  billOpen = false;
  readonly pick$ = new Subject<{ productid: number }>();
  private pending: number[] = [];

  /** a product to add to the bill that is about to open */
  queue(productid: number) { if (!this.pending.includes(productid)) this.pending.push(productid); }

  /** what was queued, handed over once */
  takePending(): number[] { const p = this.pending; this.pending = []; return p; }
}
