# Staff Attendance — Project Specification

> Audience: Claude Code, working in two repositories:
> 1. **Backoffice repo (existing)** — add an *Attendance* module: database, mobile API, admin/manager UI, background jobs.
> 2. **Android repo (new)** — `attendance-android`, the staff app.
>
> Read this whole file before writing code. Work milestone by milestone (section 12). Stop at the end of each milestone and summarise what was built, what was tested, and any open questions.

---

## 1. Product summary

A GPS-verified staff attendance system for a single client (multi-tenant SaaS later).

Staff use an Android app to:
- check in / check out at their work site, verified by GPS geofence and a live selfie
- see their shift roster, attendance history and leave balances
- apply for leave
- complete daily checklists and assigned tasks, add personal to-dos
- see their own KPIs
- receive reminders (check-in, check-out, tasks due, daily summary)

Managers and admins use the existing backoffice web app to:
- watch today's attendance live and review flagged check-ins
- manage employees, sites/geofences, shifts, rosters, holidays
- approve leave
- define checklists, assign tasks, verify logged work
- define KPIs (admin) and set targets (manager)
- export reports for payroll

### Scope decisions already made
| Decision | Now | Later |
|---|---|---|
| Tenancy | One client | Multi-tenant SaaS — **every table carries `tenant_id` from day one** |
| Staff location | Fixed sites (geofence) | Field staff / route tracking — keep geofence validation behind a policy interface |
| Photo | Store for audit | Face match / liveness — keep a nullable `verification_status` on events |
| Platform | Android only | iOS possible |
| Login | Employee code + PIN, device-bound | — (no SMS OTP: avoids per-SMS cost and DLT registration) |

### Out of scope for now
Face recognition, field/route tracking, iOS, payroll calculation (export only), WhatsApp/SMS notifications, billing-system integration for performance KPIs.

---

## 2. Architecture

```
Android app (Kotlin/Compose) ──HTTPS/JSON──▶ Backoffice: /api/mobile/v1/*
                                                  │
                                 ┌────────────────┼──────────────────┐
                                 ▼                ▼                  ▼
                           Database        Object storage       Background jobs
                         (existing DB)    (photos; S3-compatible)  (scheduler)
                                                  │
                                       Firebase Cloud Messaging ◀─ reminders
                                       Google Play Integrity API ◀─ token decode
Backoffice web UI (existing app) ──▶ Attendance module screens (section 8)
```

### 2.1 Backoffice integration — do this first (Milestone 0)
Before writing code in the backoffice repo, inspect it and write `docs/adr/attendance-module.md` covering:
- framework, language, ORM, migration tool, test framework, UI component library
- how modules/features are organised; where the attendance module will live
- existing user/employee/role tables — **reuse them** if present; otherwise add `att_employees`
- existing auth — the mobile API needs its own token flow (section 6.1); decide whether it can share the existing auth library
- existing job scheduler / queue (cron, Bull, Quartz, Laravel scheduler, etc.)
- existing file storage abstraction
- how the existing app does i18n, timezones, Excel/CSV export

**Rules for the backoffice repo**
- Follow existing conventions exactly (naming, folder layout, lint rules, error handling, API style).
- Do not modify existing modules' behaviour. If a shared change is needed (e.g. auth middleware), describe it and ask first.
- All new tables prefixed `att_` unless an existing table is reused.
- Put the module behind a feature flag / permission so it can be switched off.
- Every migration must be reversible.

### 2.2 Third-party services
| Service | Use | Cost |
|---|---|---|
| Object storage (Cloudflare R2 or S3, or local disk behind the existing storage abstraction) | Selfies, task photos | Small |
| Firebase Cloud Messaging | Push reminders | Free |
| Google Play Integrity API (standard request) | Device/app integrity on check-in | Free within standard quota |
| OpenStreetMap + Leaflet | Geofence map in backoffice | Free |

---

## 3. Domain rules

All times stored in UTC. Each site has a timezone (default `Asia/Kolkata`); dates and shift times are interpreted in the site's timezone.

