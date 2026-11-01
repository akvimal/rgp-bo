import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment";

/** The weekly knowledge check: the person's own page, the check itself, and the team results for the people who run the shop. */
@Injectable({ providedIn: "root" })
export class KnowledgeService {
  private readonly api = `${environment.apiHost}/knowledge`;

  constructor(private http: HttpClient) {}

  me() { return this.http.get<any>(`${this.api}/me`); }
  start(practice: boolean) { return this.http.post<any>(`${this.api}/start`, { practice }); }
  answer(attemptId: number, question: string, choice: number) { return this.http.post<any>(`${this.api}/${attemptId}/answer`, { question, choice }); }
  finish(attemptId: number) { return this.http.post<any>(`${this.api}/${attemptId}/finish`, {}); }
  team() { return this.http.get<any>(`${this.api}/team`); }
}
