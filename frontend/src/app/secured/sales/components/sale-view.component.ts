import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { DateUtilService } from "../../date-util.service";
import { ProductUtilService } from "../../product-util.service";
import { SaleService } from "../sales.service";

const LICENCE_LABELS: {[type:string]:string} = {
    RETAIL_20_21: 'DL No.', WHOLESALE_20B_21B: 'Wholesale DL No.', FSSAI: 'FSSAI', OTHER: 'Licence'
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** a number below a thousand, in words */
function below1000(n:number): string {
    const parts:string[] = [];
    if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
    if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')); }
    else if (n > 0) { parts.push(ONES[n]); }
    return parts.join(' ');
}

/** a whole number of rupees in words, the Indian way (thousand, lakh, crore) */
export function rupeesInWords(amount:number): string {
    let n = Math.round(Math.abs(amount));
    if (n === 0) return 'Zero';
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const out:string[] = [];
    if (crore) out.push(below1000(crore) + ' Crore');
    if (lakh) out.push(below1000(lakh) + ' Lakh');
    if (thousand) out.push(below1000(thousand) + ' Thousand');
    if (n) out.push(below1000(n));
    return out.join(' ');
}

/** The customer's copy of a bill: what the store is, what was sold and how it was paid, with the tax shown. The same page prints. */
@Component({
    selector: 'app2-sale-view',
    templateUrl: 'sale-view.component.html',
    styleUrls: ['sale-view.component.css']
})
export class SaleViewComponent {

    sale:any = {};
    loaded = false;
    saving:number = 0;
    savedAmount = 0;
    mrpTotal:number = 0;
    finalAmt:number = 0;
    itemsCount:number = 0;
    unitsCount = 0;
    itemsTotal:number = 0;
    roundOff = 0;
    saleStaff:string = '';
    words = '';

    /** who the bill is from: the store's own details, with the business's as the fallback */
    from:any = { name: '', address: '', phone: '', gstin: '', licences: [] as {label:string, numbers:string}[], branch: '' };
    payments:{label:string, amount:number}[] = [];
    gstRows:{rate:number, taxable:number, cgst:number, sgst:number}[] = [];
    gstTotal = 0;
    refills:{title:string, due:Date}[] = [];

    constructor(private route: ActivatedRoute,
      private service:SaleService,
      private dateUtilService: DateUtilService,
      private prodUtilService: ProductUtilService){}

    ngOnInit(){
      const saleId = this.route.snapshot.paramMap.get('id');
      this.service.billHeader(saleId).subscribe((h:any) => this.setHeader(h), () => {});
      this.service.find(saleId).subscribe((data:any) => this.setSale(data));
    }

    private setHeader(h:any){
      if(!h) return;
      const b = h.business || {}, s = h.store || {};
      const join = (...bits:any[]) => bits.map(x => (x || '').toString().trim()).filter(Boolean).join(', ');
      const pin = s.pincode || (s.address ? '' : b.pincode);
      const address = s.address ? join(s.address, pin) : join(b.address, b.pincode);
      const byType:{[t:string]:string[]} = {};
      (h.licences || []).forEach((l:any) => { (byType[l.type] = byType[l.type] || []).push(l.number); });
      this.from = {
        name: b.legalname || b.name || '',
        branch: h.multistore && s.name ? s.name : '',
        address,
        phone: s.phone || '',
        gstin: b.gstin || '',
        licences: Object.keys(byType).map(t => ({ label: LICENCE_LABELS[t] || 'Licence', numbers: byType[t].join(' | ') }))
      };
    }

    private setSale(data:any){
      this.mrpTotal = 0; this.itemsTotal = 0; this.unitsCount = 0;
      const items = (data.items || []).map((i:any) => {
        const unitmrp = i.mrpcost;
        this.mrpTotal += +(unitmrp * i.qty);
        this.itemsTotal += +i.total;
        this.unitsCount += +i.qty || 0;
        return {
          title: i.product?.title,
          props: i.product?.props,
          batch: i.batch,
          expdate: i.expdate ? this.dateUtilService.getOtherDate(new Date(i.expdate), 1) : null,
          qty: i.qty,
          mrp: unitmrp,
          price: i.price,
          taxpcnt: +i.taxpcnt || 0,
          total: i.total,
          supplymonths: +i.supplymonths || 0
        };
      });
      this.sale = {
        id: data.id, billno: data.billno, billdate: data.billdate, items,
        customer: data.customer ? { mobile: data.customer.mobile, name: data.customer.name, email: data.customer.email, address: data.customer.address } : null,
        total: data.total, disccode: data.disccode, discamount: +data.discamount || 0,
        digiamt: +data.digiamt || 0, digimethod: data.digimethod, cashamt: +data.cashamt || 0,
        creditamt: +data.creditamt || 0, staffcreditamt: +data.staffcreditamt || 0
      };
      this.saleStaff = data?.actinguser?.fullname || data?.created?.fullname || '';
      this.itemsCount = items.length;
      this.finalAmt = Math.round(data.total);
      this.words = rupeesInWords(this.finalAmt);
      const afterDiscount = this.itemsTotal - this.sale.discamount;
      const r = +(this.finalAmt - afterDiscount).toFixed(2);
      this.roundOff = Math.abs(r) > 0 && Math.abs(r) < 1 ? r : 0;       // a rounding to the rupee; anything bigger is not rounding, so it is not shown as one
      this.saving = this.mrpTotal > 0 ? this.prodUtilService.getSaving(this.mrpTotal, data.total) : 0;
      this.savedAmount = Math.max(0, Math.round(this.mrpTotal - data.total));

      this.payments = [
        this.sale.digiamt > 0 ? { label: this.sale.digimethod || 'Digital', amount: this.sale.digiamt } : null,
        this.sale.cashamt > 0 ? { label: 'Cash', amount: this.sale.cashamt } : null,
        this.sale.creditamt > 0 ? { label: 'Store credit', amount: this.sale.creditamt } : null,
        this.sale.staffcreditamt > 0 ? { label: 'Staff credit', amount: this.sale.staffcreditamt } : null,
      ].filter(Boolean) as any;

      // the amounts include GST: the tax inside each rate is what is shown, half each as CGST and SGST
      const byRate = new Map<number, number>();
      items.forEach((i:any) => byRate.set(i.taxpcnt, (byRate.get(i.taxpcnt) || 0) + (+i.total || 0)));
      this.gstRows = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]).map(([rate, gross]) => {
        const taxable = gross / (1 + rate / 100);
        const tax = gross - taxable;
        return { rate, taxable, cgst: tax / 2, sgst: tax / 2 };
      });
      this.gstTotal = this.gstRows.reduce((t, g) => t + g.cgst + g.sgst, 0);

      // a medicine supplied for months: when it is likely to run out
      const bill = new Date(data.billdate);
      this.refills = items.filter((i:any) => i.supplymonths > 0).map((i:any) => {
        const due = new Date(bill);
        due.setDate(due.getDate() + Math.round(i.supplymonths * 30));
        return { title: i.title, due };
      });
      this.loaded = true;
    }

}
