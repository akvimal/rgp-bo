import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserScore, LeaderboardEntry } from '../models/hr.models';

@Injectable({
  providedIn: 'root'
})
export class ScoringService {
  private baseUrl = `${environment.apiHost}/hr/scoring`;

  constructor(private http: HttpClient) {}

  // Calculate Scores
  calculateUserMonthlyScore(userId: number, year: number, month: number): Observable<UserScore> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.post<UserScore>(`${this.baseUrl}/calculate/${userId}`, null, { params });
  }

  batchCalculateMonthlyScores(year: number, month: number): Observable<void> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.post<void>(`${this.baseUrl}/batch/calculate`, null, { params });
  }

  // Get Scores
  getUserMonthlyScore(userId: number, year: number, month: number): Observable<UserScore | null> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<UserScore | null>(`${this.baseUrl}/user/${userId}/monthly`, { params });
  }

  getMyMonthlyScore(year: number, month: number): Observable<UserScore | null> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<UserScore | null>(`${this.baseUrl}/my/monthly`, { params });
  }

  getMonthlyScores(year: number, month: number): Observable<UserScore[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());
    return this.http.get<UserScore[]>(`${this.baseUrl}/monthly`, { params });
  }

  // Leaderboard
  getLeaderboard(limit: number = 50): Observable<LeaderboardEntry[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<LeaderboardEntry[]>(`${this.baseUrl}/leaderboard`, { params });
  }
}