### 3.1 Check-in / check-out validation (server is the source of truth)
For each event the server:
1. Authenticates the employee and confirms the request comes from their bound device.
2. Verifies the Play Integrity token (section 6.4).
3. Rejects if `is_mock_location = true` → error `MOCK_LOCATION`.
4. Rejects if `accuracy_m > settings.max_gps_accuracy_m` (default 50) → `LOW_GPS_ACCURACY`.
5. Finds the employee's allowed sites; computes haversine distance to each; picks the nearest.
   `inside = distance_m <= site.radius_m`. If not inside any → `OUTSIDE_GEOFENCE` (include nearest site name and distance in `details`).
6. Uses **server time** as the event time for online events (device time is stored but not trusted). Offline events: section 3.6.
7. Applies state rules:
   - `check_in` when already checked in for the current shift → `ALREADY_CHECKED_IN`
   - `check_out` without a check-in → `NOT_CHECKED_IN`
   - same `client_event_id` received twice → return the original result (idempotent, HTTP 200)
8. Requires a photo. Missing/invalid photo → `PHOTO_REQUIRED`.
9. Stores the event with `status = accepted` or `flagged` plus `flag_reasons[]`.

**Flag (accept, but send to the review queue) when:**
- integrity verdict is not `MEETS_DEVICE_INTEGRITY` or app is not recognised (`INTEGRITY_FAILED`) — configurable: `settings.integrity_policy = flag | reject` (default `flag`)
- offline event synced late (`OFFLINE_SYNC`)
- device reboot detected between capture and sync (`CLOCK_UNVERIFIED`)
- device time differs from server time by > 5 min on an online event (`DEVICE_CLOCK_SKEW`)
- impossible travel: distance between this and the previous event / elapsed time > 150 km/h (`IMPOSSIBLE_TRAVEL`)
- identical lat/lng (to 6 decimals) as any of the employee's last 5 events (`REPEATED_COORDINATES`)

### 3.2 Which shift an event belongs to
An event belongs to the employee's rostered shift whose window `[shift_start − 2h, shift_end + 4h]` contains the event time. Night shifts (end ≤ start) end on the next calendar day but **belong to the start date** (`work_date`). If no rostered shift matches, use the employee's default shift template; if none, record the event with `work_date` = local date and flag `NO_SHIFT`.

### 3.3 Daily attendance status (`att_attendance_days`)
Computed per employee per `work_date`, from the first check-in and last check-out:
- `late_minutes = max(0, first_in − (shift_start + grace_minutes))`; if > 0 the day is **late** (still present). Report the actual lateness as `first_in − shift_start`.
- `early_exit_minutes = max(0, shift_end − last_out)`
- `worked_minutes = last_out − first_in − break_minutes`
- `overtime_minutes = max(0, worked_minutes − overtime_after_minutes)`
- Status precedence: `holiday` > `leave` (full day approved) > `weekly_off` > `present` / `late` / `half_day` > `absent`
- `half_day` when `worked_minutes < half_day_min_minutes`
- `missed_checkout` when there's a check-in but no check-out by the nightly close; `worked_minutes = null`; appears in the manager's review list
- Approved half-day leave + attendance for the other half = `present` with `leave_days = 0.5`
- Managers can override any day's status with a mandatory reason (stored in audit log; original values kept).

Recompute a day whenever an event, leave, roster or holiday affecting it changes. The nightly job (section 7) finalises yesterday.

### 3.4 Leave
- Leave types are configurable: code, name, yearly quota, accrual (`annual_upfront` | `monthly`), carry-forward cap, half-day allowed, max consecutive days, attachment required.
- Seed defaults: Casual (CL), Sick (SL), Earned (EL), Comp-off (CO).
- `days` = working days in range per the employee's roster (weekly offs and holidays excluded), minus 0.5 if half day.
- Reject when balance is insufficient (`INSUFFICIENT_BALANCE`) or when overlapping an existing pending/approved request (`OVERLAPPING_LEAVE`).
- Workflow: `pending` → `approved` | `rejected` (by manager, optional comment); staff can `cancel` while pending, or an approved leave whose start date is in the future.
- Balance deducted on approval, restored on cancellation.
- Approval sends a push to the employee.

