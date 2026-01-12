# HR API Quick Start Guide

## Authentication

All HR endpoints require authentication. Include JWT token in headers:

```bash
Authorization: Bearer <your-jwt-token>
```

## Quick Examples

### 1. Create a Work Shift

```bash
curl -X POST http://localhost:3000/hr/shifts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Shift",
    "storeId": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "breakDurationMinutes": 60,
    "daysOfWeek": [1, 2, 3, 4, 5]
  }'
```

**Response:**
```json
{
  "id": 1,
  "name": "Morning Shift",
  "storeId": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "breakDurationMinutes": 60,
  "daysOfWeek": [1, 2, 3, 4, 5],
  "isActive": true
}
```

### 2. Assign Shift to User

```bash
curl -X POST http://localhost:3000/hr/shifts/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 10,
    "shiftId": 1,
    "effectiveFrom": "2025-12-01",
    "effectiveTo": "2026-11-30",
    "daysOfWeek": [1, 2, 3, 4, 5]
  }'
```

### 3. Clock In with Webcam Photo

```bash
curl -X POST http://localhost:3000/hr/attendance/clock-in \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/selfie.jpg" \
  -F "clockInTime=09:05" \
  -F "clockInLocation=Office Main Entrance" \
  -F "latitude=12.9716" \
  -F "longitude=77.5946"
```

**Response:**
```json
{
  "id": 123,
  "userId": 10,
  "attendanceDate": "2025-11-30",
  "clockInTime": "09:05",
  "clockInPhotoUrl": "/upload/hr/attendance/10/1701331200000-abc123.jpg",
  "clockInLocation": "Office Main Entrance",
  "status": "PRESENT"
}
```

### 4. Clock Out

```bash
curl -X POST http://localhost:3000/hr/attendance/clock-out \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/selfie-out.jpg" \
  -F "clockOutTime=17:30" \
  -F "clockOutLocation=Office Main Entrance"
```

**Response includes:**
```json
{
  "id": 123,
  "clockOutTime": "17:30",
  "workedMinutes": 450,
  "status": "PRESENT"
}
```

### 5. Apply for Leave

```bash
curl -X POST http://localhost:3000/hr/leave/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveTypeId": 1,
    "startDate": "2025-12-15",
    "endDate": "2025-12-17",
    "totalDays": 3,
    "reason": "Family vacation",
    "isFirstHalfDay": false,
    "isLastHalfDay": false
  }'
```

**Response:**
```json
{
  "id": 45,
  "userId": 10,
  "leaveTypeId": 1,
  "startDate": "2025-12-15",
  "endDate": "2025-12-17",
  "totalDays": 3,
  "status": "PENDING",
  "reason": "Family vacation"
}
```

### 6. Check Leave Balance

```bash
curl -X GET "http://localhost:3000/hr/leave/balance/my?year=2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "leaveType": "Casual Leave",
    "year": 2025,
    "totalDays": 12,
    "usedDays": 3,
    "availableDays": 9,
    "carriedOver": 0
  },
  {
    "leaveType": "Sick Leave",
    "year": 2025,
    "totalDays": 10,
    "usedDays": 1,
    "availableDays": 9,
    "carriedOver": 0
  }
]
```

### 7. Approve Leave Request (Manager)

```bash
curl -X PATCH http://localhost:3000/hr/leave/request/45/approve \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "approvalComments": "Approved. Enjoy your vacation!"
  }'
```

### 8. View My Monthly Score

```bash
curl -X GET "http://localhost:3000/hr/scoring/my/monthly?year=2025&month=11" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "userId": 10,
  "scoreDate": "2025-11-01",
  "scorePeriod": "MONTHLY",
  "attendanceScore": 95.65,
  "punctualityScore": 92.31,
  "reliabilityScore": 100.00,
  "totalScore": 94.85,
  "grade": "A",
  "scoreDetails": {
    "totalWorkingDays": 22,
    "totalAttendances": 22,
    "presentDays": 21,
    "absentDays": 0,
    "lateDays": 2,
    "approvedLeaves": 1
  }
}
```

### 9. View Leaderboard

```bash
curl -X GET "http://localhost:3000/hr/scoring/leaderboard?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "rank": 1,
    "userId": 15,
    "userName": "John Doe",
    "totalScore": 98.50,
    "grade": "A+"
  },
  {
    "rank": 2,
    "userId": 10,
    "userName": "Jane Smith",
    "totalScore": 94.85,
    "grade": "A"
  }
]
```

### 10. Get My Dashboard

```bash
curl -X GET http://localhost:3000/hr/reports/dashboard/my \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "today": {
    "clockedIn": true,
    "clockedOut": false,
    "clockInTime": "09:05",
    "clockOutTime": null,
    "status": "PRESENT"
  },
  "currentMonth": {
    "presentDays": 18,
    "totalScore": 94.85,
    "grade": "A",
    "rank": 2
  },
  "pendingActions": {
    "pendingLeaveRequests": 0
  }
}
```

### 11. Generate Attendance Report (Manager)

