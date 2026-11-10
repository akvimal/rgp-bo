import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

/** The bill-level WhatsApp calls (what was sent for a bill, send it, preview the PDF). */
@Injectable({ providedIn: "root" })
export class WhatsappService {
  private readonly api = `${environment.apiHost}/whatsapp`;
  constructor(private http: HttpClient) {}

  forSale(saleId: number): Observable<any[]> { return this.http.get<any[]>(`${this.api}/bill/${saleId}`); }
  sendBill(saleId: number): Observable<any> { return this.http.post<any>(`${this.api}/bill/${saleId}`, {}); }
  billPdf(saleId: number): Observable<Blob> { return this.http.get(`${this.api}/bill/${saleId}/pdf`, { responseType: "blob" }); }
}