### 3.5 Tasks
Task `source`:
| source | Created by | Counts for KPI | Visible to manager |
|---|---|---|---|
| `checklist` | daily generator from a checklist template | yes | yes |
| `assigned` | manager | yes | yes |
| `self` | staff (personal to-do) | **no** | **no** |
| `logged` | staff (work already done) | no — until manager marks verified (still excluded from completion %) | yes |

- Checklist templates: scoped to site and/or role, recurrence (daily / specific weekdays), `available_from` time (e.g. closing checklist from 17:30), items with `due_time` and `requires_photo`.
- The generator creates task instances for each rostered employee each morning (or at shift start for night shifts).
- Completing a task with `requires_photo` must include a photo (camera only).
- "Done on time" = `completed_at <= due_at`.

### 3.6 Offline events
The app queues check-in/out events locally when there is no network. Each queued event stores `device_time_at_capture` and `elapsed_realtime_at_capture` (`SystemClock.elapsedRealtime()`); at sync it also sends `elapsed_realtime_at_sync` and `boot_count`.
- Server estimates `event_time = server_receive_time − (elapsed_at_sync − elapsed_at_capture)` when `boot_count` is unchanged; otherwise use device time and flag `CLOCK_UNVERIFIED`.
- Reject offline events older than `settings.offline_max_hours` (default 12) → `OFFLINE_EVENT_TOO_OLD`.
- Always flag `OFFLINE_SYNC` so a manager can see it.
- Geofence/mock/accuracy checks still apply using the captured location.

### 3.7 KPIs
Three permission levels:
- **Admin** defines KPIs: code, name, unit (`percent` | `hours` | `count` | `currency`), `calc_type`, direction (`higher_better` | `lower_better`), period (monthly), applicable roles, default target, whether managers may override the target and within what min/max.
- **Manager** sets targets for their team/individuals within the admin's limits, and enters values for `manual` KPIs.
- **Staff** see only their own KPIs.

Built-in `calc_type`s (computed nightly and at month close):
| calc_type | Formula |
|---|---|
| `on_time_rate` | days not late ÷ days present (%) |
| `hours_worked` | Σ worked_minutes ÷ 60 |
| `late_marks` | count of late days |
| `task_completion` | tasks (checklist+assigned) done on time ÷ tasks due (%) |
| `manual` | value entered by manager (audit-logged) |
| `integration` | reserved — not implemented now |

Rules: targets lock when the period starts (changes apply from next period, history kept); every value records its source (`auto` / `manual` + who + when) and the app shows it.

### 3.8 Reminders
Tenant/site defaults set by admin; staff may mute individual reminder types (not change times).
| Type | When | Condition |
|---|---|---|
| `checkin_reminder` | shift_start + 10 min | not checked in, not on leave |
| `checkout_reminder` | shift_end | checked in, not checked out |
| `task_due` | due_at − 30 min | task open |
| `daily_summary` | 20:00 local | default off |
| `leave_decision` | on approve/reject | always |
| `task_assigned` | on assignment | always |

Each sent notification is stored (in-app inbox) and pushed via FCM. Never send the same reminder twice for the same shift/task.

---

## 4. Data model

Every table: `id` (UUID), `tenant_id`, `created_at`, `updated_at`. Use the existing app's conventions for soft delete and audit columns. Index `(tenant_id, …)` on every lookup path.