```bash
curl -X GET "http://localhost:3000/hr/reports/attendance?storeId=1&year=2025&month=11" \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

**Response:**
```json
[
  {
    "userId": 10,
    "userName": "Jane Smith",
    "totalDays": 22,
    "presentDays": 21,
    "absentDays": 0,
    "halfDays": 0,
    "leaveDays": 1,
    "remoteDays": 0,
    "lateDays": 2,
    "attendanceRate": 100,
    "punctualityRate": 91
  }
]
```

## Common Query Parameters

### Date Filters
```bash
?year=2025
?month=11
?date=2025-11-30
```

### Pagination
```bash
?limit=50
?offset=0
```

### Filters
```bash
?storeId=1
?userId=10
?status=PENDING
```

## Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request - Validation error |
| 401  | Unauthorized - Invalid/missing token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found |
| 409  | Conflict - Business rule violation |
| 500  | Internal Server Error |

## Error Response Format

```json
{
  "statusCode": 400,
  "timestamp": "2025-11-30T05:30:00.000Z",
  "path": "/hr/attendance/clock-in",
  "method": "POST",
  "message": "Already clocked in today",
  "error": "Bad Request"
}
```

## Business Rules

### Clock In/Out
- ✅ Can clock in once per day
- ✅ Must clock in before clocking out
- ✅ Cannot clock in on public holidays
- ✅ Photo required (optional in development)
- ⚠️ Late threshold: 15 minutes after shift start

### Leave Requests
- ✅ Must have sufficient leave balance
- ✅ Cannot overlap with existing approved leaves
- ✅ Minimum leave: 0.5 days (half day)
- ✅ Cannot apply for past dates
- ⚠️ Approval required from manager

### Performance Scoring
- 📊 Calculated automatically on 1st of each month
- 📊 Based on previous month's data
- 📊 Cached for 15 minutes
- 📊 Leaderboard cached for 5 minutes

## Testing with Postman

### Import Collection

1. Open Postman
2. Import → Link → `http://localhost:3000/api-json`
3. Create environment variable: `baseUrl = http://localhost:3000`
4. Create environment variable: `token = <your-jwt-token>`

### Environment Variables

```
baseUrl: http://localhost:3000
token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
userId: 10
storeId: 1
```

## Frontend Integration Example

### React Hook for Clock In

```typescript
import { useState } from 'react';

export const useClockIn = () => {
  const [loading, setLoading] = useState(false);

  const clockIn = async (photo: File, location: string) => {
    setLoading(true);

    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('clockInTime', new Date().toTimeString().slice(0, 5));
    formData.append('clockInLocation', location);

    try {
      const response = await fetch('/hr/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Clock in failed');

      const data = await response.json();
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { clockIn, loading };
};
```

### Angular Service for Leave Requests

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  constructor(private http: HttpClient) {}

  applyLeave(request: LeaveRequest) {
    return this.http.post('/hr/leave/request', request);
  }

  getMyBalance(year: number) {
    return this.http.get(`/hr/leave/balance/my?year=${year}`);
  }

  getMyRequests() {
    return this.http.get('/hr/leave/requests/my');
  }
}
```

## SQL Queries for Custom Reports

### Top Performers This Month

```sql
SELECT
  u.full_name,
  us.total_score,
  us.grade,
  RANK() OVER (ORDER BY us.total_score DESC) as rank
FROM user_score us
JOIN app_user u ON u.id = us.user_id
WHERE us.score_date = DATE_TRUNC('month', CURRENT_DATE)
  AND us.score_period = 'MONTHLY'
ORDER BY us.total_score DESC
LIMIT 10;
```

### Attendance Summary for Today

```sql
SELECT
  COUNT(*) FILTER (WHERE clock_in_time IS NOT NULL) as clocked_in,
  COUNT(*) FILTER (WHERE clock_out_time IS NOT NULL) as clocked_out,
  COUNT(*) FILTER (WHERE status = 'ABSENT') as absent,
  COUNT(*) FILTER (WHERE status = 'ON_LEAVE') as on_leave
FROM attendance
WHERE attendance_date = CURRENT_DATE;
```

### Pending Leave Requests

```sql
SELECT
  u.full_name,
  lt.name as leave_type,
  lr.start_date,
  lr.end_date,
  lr.total_days,
  lr.reason
FROM leave_request lr
JOIN app_user u ON u.id = lr.user_id
JOIN leave_type lt ON lt.id = lr.leave_type_id
WHERE lr.status = 'PENDING'
ORDER BY lr.created_at ASC;
```

## Troubleshooting

### "Already clocked in today"
- Check if attendance record exists for today
- User can only clock in once per day
- Use PATCH endpoint to update existing record

### "Insufficient leave balance"
- Check leave balance: `GET /hr/leave/balance/my`
- Ensure leave type is correct
- Contact admin to initialize balance if missing

### "Overlapping leave request"
- Another approved leave exists for these dates
- Check existing requests: `GET /hr/leave/requests/my`
- Adjust dates to avoid overlap

### "Photo upload failed"
- File size must be < 5MB
- Format must be JPG, JPEG, or PNG
- Check /upload directory permissions

## Next Steps

1. ✅ Test all endpoints using Postman/Swagger
2. ✅ Integrate with your frontend application
3. ✅ Set up production environment variables
4. ✅ Configure email notifications
5. ✅ Set up monitoring and alerts
6. ✅ Train managers on approval workflows
7. ✅ Roll out to pilot group first

## Support

For issues or questions:
- Check Swagger docs: http://localhost:3000/api
- Review logs: `docker-compose logs -f api`
- Full documentation: `docs/HR_IMPLEMENTATION_COMPLETE.md`

---

**Last Updated:** November 30, 2025
