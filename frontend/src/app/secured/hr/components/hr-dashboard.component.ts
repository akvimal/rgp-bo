import { Component, OnInit } from '@angular/core';
import { ReportingService } from '../services/reporting.service';
import { ScoringService } from '../services/scoring.service';
import { LeaveService } from '../services/leave.service';
import { UserDashboard, LeaderboardEntry, LeaveBalance } from '../models/hr.models';

@Component({
  selector: 'app-hr-dashboard',
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.scss']
})
export class HrDashboardComponent implements OnInit {
  dashboard: UserDashboard | null = null;
  leaderboard: LeaderboardEntry[] = [];
  leaveBalances: LeaveBalance[] = [];
  isLoading = true;

  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1;

  constructor(
    private reportingService: ReportingService,
    private scoringService: ScoringService,
    private leaveService: LeaveService
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadLeaderboard();
    this.loadLeaveBalances();
  }

  loadDashboard(): void {
    this.reportingService.getMyDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard:', error);
        this.isLoading = false;
      }
    });
  }

  loadLeaderboard(): void {
    this.scoringService.getLeaderboard(10).subscribe({
      next: (data) => {
        this.leaderboard = data;
      },
      error: (error) => {
        console.error('Error loading leaderboard:', error);
      }
    });
  }

  loadLeaveBalances(): void {
    this.leaveService.getMyLeaveBalance(this.currentYear).subscribe({
      next: (data) => {
        this.leaveBalances = data;
      },
      error: (error) => {
        console.error('Error loading leave balances:', error);
      }
    });
  }

  getGradeClass(grade: string): string {
    const gradeMap: Record<string, string> = {
      'A+': 'badge-success',
      'A': 'badge-success',
      'B+': 'badge-info',
      'B': 'badge-info',
      'C': 'badge-warning',
      'D': 'badge-warning',
      'F': 'badge-danger',
      'N/A': 'badge-secondary'
    };
    return gradeMap[grade] || 'badge-secondary';
  }

  getRankSuffix(rank: number): string {
    if (rank >= 11 && rank <= 13) return 'th';
    const lastDigit = rank % 10;
    if (lastDigit === 1) return 'st';
    if (lastDigit === 2) return 'nd';
    if (lastDigit === 3) return 'rd';
    return 'th';
  }

  formatScore(score: number | undefined | null): string {
    if (score === undefined || score === null) return '0.0';
    return score.toFixed(1);
  }
}