```
att_tenants            id, name, timezone, settings_json
att_settings           tenant_id, max_gps_accuracy_m(50), integrity_policy('flag'),
                       offline_max_hours(12), photo_retention_days(180),
                       pin_max_attempts(5), default_grace_minutes(10)
att_sites              name, address, lat, lng, radius_m(default 100), timezone, active
att_employees          (reuse existing employee/user table if present; else:)
                       employee_code UNIQUE per tenant, full_name, phone, email,
                       role ('staff'|'manager'|'admin'), designation, manager_id,
                       default_site_id, default_shift_template_id, weekly_off_days int[],
                       pin_hash, pin_failed_attempts, pin_locked_until, status, joined_on
att_employee_sites     employee_id, site_id                      -- allowed sites
att_devices            employee_id, device_install_id, model, os_version, app_version,
                       fcm_token, bound_at, last_seen_at, status ('active'|'revoked')
                       -- at most one active device per employee
att_refresh_tokens     employee_id, device_id, token_hash, expires_at, revoked_at
att_shift_templates    name, start_time, end_time, break_minutes, grace_minutes,
                       half_day_min_minutes, overtime_after_minutes, color
att_roster_entries     employee_id, work_date, shift_template_id NULL (null = weekly off),
                       site_id   UNIQUE(employee_id, work_date)
att_holidays           site_id NULL (null = all sites), date, name
att_attendance_events  employee_id, device_id, site_id, work_date, type ('check_in'|'check_out'),
                       client_event_id UNIQUE, event_time, server_received_at,
                       device_time, elapsed_realtime_capture, elapsed_realtime_sync, boot_count,
                       captured_offline bool, lat, lng, accuracy_m, location_provider,
                       is_mock_location, integrity_verdict_json, distance_m, inside_geofence,
                       photo_key, verification_status NULL, status ('accepted'|'flagged'|'rejected'),
                       flag_reasons text[], reviewed_by, reviewed_at, review_note
att_attendance_days    employee_id, work_date, shift_template_id, site_id, first_in, last_out,
                       worked_minutes, late_minutes, early_exit_minutes, overtime_minutes,
                       leave_days, status, is_final, override_status, override_by,
                       override_reason, computed_at   UNIQUE(employee_id, work_date)
att_leave_types        code, name, yearly_quota, accrual, carry_forward_max, allow_half_day,
                       max_consecutive_days, attachment_required, active
att_leave_balances     employee_id, leave_type_id, year, opening, accrued, used, adjusted
att_leave_requests     employee_id, leave_type_id, from_date, to_date, half_day,
                       half_day_session ('first'|'second'), days, reason, attachment_key,
                       status, approver_id, decided_at, decision_comment
att_checklist_templates name, site_id NULL, role NULL, weekdays int[], available_from, active
att_checklist_items    template_id, title, due_time, requires_photo, sort_order
att_tasks              employee_id, site_id, work_date, title, description, due_at,
                       source, counts_for_kpi, requires_photo, status ('open'|'done'|'cancelled'),
                       completed_at, photo_key, assigned_by, checklist_template_id,
                       verified_by, verified_at
att_kpi_definitions    code, name, unit, calc_type, direction, period ('monthly'),
                       applicable_roles text[], default_target, manager_can_override,
                       target_min, target_max, active
att_kpi_targets        kpi_id, employee_id NULL, team_manager_id NULL, period ('2026-10'),
                       target_value, set_by, locked_at
att_kpi_values         kpi_id, employee_id, period, value, source ('auto'|'manual'),
                       entered_by, entered_at, computed_at   UNIQUE(kpi_id, employee_id, period)
att_reminder_settings  site_id NULL, type, enabled, offset_minutes, send_at_time
att_reminder_mutes     employee_id, type
att_notifications      employee_id, type, title, body, data_json, dedupe_key UNIQUE,
                       sent_at, read_at
att_audit_log          actor_id, action, entity, entity_id, before_json, after_json, reason
```

Seed data: one tenant, default settings, leave types (CL/SL/EL/CO), shift templates (General 09:00–18:00, Morning 07:00–15:00, Night 22:00–07:00), built-in KPI definitions, reminder defaults.

---

## 5. Photos
- Captured in-app with the front camera only (never gallery). Resize to max 720 px on the long side, JPEG quality 70 (target 100–200 KB). Strip EXIF.
- Uploaded as multipart with the event. Server validates MIME (`image/jpeg`), max 1 MB, decodes to confirm it is an image, stores under `att/{tenant}/{yyyy}/{mm}/{event_id}.jpg`.
- Never publicly readable. Backoffice shows them through short-lived signed URLs or an authenticated proxy, only to managers of that employee and admins.
- Nightly purge deletes photos older than `photo_retention_days`; event rows stay.

