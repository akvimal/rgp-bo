import { Injectable, Pipe, PipeTransform } from "@angular/core";
import { PropsService } from "./props.service";

/** the words of a business that is nothing in particular; a pack's words (a pharmacy's "medicine") come from the server and replace these */
const BASE: { [k: string]: string } = {
    item: 'item', items: 'items', Item: 'Item', Items: 'Items', Goods: 'Goods', goods: 'goods',
    shop: 'shop', Shop: 'Shop', professional: 'staff member', Professional: 'Staff member',
};

/**
 * The words a screen uses for the things of this business: item, shop, the person who is registered. One lookup, so a screen says "medicine"
 * for a pharmacy and "item" for a business that is not one, and a new kind of business only has to give its own words.
 */
@Injectable({ providedIn: 'root' })
export class LabelService {
    labels: { [k: string]: string } = { ...BASE };

    constructor(props: PropsService) {
        props.labels$.subscribe((l: any) => { this.labels = { ...BASE, ...(l || {}) }; });
    }

    term(key: string): string { return this.labels[key] ?? key; }
}

/** {{ 'items' | term }} */
@Pipe({ name: 'term', pure: false })
export class TermPipe implements PipeTransform {
    constructor(private labels: LabelService) {}
    transform(key: string): string { return this.labels.term(key); }
}
