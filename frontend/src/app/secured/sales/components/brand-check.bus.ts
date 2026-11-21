import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

/**
 * Joins the Check brand box in the Sales header to the bill on the page. The bill says it is open (`billOpen`) while it is on screen and listens for a
 * product picked in the dialog ("Add to bill"); on the other Sales pages no bill is open and the dialog only shows the result.
 */
@Injectable({ providedIn: "root" })
export class BrandCheckBus {
  billOpen = false;
  readonly pick$ = new Subject<{ productid: number }>();
}