---

## 6. Mobile API — `/api/mobile/v1`

JSON, UTF-8, ISO-8601 UTC timestamps, dates as `YYYY-MM-DD`. Errors:
```json
{ "error": { "code": "OUTSIDE_GEOFENCE", "message": "You are 340 m from Main branch.", "details": { "site": "Main branch", "distance_m": 340 } } }
```
`message` is safe to show to staff. Error codes: `INVALID_CREDENTIALS, PIN_LOCKED, DEVICE_NOT_REGISTERED, TOKEN_EXPIRED, MOCK_LOCATION, LOW_GPS_ACCURACY, OUTSIDE_GEOFENCE, ALREADY_CHECKED_IN, NOT_CHECKED_IN, PHOTO_REQUIRED, INTEGRITY_FAILED, OFFLINE_EVENT_TOO_OLD, INSUFFICIENT_BALANCE, OVERLAPPING_LEAVE, VALIDATION_ERROR, NOT_FOUND, FORBIDDEN`.

Every request after login sends `Authorization: Bearer <access>` and `X-Device-Id`, `X-App-Version`.

### 6.1 Auth and device binding
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{employee_code, pin, device:{install_id, model, os_version, app_version}}`. No active device → bind this one. Different active device → `DEVICE_NOT_REGISTERED` (admin resets binding in backoffice). 5 wrong PINs → locked 30 min. Returns `{access_token (15 min), refresh_token (30 days, device-bound), employee}` |
| POST | `/auth/refresh` | rotates refresh token |
| POST | `/auth/logout` | revokes refresh token |
| POST | `/auth/change-pin` | `{current_pin, new_pin}`; PIN = 4–6 digits, not all same, not sequential |

PIN stored with the existing app's password hasher (bcrypt/argon2). Rate-limit `/auth/login` per IP and per employee code.

### 6.2 Profile and config
| GET | `/me` | employee, allowed sites `{id,name,lat,lng,radius_m}`, today's shift, settings `{max_gps_accuracy_m, offline_max_hours}`, unread notification count |
| POST | `/devices/fcm-token` | `{fcm_token}` |

### 6.3 Attendance
| Method | Path | Notes |
|---|---|---|
| GET | `/attendance/today` | shift, status, first_in, last_out, next allowed action, grace deadline |
| POST | `/attendance/events` | multipart: `meta` (JSON below) + `photo` (jpeg) |
| GET | `/attendance/days?month=YYYY-MM` | list of day records |
| GET | `/attendance/summary?month=YYYY-MM` | counts: present, late, half_day, absent, leave, weekly_off, holiday; hours |
| GET | `/shifts?from=&to=` | roster entries with template details; weekly offs; holidays |

`meta`:
```json
{
  "client_event_id": "uuid-v4",
  "type": "check_in",
  "lat": 13.08268, "lng": 80.27072, "accuracy_m": 8.0, "provider": "fused",
  "is_mock_location": false,
  "device_time": "2026-10-17T03:22:05Z",
  "elapsed_realtime_capture": 123456789,
  "elapsed_realtime_sync": 123456999,
  "boot_count": 42,
  "captured_offline": false,
  "integrity_token": "…"
}
```
Response: `{event_id, status, flag_reasons, event_time, site:{id,name}, distance_m, day:{…}}`.

### 6.4 Play Integrity
Use the **standard** Integrity API. The app computes `requestHash = sha256(client_event_id + type + lat + lng + device_time)` and requests a token with it. The server decodes the token via Google's `decodeIntegrityToken` endpoint (service account in config), checks `requestHash` matches, package name matches, `appRecognitionVerdict = PLAY_RECOGNIZED` and `deviceRecognitionVerdict` contains `MEETS_DEVICE_INTEGRITY`. Store the verdict JSON on the event. If Google is unreachable, accept and flag `INTEGRITY_FAILED` (don't block attendance on Google availability). Make the whole check switchable in settings for local development.

### 6.5 Leave
| GET | `/leave/types` |
| GET | `/leave/balances?year=` |
| GET | `/leave/requests?status=` |
| POST | `/leave/requests` — `{leave_type_id, from_date, to_date, half_day, half_day_session, reason}`; returns computed `days` |
| POST | `/leave/requests/{id}/cancel` |
| GET | `/holidays?year=` |

### 6.6 Tasks
| GET | `/tasks?date=` — grouped: checklist, assigned, self, logged |
| POST | `/tasks` — staff create `{title, due_at?, source: "self"|"logged", description?}` |
| POST | `/tasks/{id}/complete` — multipart, optional `photo` (required when `requires_photo`) |
| POST | `/tasks/{id}/reopen` — only same day |
| DELETE | `/tasks/{id}` — only `self` tasks |

### 6.7 KPIs and notifications
| GET | `/kpis?period=YYYY-MM` — `[{code,name,unit,value,target,direction,met,source,source_label,updated_at}]` + weekly on-time breakdown |
| GET | `/notifications?cursor=` |
| POST | `/notifications/{id}/read`, `/notifications/read-all` |
| GET/PUT | `/reminder-preferences` — list of types with `muted` |

Version the API; never break `/v1` once the app is in staff hands.

---

## 7. Background jobs
| Job | Schedule | Work |
|---|---|---|
| Day close | 02:00 site-local | finalise yesterday's `attendance_days`: absent, missed_checkout, holiday, leave, weekly_off |
| Checklist generator | 00:30 site-local | create task instances for today's rostered staff |
| Reminder dispatcher | every 5 min | evaluate section 3.8 rules; dedupe via `dedupe_key` |
| Leave accrual | 1st of month 01:00 | monthly-accrual types |
| KPI compute | nightly + month close | write `att_kpi_values` for auto KPIs; lock next period's targets |
| Photo purge | 03:00 | delete photos older than retention |
| Device cleanup | weekly | drop FCM tokens that FCM reports invalid |

All jobs idempotent and safe to re-run for a given date.

---

## 8. Backoffice UI (inside the existing app)

Use the existing app's layout, navigation, components and table/form patterns. Add an **Attendance** section to the menu.

### Permissions
| Permission | admin | manager | staff |
|---|---|---|---|
| View live board / register | all | own team & sites | — |
| Review flags, override days | all | own team | — |
| Approve leave | all | own team | — |
| Employees, device reset, PIN reset | ✓ | own team (PIN/device reset only) | — |
| Sites, shift templates, holidays, leave types, settings | ✓ | — | — |
| Roster | ✓ | own team | — |
| Checklist templates | ✓ | own sites | — |
| Assign tasks, verify logged work | ✓ | own team | — |
| KPI definitions | ✓ | — | — |
| KPI targets, manual KPI values | ✓ | own team, within limits | — |
| Reports & exports | ✓ | own team | — |

### Screens
1. **Live board (today)** — counters (checked in, late, not yet in, on leave, off, flagged) and a filterable list; each row: name, site, shift, in/out times, status, flag icon. Auto-refresh every 60 s.
2. **Attendance register** — month grid (employees × days) with status codes (P, L, HD, A, LV, WO, H, MC) and colour + letter (never colour alone). Click a cell → day drawer: events with selfie, map pin vs geofence circle, accuracy, distance, flags, device; override form (status + mandatory reason).
3. **Flag review queue** — flagged events, oldest first; side-by-side selfie + map; Accept / Reject with note; bulk accept for `OFFLINE_SYNC`.
4. **Employees** — list, create/edit (code, name, phone, role, manager, allowed sites, default shift, weekly offs), Reset PIN (shows a one-time PIN), Reset device binding, deactivate.
5. **Sites & geofences** — list; editor with Leaflet/OSM map: search address, drag pin, radius slider (25–500 m), circle preview.
6. **Shifts** — shift templates CRUD; **Roster** weekly grid (employees × 7 days), drag/assign templates, copy previous week, bulk assign, mark weekly off.
7. **Holidays** — yearly list per site / all sites, import CSV.
8. **Leave** — approvals inbox (with team calendar showing overlaps), leave types & policies (admin), balances with manual adjustment (reason required).
9. **Tasks** — checklist templates (items, due times, photo required, site/role scope, weekdays, available from); assign tasks to one or many employees; today's completion by employee; verify logged work.
10. **KPIs** — definitions (admin); targets per period for team/individuals (manager, within limits; locked periods read-only); manual value entry; scorecard report.
11. **Reminders** — defaults per type and site.
12. **Reports & exports** (CSV and XLSX): monthly attendance summary for payroll (one row per employee: present, late, half day, absent, leave by type, worked hours, overtime), daily detail, late-comers, leave register, task completion, KPI scorecard.
13. **Settings** — GPS accuracy limit, integrity policy, offline window, photo retention, grace default, PIN policy.

All destructive or overriding actions write to `att_audit_log`.

---

## 9. Android app (`attendance-android`)

### 9.1 Stack
- Kotlin, Jetpack Compose, Material 3; single-activity, Navigation Compose
- MVVM + unidirectional state; Hilt for DI; Coroutines/Flow
- Retrofit + OkHttp + kotlinx.serialization; auth interceptor with refresh
- Room: offline event queue, cached `/me`, roster, history, tasks
- WorkManager: sync queue (network constraint, exponential backoff)
- CameraX (front lens) for selfie and task photos
- Fused Location Provider `getCurrentLocation(PRIORITY_HIGH_ACCURACY)` with 15 s timeout; retry if accuracy is worse than the server limit
- Mock detection: `Location.isMock` (API 31+) / `isFromMockProvider` (older)
- Play Integrity standard API; Firebase Messaging; Crashlytics
- Tokens in DataStore encrypted with an Android Keystore key
- minSdk 26, targetSdk = latest stable
- Build flavours: `dev` (local API, integrity off), `prod`
- Distributed privately (internal testing / managed Google Play), not public

### 9.2 Permissions
Fine location (while in use only — **no background location**), camera, notifications (API 33+). Explain each with a pre-permission screen; handle "denied" and "don't ask again" with a link to settings.

### 9.3 Screens
Design reference: the "Attendance App Screens" canvas (9 screens). Match its layout and copy.

Design tokens:
| Token | Value |
|---|---|
| background | `#F4F6F3` |
| surface | `#FFFFFF`, border `#DCE2DE` |
| text primary / secondary | `#132522` / `#4A5753` |
| primary (actions) | `#0E6B4F`; pressed `#0A4F3A`; soft `#DDEFE6` on text `#0B5A42` |
| late / warning | soft `#FBE9D6` on text `#8A4A0B`; accent `#C46A12` |
| leave | soft `#E3E8F2` on text `#2E3F62` |
| off / neutral | `#ECEEED` on `#3C4945` |
| check-in camera screen | background `#101A18`, accent `#7FD1AE` |
| fonts | Space Grotesk (headings, numbers), IBM Plex Sans (body) |
| radius | 10–16 dp cards, 12 dp buttons; touch targets ≥ 48 dp |

