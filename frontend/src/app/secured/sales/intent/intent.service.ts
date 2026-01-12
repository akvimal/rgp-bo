import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { SalesIntent, CreateSalesIntentDto, UpdateSalesIntentDto } from './intent.model';

@Injectable({
    providedIn: 'root'
})
export class IntentService {
    private apiUrl = environment.apiHost;

    constructor(private http: HttpClient) {}

    /**
     * Create a new sales intent
     */
    create(dto: CreateSalesIntentDto): Observable<SalesIntent> {
        return this.http.post<SalesIntent>(`${this.apiUrl}/sales-intent`, dto);
    }

    /**
     * Get all sales intents with optional filters
     */
    findAll(filters?: any): Observable<SalesIntent[]> {
        const params: any = {};
        if (filters) {
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params[key] = filters[key];
                }
            });
        }
        return this.http.get<SalesIntent[]>(`${this.apiUrl}/sales-intent`, { params });
    }

    /**
     * Get pending intents for PO generation
     */
    getPendingForPO(): Observable<SalesIntent[]> {
        return this.http.get<SalesIntent[]>(`${this.apiUrl}/sales-intent/pending-for-po`);
    }

    /**
     * Get sales intent by ID
     */
    findOne(id: number): Observable<SalesIntent> {
        return this.http.get<SalesIntent>(`${this.apiUrl}/sales-intent/${id}`);
    }

    /**
     * Update sales intent
     */
    update(id: number, dto: UpdateSalesIntentDto): Observable<SalesIntent> {
        return this.http.put<SalesIntent>(`${this.apiUrl}/sales-intent/${id}`, dto);
    }

    /**
     * Update fulfillment status
     */
    updateFulfillment(id: number, fulfillmentstatus: string, notes?: string): Observable<SalesIntent> {
        return this.http.put<SalesIntent>(`${this.apiUrl}/sales-intent/${id}/fulfillment`, {
            fulfillmentstatus,
            internalnotes: notes
        });
    }

    /**
     * Cancel sales intent
     */
    cancel(id: number, reason?: string): Observable<SalesIntent> {
        return this.http.put<SalesIntent>(`${this.apiUrl}/sales-intent/${id}/cancel`, { reason });
    }

    /**
     * Delete sales intent
     */
    delete(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/sales-intent/${id}`);
    }
}