Navigation: bottom bar **Home · Tasks · Attendance · Leave · Me**.

1. **Sign in** — employee code, PIN, "Forgot PIN? Ask your manager", consent note about location/photo. First launch shows consent screen (record acceptance timestamp).
2. **Home** — date and greeting, notifications bell (unread dot), profile; today's shift card; live geofence status (inside / outside, distance, GPS accuracy) refreshed when screen opens; big Check in / Check out button (disabled with reason when outside zone or accuracy too low); on-time-until hint; today's in/out times; today's tasks progress card.
3. **Selfie check-in** — face oval guide, time, location, accuracy; capture → preview → Retake / Confirm; on confirm submit (or queue offline) and show result (success, flagged notice, or error message from API).
4. **Attendance** — month switcher, summary counts, day list with status chips; "Shift roster" link.
5. **Shifts** — week strip, daily shift list (night shifts show "next day"), shift rules (grace, half day, overtime), "Request a shift swap" (Milestone 4 — show disabled for now).
6. **Leave** — balances, apply form (type, from, to, half day + session, reason, computed days), request list with status; cancel action.
7. **Tasks** — progress, checklist / from manager / my tasks / logged work sections; tick to complete (camera when photo needed); "+ Add task" sheet (personal to-do or log work done).
8. **Me (KPIs)** — profile, period switch, KPI tiles with target and met/below, monthly target card, on-time by week chart, source label on each value; settings (change PIN, reminder preferences, sign out).
9. **Notifications** — inbox list; reminder preference toggles.

### 9.4 Behaviour
- Offline: check-in/out and task completion queue locally with section 3.6 timing fields and show "Saved — will sync when online". Leave and task creation require network.
- Show a persistent banner when there are unsynced items.
- Clock display uses server time offset from the last successful API call.
- All API error `message`s shown verbatim in a friendly dialog/snackbar.
- No analytics SDKs beyond Crashlytics. No logging of PIN, tokens or coordinates in release builds.

---

## 10. Security and privacy (India DPDP Act)
- Consent screen on first launch explaining what is collected (location and photo at check-in/out and task photos only), why, retention, and whom to contact. Store consent version + timestamp.
- No background location tracking.
- Photos private, signed-URL access, retention purge.
- Managers see only their team. All overrides and exports audit-logged.
- HTTPS only; certificate pinning optional (off for MVP).
- Rate limiting on auth and event endpoints.
- Data export for an employee on request (admin action) — Milestone 4.

---

## 11. Testing
**Backoffice**
- Unit tests: geofence distance, shift attribution (incl. night shifts across midnight), day status computation for every status, leave day counting, offline time estimation, KPI formulas, reminder rule evaluation and dedupe.
- API tests for every endpoint and every error code in section 6.
- Job tests: re-running a job for the same date produces the same result.

**Android**
- ViewModel unit tests; repository tests with a fake API; Room migration tests.
- UI tests for sign in, check-in happy path, outside-geofence error, offline queue + sync.
- Manual test checklist in `docs/manual-test.md`: mock-location app installed, airplane mode check-in, reboot before sync, night shift, permission denial.

---

## 12. Milestones

Each milestone ends with: passing tests, migrations applied on a clean DB, seed data, a short `CHANGELOG.md` entry, and a summary for review.

**M0 — Discovery (backoffice repo, no feature code)**
- ADR from section 2.1; propose module folder structure; list questions.

**M1 — POC: check-in that works end to end**
- Backoffice: tables for tenants, settings, sites, employees (or reuse), devices, tokens, shift templates, roster, events, days; auth endpoints; `/me`; `/attendance/today`; `/attendance/events` (online only, geofence, mock, accuracy, photo); day computation; screens: Sites (with map), Employees, Shift templates, simple Roster, Live board, Register with day drawer.
- Android: project setup, design tokens, sign in, consent, Home, Selfie check-in/out, error handling.
- Done when: a staff member can check in/out at a geofenced site with a selfie and the manager sees it on the live board with photo and map.

**M2 — MVP part 1: attendance complete**
- Offline queue and sync, Play Integrity, all flag rules, flag review queue, day close job, overrides, holidays, Attendance history + Shifts screens, leave (types, balances, requests, approvals, accrual), reports & exports.

**M3 — MVP part 2: tasks, reminders, KPIs**
- Checklist templates + generator, assigned/self/logged tasks with photos, Tasks screen + Add task sheet, FCM + reminder dispatcher + notifications inbox + preferences, KPI definitions/targets/values, auto KPI computation, Me screen, scorecard report.

**M4 — Later (do not build yet)**
- Shift swap requests, manual + integration KPIs from billing, employee data export, face match/liveness, field staff tracking, multi-tenant onboarding, iOS.

---

## 13. Open questions (ask before the relevant milestone)
1. Does the backoffice already have employee/role tables to reuse? (M0)
2. Exact leave policy: quotas, accrual, carry-forward, sandwich rule for weekends between leave days? (M2)
3. Payroll export format the client's accountant/payroll tool needs. (M2)
4. Is "outside geofence" always a hard reject, or should some roles be allowed to check in with a reason? (M1)
5. Which performance KPIs the client tracks and where that data lives. (M3/M4)
6. Number of staff and sites (sizing for storage and jobs).
