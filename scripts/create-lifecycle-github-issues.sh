#!/bin/bash

# GitHub Issue Creation Script for Employee Lifecycle Management Module
# This script creates a complete Epic/Story/Task hierarchy in GitHub

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Creating Employee Lifecycle Management Issues${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Create labels first
echo -e "${GREEN}Creating labels...${NC}"
gh label create "epic" --description "Epic-level issue tracking multiple stories" --color "8B008B" --force
gh label create "story" --description "User story" --color "0052CC" --force
gh label create "task" --description "Implementation task" --color "FFA500" --force
gh label create "enhancement" --description "New feature or request" --color "A2EEEE" --force
gh label create "module:employee-lifecycle" --description "Employee Lifecycle Management module" --color "D4C5F9" --force
gh label create "priority:high" --description "High priority" --color "D93F0B" --force
gh label create "priority:medium" --description "Medium priority" --color "FBCA04" --force
gh label create "priority:low" --description "Low priority" --color "0E8A16" --force
gh label create "phase:1" --description "Phase 1 - Foundation" --color "C2E0C6" --force
gh label create "phase:2" --description "Phase 2 - Job Offers" --color "C2E0C6" --force
gh label create "phase:3" --description "Phase 3 - Onboarding" --color "C2E0C6" --force
gh label create "phase:4" --description "Phase 4 - Documents" --color "C2E0C6" --force
gh label create "phase:5" --description "Phase 5 - Performance" --color "C2E0C6" --force
gh label create "phase:6" --description "Phase 6 - Exit" --color "C2E0C6" --force
gh label create "phase:7" --description "Phase 7 - Analytics" --color "C2E0C6" --force
gh label create "phase:8" --description "Phase 8 - Testing" --color "C2E0C6" --force

echo -e "${GREEN}✓ Labels created${NC}"
echo ""

# Create Epic
echo -e "${GREEN}Creating Epic...${NC}"

EPIC_BODY=$(cat <<'EOF'
## 🎯 Overview

Implement a comprehensive Employee Lifecycle Management module that covers the complete employee journey from job offer to exit, including onboarding, performance reviews, resignation, and exit management.

## 🎪 Business Value

- **Streamlined Hiring**: Reduce time-to-hire with automated offer management and onboarding workflows
- **Improved Retention**: Track employee lifecycle stages and identify retention risks early
- **Compliance**: Ensure statutory compliance with document tracking and expiry alerts
- **Data-Driven Decisions**: Turnover analytics and retention metrics for better workforce planning
- **Efficient Offboarding**: Systematic exit process with clearance checklists and final settlement calculation

## 📊 Current State

### ✅ What Exists:
- HR features (attendance, leave, shifts, KPI scoring)
- Flexible payroll system with multiple employment types
- User and role management with RBAC
- Document management system
- Audit trails

### ❌ What's Missing:
- Onboarding workflow and tracking
- Termination/exit management
- Formal performance review system
- Employee lifecycle status tracking
- Document expiry and compliance tracking
- Lifecycle analytics and reporting

## 🗄️ Database Changes

- **14 new tables** covering job offers, onboarding, performance, resignation, exit management
- **1 materialized view** for analytics
- Full audit trails and status tracking
- Integration with existing user, payroll, HR, and document tables

## 🎨 User Experience

### New Modules:
1. **Job Offer Management** - Create, approve, send, and track job offers
2. **Onboarding Dashboard** - Checklist-based onboarding with progress tracking
3. **Employee Document Repository** - Centralized document storage with expiry alerts
4. **Performance Review System** - Multi-rater reviews with trend analysis
5. **Resignation & Exit Management** - Resignation workflow, exit clearance, final settlement
6. **Lifecycle Analytics** - Turnover, retention, and exit reason analysis

## 📈 Success Metrics

- Onboarding completion time < 7 days
- Document verification completion > 95%
- Performance review completion rate > 90%
- Exit clearance completion before last working day > 95%
- Turnover rate tracked monthly with exit reason analysis

## 🚀 Implementation Phases

- **Phase 1**: Foundation - Database schema & backend structure (2 weeks)
- **Phase 2**: Job Offers (1 week)
- **Phase 3**: Onboarding (2 weeks)
- **Phase 4**: Documents (1 week)
- **Phase 5**: Performance (2 weeks)
- **Phase 6**: Exit Management (2 weeks)
- **Phase 7**: Analytics (1 week)
- **Phase 8**: Testing & Deployment (1 week)

**Total Timeline**: 12 weeks

## 🔗 Related Issues

Stories and tasks will be linked below as they are created.

## 📚 Documentation

- Implementation plan: `/docs/EMPLOYEE_LIFECYCLE_IMPLEMENTATION_PLAN.md`
- Database schema: Migration scripts in `/sql/migrations/`
- API documentation: Swagger at `/api` after implementation

## 👥 Team

- **Backend**: NestJS, TypeORM, PostgreSQL
- **Frontend**: Angular, TypeScript, Bootstrap
- **DevOps**: Docker, PostgreSQL 17

---

**Epic Type**: Large Feature
**Estimated Effort**: 12 weeks
**Priority**: High
**Module**: Employee Lifecycle Management
EOF
)

EPIC_NUMBER=$(gh issue create \
  --title "🎯 EPIC: Employee Lifecycle Management Module" \
  --body "$EPIC_BODY" \
  --label "epic,enhancement,module:employee-lifecycle,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${GREEN}✓ Epic created: #${EPIC_NUMBER}${NC}"
echo ""

# Store the epic number for reference
EPIC_REF="#${EPIC_NUMBER}"

#################################
# PHASE 1: Foundation
#################################

echo -e "${GREEN}Creating Phase 1 Stories...${NC}"

# Story 1.1: Database Schema
STORY_1_1=$(cat <<EOF
## 📋 User Story

As a **system architect**, I want to **create the database schema for employee lifecycle management** so that **we have a solid foundation for tracking employees from offer to exit**.

## 🎯 Acceptance Criteria

- [ ] All 14 lifecycle tables created with proper constraints
- [ ] Foreign key relationships established with existing tables (app_user, documents, etc.)
- [ ] Indexes created on frequently queried columns
- [ ] Materialized view for analytics created
- [ ] Migration script tested on development database
- [ ] Rollback script created and tested
- [ ] Database schema documentation updated

## 🔗 Database Tables

1. employee_lifecycle_status
2. employee_lifecycle_history
3. job_offer
4. onboarding_checklist_template
5. onboarding_task
6. employee_document
7. performance_review_cycle
8. performance_review
9. resignation
10. exit_clearance_checklist
11. exit_interview
12. final_settlement
13. Materialized view: employee_lifecycle_metrics

## 📝 Technical Notes

- All tables include standard audit columns (created_on, updated_on, created_by, updated_by, active, archive)
- Status enums defined with CHECK constraints
- Indexes on user_id, status, and date columns
- Foreign keys with ON DELETE CASCADE where appropriate

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2 - Database Schema Design

## ✅ Definition of Done

- Migration script runs without errors
- All constraints validated
- Rollback tested successfully
- Code reviewed and approved
- Documentation updated
EOF
)

STORY_1_1_NUM=$(gh issue create \
  --title "📊 Database Schema for Employee Lifecycle" \
  --body "$STORY_1_1" \
  --label "story,module:employee-lifecycle,phase:1,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 1.1 created: #${STORY_1_1_NUM}${NC}"

# Story 1.2: Backend Module Structure
STORY_1_2=$(cat <<EOF
## 📋 User Story

As a **backend developer**, I want to **set up the module structure for employee lifecycle** so that **we have a consistent and maintainable codebase**.

## 🎯 Acceptance Criteria

- [ ] Module directory structure created
- [ ] All TypeORM entities created
- [ ] DTOs for all operations created with validation
- [ ] Enums for status values created
- [ ] Module configuration and imports set up
- [ ] Basic CRUD services scaffolded
- [ ] Controllers scaffolded with Swagger documentation
- [ ] Module registered in app.module.ts

## 📁 Directory Structure

\`\`\`
api-v2/src/modules/app/employee-lifecycle/
├── dto/
├── services/
├── controllers/
├── enums/
└── employee-lifecycle.module.ts
\`\`\`

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_1_1_NUM} (Database Schema)

## ✅ Definition of Done

- Module compiles without errors
- All entities properly decorated
- Swagger documentation generated
- Code follows project conventions
- PR created and reviewed
EOF
)

STORY_1_2_NUM=$(gh issue create \
  --title "🏗️ Backend Module Structure Setup" \
  --body "$STORY_1_2" \
  --label "story,module:employee-lifecycle,phase:1,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 1.2 created: #${STORY_1_2_NUM}${NC}"

# Story 1.3: Frontend Module Structure
STORY_1_3=$(cat <<EOF
## 📋 User Story

As a **frontend developer**, I want to **set up the Angular module structure** so that **we have a foundation for building lifecycle management UI**.

## 🎯 Acceptance Criteria

- [ ] Employee lifecycle module created
- [ ] Routing module configured
- [ ] Service stubs created for all APIs
- [ ] TypeScript models/interfaces created
- [ ] Shared components identified
- [ ] Module registered in secured module
- [ ] Navigation menu updated with lifecycle link

## 📁 Directory Structure

\`\`\`
frontend/src/app/secured/employee-lifecycle/
├── components/
├── services/
├── models/
├── employee-lifecycle.module.ts
└── employee-lifecycle-routing.module.ts
\`\`\`

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 4 - Frontend Implementation

## ✅ Definition of Done

- Module compiles without errors
- Routing works correctly
- Services injectable
- Models match backend DTOs
- Code follows Angular style guide
EOF
)

STORY_1_3_NUM=$(gh issue create \
  --title "🎨 Frontend Module Structure Setup" \
  --body "$STORY_1_3" \
  --label "story,module:employee-lifecycle,phase:1,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 1.3 created: #${STORY_1_3_NUM}${NC}"

#################################
# PHASE 2: Job Offer Management
#################################

echo -e "${GREEN}Creating Phase 2 Stories...${NC}"

STORY_2_1=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **create and manage job offers** so that **I can extend offers to candidates with proper approval workflow**.

## 🎯 Acceptance Criteria

- [ ] Create job offer form with candidate and position details
- [ ] Salary component breakdown configuration
- [ ] Offer letter template selection
- [ ] Submit for approval workflow
- [ ] Approve/reject with notes
- [ ] Send offer to candidate via email
- [ ] Track candidate response (accept/decline)
- [ ] Withdraw offer functionality
- [ ] List view with filters and search
- [ ] Status badges and tracking

## 🎨 UI Components

- Job offer list with filters
- Job offer creation form
- Approval workflow interface
- Offer status tracking

## 🔌 API Endpoints

- POST /employee-lifecycle/job-offers
- GET /employee-lifecycle/job-offers
- GET /employee-lifecycle/job-offers/:id
- PUT /employee-lifecycle/job-offers/:id
- POST /employee-lifecycle/job-offers/:id/approve
- POST /employee-lifecycle/job-offers/:id/send
- POST /employee-lifecycle/job-offers/:id/respond

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_1_1_NUM}, #${STORY_1_2_NUM}, #${STORY_1_3_NUM}

## ✅ Definition of Done

- All API endpoints implemented and tested
- UI components completed
- Offer letter generation working
- Email notifications sent
- Validation working correctly
- Documentation updated
EOF
)

STORY_2_1_NUM=$(gh issue create \
  --title "💼 Job Offer Management" \
  --body "$STORY_2_1" \
  --label "story,module:employee-lifecycle,phase:2,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 2.1 created: #${STORY_2_1_NUM}${NC}"

STORY_2_2=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **create employee accounts from accepted offers** so that **new hires can access the system on their joining date**.

## 🎯 Acceptance Criteria

- [ ] Create user account with details from offer
- [ ] Initialize employee lifecycle status as ONBOARDING
- [ ] Set up initial role and permissions
- [ ] Link user to accepted job offer
- [ ] Send welcome email with credentials
- [ ] Log lifecycle history entry

## 🔌 Integration

- User management service
- Email notification service
- Lifecycle status service

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_2_1_NUM}

## ✅ Definition of Done

- User account created successfully
- Lifecycle status initialized
- Welcome email sent
- Integration tested
EOF
)

STORY_2_2_NUM=$(gh issue create \
  --title "👤 Employee Account Creation from Offer" \
  --body "$STORY_2_2" \
  --label "story,module:employee-lifecycle,phase:2,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 2.2 created: #${STORY_2_2_NUM}${NC}"

#################################
# PHASE 3: Onboarding
#################################

echo -e "${GREEN}Creating Phase 3 Stories...${NC}"

STORY_3_1=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **define onboarding checklists** so that **new employees complete all necessary tasks systematically**.

## 🎯 Acceptance Criteria

- [ ] Create onboarding checklist templates
- [ ] Configure tasks by employment type and role
- [ ] Set task categories (Documentation, IT Setup, Training, Compliance)
- [ ] Define task dependencies and blocking tasks
- [ ] Assign responsible parties (HR, IT, Manager, Employee)
- [ ] Set due dates relative to joining date
- [ ] Mark mandatory vs optional tasks

## 🎨 UI Components

- Checklist template management
- Task configuration form
- Template preview

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2.2 - Onboarding Management

## ✅ Definition of Done

- Templates can be created and edited
- Tasks properly categorized
- System validates task configuration
EOF
)

STORY_3_1_NUM=$(gh issue create \
  --title "✅ Onboarding Checklist Templates" \
  --body "$STORY_3_1" \
  --label "story,module:employee-lifecycle,phase:3,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 3.1 created: #${STORY_3_1_NUM}${NC}"

STORY_3_2=$(cat <<EOF
## 📋 User Story

As a **new employee**, I want to **see my onboarding tasks** so that **I know what needs to be completed before starting work**.

## 🎯 Acceptance Criteria

- [ ] Onboarding dashboard showing progress
- [ ] Task list grouped by category
- [ ] Task status indicators (Pending, In Progress, Completed, Overdue)
- [ ] Mark tasks as complete with notes
- [ ] Upload supporting documents
- [ ] View overall completion percentage
- [ ] See pending tasks assigned to me

## 🎨 UI Components

- Onboarding dashboard
- Task checklist component
- Task detail and completion modal
- Progress bar and metrics

## 🔌 API Endpoints

- GET /employee-lifecycle/onboarding/:userId
- GET /employee-lifecycle/onboarding/:userId/tasks
- POST /employee-lifecycle/onboarding/tasks/:taskId/complete
- POST /employee-lifecycle/onboarding/initialize/:userId

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_3_1_NUM}

## ✅ Definition of Done

- Dashboard displays correctly
- Tasks can be completed
- Progress tracked accurately
- Notifications sent for overdue tasks
EOF
)

STORY_3_2_NUM=$(gh issue create \
  --title "🎯 Employee Onboarding Dashboard" \
  --body "$STORY_3_2" \
  --label "story,module:employee-lifecycle,phase:3,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 3.2 created: #${STORY_3_2_NUM}${NC}"

STORY_3_3=$(cat <<EOF
## 📋 User Story

As a **system**, I want to **integrate onboarding with other modules** so that **employee setup is automated**.

## 🎯 Acceptance Criteria

- [ ] Create salary structure from job offer
- [ ] Initialize leave balances based on employment type
- [ ] Assign default shift
- [ ] Assign system roles and permissions
- [ ] Create employee document repository
- [ ] Send notifications to stakeholders

## 🔌 Integration Points

- Payroll service (salary structure)
- Leave service (balance initialization)
- Shift service (default assignment)
- Role service (permission assignment)
- Document service (repository creation)
- Notification service (emails)

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_3_2_NUM}

## ✅ Definition of Done

- All integrations working
- Data created in related modules
- Notifications sent successfully
- Integration tested end-to-end
EOF
)

STORY_3_3_NUM=$(gh issue create \
  --title "🔗 Onboarding Integration with HR/Payroll" \
  --body "$STORY_3_3" \
  --label "story,module:employee-lifecycle,phase:3,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 3.3 created: #${STORY_3_3_NUM}${NC}"

STORY_3_4=$(cat <<EOF
## 📋 User Story

As a **Manager**, I want to **track probation period** so that **I can evaluate new employees and confirm or terminate employment**.

## 🎯 Acceptance Criteria

- [ ] Automatic probation end date calculation
- [ ] Probation review reminder to manager
- [ ] Probation review form
- [ ] Confirm employment (move to ACTIVE status)
- [ ] Terminate during probation workflow
- [ ] Probation extension capability
- [ ] Track probation completion rate

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_3_2_NUM}

## ✅ Definition of Done

- Probation tracking functional
- Review form implemented
- Status transitions working
- Analytics tracking probation metrics
EOF
)

STORY_3_4_NUM=$(gh issue create \
  --title "📅 Probation Period Management" \
  --body "$STORY_3_4" \
  --label "story,module:employee-lifecycle,phase:3,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 3.4 created: #${STORY_3_4_NUM}${NC}"

#################################
# PHASE 4: Employee Documents
#################################

echo -e "${GREEN}Creating Phase 4 Stories...${NC}"

STORY_4_1=$(cat <<EOF
## 📋 User Story

As an **employee**, I want to **upload my documents** so that **HR can verify my credentials and maintain compliance**.

## 🎯 Acceptance Criteria

- [ ] Upload documents with categorization
- [ ] Support multiple file formats (PDF, JPG, PNG)
- [ ] Add metadata (document number, issue date, expiry date)
- [ ] Mark documents as mandatory or optional
- [ ] View uploaded documents
- [ ] Replace/update existing documents
- [ ] Download documents

## 📝 Document Types

- Offer Letter, Appointment Letter, Contract
- ID Proof (PAN, Aadhaar, Passport, etc.)
- Address Proof
- Education Certificates
- Experience Certificates
- Bank Documents
- PF/ESI Documents

## 🎨 UI Components

- Document upload interface (drag-and-drop)
- Document list with categories
- Document viewer/preview
- Metadata form

## 🔌 API Endpoints

- POST /employee-lifecycle/documents/:userId
- GET /employee-lifecycle/documents/:userId
- PUT /employee-lifecycle/documents/:userId/:documentId
- DELETE /employee-lifecycle/documents/:userId/:documentId

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2.3 - Document Management

## ✅ Definition of Done

- Upload working with validation
- Documents stored securely
- Metadata captured correctly
- Preview/download functional
EOF
)

STORY_4_1_NUM=$(gh issue create \
  --title "📄 Employee Document Upload & Management" \
  --body "$STORY_4_1" \
  --label "story,module:employee-lifecycle,phase:4,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 4.1 created: #${STORY_4_1_NUM}${NC}"

STORY_4_2=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **verify employee documents** so that **we maintain compliance and validate credentials**.

## 🎯 Acceptance Criteria

- [ ] View pending documents for verification
- [ ] Preview document with verification form
- [ ] Approve document with notes
- [ ] Reject document with reason
- [ ] Track verification status
- [ ] View verification history
- [ ] Generate compliance report

## 🎨 UI Components

- Pending verifications dashboard
- Document verification interface
- Verification history view

## 🔌 API Endpoints

- GET /employee-lifecycle/documents/pending-verification
- POST /employee-lifecycle/documents/:userId/:documentId/verify
- POST /employee-lifecycle/documents/:userId/:documentId/reject

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_4_1_NUM}

## ✅ Definition of Done

- Verification workflow complete
- Status tracking accurate
- Notifications sent on verification
- Reports generated correctly
EOF
)

STORY_4_2_NUM=$(gh issue create \
  --title "✓ Document Verification Workflow" \
  --body "$STORY_4_2" \
  --label "story,module:employee-lifecycle,phase:4,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 4.2 created: #${STORY_4_2_NUM}${NC}"

STORY_4_3=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **receive alerts for expiring documents** so that **we maintain compliance and renew documents on time**.

## 🎯 Acceptance Criteria

- [ ] Track document expiry dates
- [ ] Alert dashboard showing documents expiring soon
- [ ] Email alerts 30/15/7 days before expiry
- [ ] Mark expired documents automatically
- [ ] Compliance status report by employee
- [ ] Bulk renewal process

## 🔌 API Endpoints

- GET /employee-lifecycle/documents/expiring-soon
- GET /employee-lifecycle/documents/expired

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_4_1_NUM}

## ✅ Definition of Done

- Expiry tracking working
- Alerts sent on schedule
- Dashboard displays correctly
- Compliance reports accurate
EOF
)

STORY_4_3_NUM=$(gh issue create \
  --title "⏰ Document Expiry Tracking & Alerts" \
  --body "$STORY_4_3" \
  --label "story,module:employee-lifecycle,phase:4,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 4.3 created: #${STORY_4_3_NUM}${NC}"

#################################
# PHASE 5: Performance Management
#################################

echo -e "${GREEN}Creating Phase 5 Stories...${NC}"

STORY_5_1=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **create performance review cycles** so that **we conduct regular performance evaluations**.

## 🎯 Acceptance Criteria

- [ ] Create review cycle with period configuration
- [ ] Define cycle type (Annual, Semi-Annual, Quarterly, Probation)
- [ ] Configure review timeline (start and end dates)
- [ ] Select applicable employees (by role, employment type)
- [ ] Enable self-assessment, manager review, peer review
- [ ] Activate cycle (triggers notifications)
- [ ] Close cycle and archive reviews

## 🎨 UI Components

- Review cycle list
- Cycle creation/edit form
- Cycle activation workflow

## 🔌 API Endpoints

- POST /employee-lifecycle/performance/cycles
- GET /employee-lifecycle/performance/cycles
- POST /employee-lifecycle/performance/cycles/:id/activate
- POST /employee-lifecycle/performance/cycles/:id/close

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2.4 - Performance Management

## ✅ Definition of Done

- Cycle creation working
- Employee selection accurate
- Notifications sent on activation
- Cycle management complete
EOF
)

STORY_5_1_NUM=$(gh issue create \
  --title "🎯 Performance Review Cycle Management" \
  --body "$STORY_5_1" \
  --label "story,module:employee-lifecycle,phase:5,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 5.1 created: #${STORY_5_1_NUM}${NC}"

STORY_5_2=$(cat <<EOF
## 📋 User Story

As an **employee**, I want to **complete my self-assessment** so that **I can provide input on my performance**.

As a **manager**, I want to **review my team members** so that **I can provide constructive feedback**.

## 🎯 Acceptance Criteria

- [ ] Self-assessment form with category ratings
- [ ] Manager review form
- [ ] Peer review form (optional)
- [ ] Overall rating calculation
- [ ] Category-wise ratings (Quality, Productivity, Teamwork, etc.)
- [ ] Text fields for strengths, areas for improvement, goals
- [ ] Save as draft functionality
- [ ] Submit review for approval
- [ ] Recommendation checkboxes (promotion, increment)

## 🎨 UI Components

- Review form (responsive design)
- Rating inputs (star rating or slider)
- Text areas for feedback
- Draft save and submit buttons

## 🔌 API Endpoints

- POST /employee-lifecycle/performance/reviews
- GET /employee-lifecycle/performance/my-reviews
- PUT /employee-lifecycle/performance/reviews/:reviewId
- POST /employee-lifecycle/performance/reviews/:reviewId/submit

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_5_1_NUM}

## ✅ Definition of Done

- Review forms functional
- Ratings captured correctly
- Submit workflow working
- Notifications sent
EOF
)

STORY_5_2_NUM=$(gh issue create \
  --title "📝 Performance Review Submission" \
  --body "$STORY_5_2" \
  --label "story,module:employee-lifecycle,phase:5,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 5.2 created: #${STORY_5_2_NUM}${NC}"

STORY_5_3=$(cat <<EOF
## 📋 User Story

As an **employee**, I want to **view my performance summary and trends** so that **I can track my growth over time**.

## 🎯 Acceptance Criteria

- [ ] Performance summary dashboard
- [ ] Overall rating display
- [ ] Category-wise breakdown (spider/radar chart)
- [ ] Historical trend (line chart)
- [ ] Feedback summary from all reviewers
- [ ] Goals tracking
- [ ] Acknowledgement functionality
- [ ] Download performance report (PDF)

## 🎨 UI Components

- Performance dashboard
- Charts (spider chart, line chart)
- Review history timeline
- PDF export

## 🔌 API Endpoints

- GET /employee-lifecycle/performance/summary/:userId
- GET /employee-lifecycle/performance/reviews/:userId
- POST /employee-lifecycle/performance/reviews/:reviewId/acknowledge

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_5_2_NUM}

## ✅ Definition of Done

- Dashboard displays correctly
- Charts render accurately
- Trend analysis working
- PDF export functional
EOF
)

STORY_5_3_NUM=$(gh issue create \
  --title "📊 Performance Summary & Trends" \
  --body "$STORY_5_3" \
  --label "story,module:employee-lifecycle,phase:5,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 5.3 created: #${STORY_5_3_NUM}${NC}"

#################################
# PHASE 6: Exit Management
#################################

echo -e "${GREEN}Creating Phase 6 Stories...${NC}"

STORY_6_1=$(cat <<EOF
## 📋 User Story

As an **employee**, I want to **submit my resignation** so that **I can formally notify the company of my intention to leave**.

## 🎯 Acceptance Criteria

- [ ] Resignation form with reason and proposed last working date
- [ ] Automatic notice period calculation
- [ ] Submit resignation
- [ ] View resignation status
- [ ] Withdraw resignation (if not yet approved)
- [ ] Respond to counter-offer

## 🎨 UI Components

- Resignation submission form
- Status tracking
- Counter-offer response interface

## 🔌 API Endpoints

- POST /employee-lifecycle/resignation
- GET /employee-lifecycle/resignation/:userId
- POST /employee-lifecycle/resignation/:id/withdraw
- POST /employee-lifecycle/resignation/:id/respond-to-counter

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2.5 - Termination & Exit Management

## ✅ Definition of Done

- Resignation submission working
- Notice period calculated correctly
- Status tracking accurate
- Notifications sent
EOF
)

STORY_6_1_NUM=$(gh issue create \
  --title "📋 Employee Resignation Submission" \
  --body "$STORY_6_1" \
  --label "story,module:employee-lifecycle,phase:6,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 6.1 created: #${STORY_6_1_NUM}${NC}"

STORY_6_2=$(cat <<EOF
## 📋 User Story

As a **Manager/HR**, I want to **process resignations** so that **I can approve exits and manage counter-offers**.

## 🎯 Acceptance Criteria

- [ ] View pending resignations
- [ ] Review resignation details
- [ ] Approve with adjusted last working date
- [ ] Reject resignation (rare case)
- [ ] Make counter-offer with details
- [ ] Track counter-offer response
- [ ] Update lifecycle status to NOTICE_PERIOD

## 🎨 UI Components

- Pending resignations dashboard
- Resignation approval interface
- Counter-offer form

## 🔌 API Endpoints

- GET /employee-lifecycle/resignation/pending
- POST /employee-lifecycle/resignation/:id/review
- POST /employee-lifecycle/resignation/:id/approve
- POST /employee-lifecycle/resignation/:id/counter-offer

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_6_1_NUM}

## ✅ Definition of Done

- Approval workflow functional
- Counter-offer process working
- Status updates accurate
- Notifications sent to all parties
EOF
)

STORY_6_2_NUM=$(gh issue create \
  --title "✅ Resignation Approval & Counter-Offers" \
  --body "$STORY_6_2" \
  --label "story,module:employee-lifecycle,phase:6,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 6.2 created: #${STORY_6_2_NUM}${NC}"

STORY_6_3=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **track exit clearance** so that **all tasks are completed before the employee leaves**.

## 🎯 Acceptance Criteria

- [ ] Automatic exit checklist creation on resignation approval
- [ ] Task categories: Asset Return, Knowledge Transfer, IT Access, Financial Settlement
- [ ] Assign tasks to responsible departments
- [ ] Track task completion status
- [ ] Identify blocking tasks
- [ ] Clearance dashboard for HR
- [ ] Final clearance approval

## 🎨 UI Components

- Exit clearance dashboard
- Task list with filters
- Task completion interface
- Clearance status report

## 🔌 API Endpoints

- POST /employee-lifecycle/exit/initialize/:userId
- GET /employee-lifecycle/exit/clearance/:userId
- POST /employee-lifecycle/exit/clearance/:taskId/complete

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_6_2_NUM}

## ✅ Definition of Done

- Checklist auto-created
- Task assignment working
- Completion tracking accurate
- Blocking validation functional
EOF
)

STORY_6_3_NUM=$(gh issue create \
  --title "✓ Exit Clearance Checklist" \
  --body "$STORY_6_3" \
  --label "story,module:employee-lifecycle,phase:6,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 6.3 created: #${STORY_6_3_NUM}${NC}"

STORY_6_4=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **conduct exit interviews** so that **we can gather feedback and improve retention**.

## 🎯 Acceptance Criteria

- [ ] Exit interview form with structured questions
- [ ] Rating scales for satisfaction, culture, management, compensation
- [ ] Open-ended feedback fields
- [ ] Rehire eligibility assessment
- [ ] Would-recommend-company checkbox
- [ ] Submit and store responses
- [ ] Exit interview analytics

## 🎨 UI Components

- Exit interview form
- Analytics dashboard (exit reasons, satisfaction scores)

## 🔌 API Endpoints

- POST /employee-lifecycle/exit/interview/:userId
- GET /employee-lifecycle/exit/interview/:userId

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_6_3_NUM}

## ✅ Definition of Done

- Form captures all data
- Responses stored securely
- Analytics working
- Privacy maintained
EOF
)

STORY_6_4_NUM=$(gh issue create \
  --title "💬 Exit Interview Process" \
  --body "$STORY_6_4" \
  --label "story,module:employee-lifecycle,phase:6,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 6.4 created: #${STORY_6_4_NUM}${NC}"

STORY_6_5=$(cat <<EOF
## 📋 User Story

As a **Finance Manager**, I want to **calculate and process final settlement** so that **exiting employees receive their dues**.

## 🎯 Acceptance Criteria

- [ ] Automatic calculation of final settlement
- [ ] Earning components: prorated salary, leave encashment, bonus, gratuity
- [ ] Deduction components: notice recovery, loans, advances
- [ ] Net settlement amount calculation
- [ ] Itemized breakdown display
- [ ] Approval workflow
- [ ] Payment processing
- [ ] Download settlement letter

## 💰 Calculation Components

**Earnings:**
- Prorated salary for last month
- Leave encashment (unused leave balance × per-day salary)
- Pending bonus/incentives
- Gratuity (if eligible: 4.81% × last drawn salary × years of service)

**Deductions:**
- Notice period recovery (if shortfall)
- Loan/advance recovery
- Other deductions

## 🎨 UI Components

- Settlement calculation display (read-only)
- Approval interface
- Payment processing form
- PDF generation

## 🔌 API Endpoints

- POST /employee-lifecycle/exit/final-settlement/:userId/calculate
- GET /employee-lifecycle/exit/final-settlement/:userId
- POST /employee-lifecycle/exit/final-settlement/:userId/approve
- POST /employee-lifecycle/exit/final-settlement/:userId/process-payment

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_6_3_NUM}
- Integration: Payroll service for salary data, Leave service for balance

## ✅ Definition of Done

- Calculation accurate
- All components included
- Approval workflow functional
- Payment tracking working
- PDF generation functional
EOF
)

STORY_6_5_NUM=$(gh issue create \
  --title "💰 Final Settlement Calculation" \
  --body "$STORY_6_5" \
  --label "story,module:employee-lifecycle,phase:6,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 6.5 created: #${STORY_6_5_NUM}${NC}"

#################################
# PHASE 7: Analytics & Reporting
#################################

echo -e "${GREEN}Creating Phase 7 Stories...${NC}"

STORY_7_1=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **view lifecycle analytics dashboard** so that **I can track key workforce metrics**.

## 🎯 Acceptance Criteria

- [ ] Dashboard with KPI cards
- [ ] Total active employees count
- [ ] Employees in probation count
- [ ] Employees in notice period count
- [ ] New hires this month
- [ ] Exits this month
- [ ] Current turnover rate
- [ ] Charts: headcount trend, turnover by department, exit reasons

## 📊 Charts

- Headcount trend (line chart, last 12 months)
- Turnover by department (bar chart)
- Exit reasons distribution (pie chart)
- Time-to-hire trend (line chart)
- Onboarding completion rate (gauge chart)

## 🔌 API Endpoints

- GET /employee-lifecycle/analytics/dashboard
- GET /employee-lifecycle/analytics/turnover
- GET /employee-lifecycle/analytics/retention

## 🔗 Related

- Epic: ${EPIC_REF}
- Implementation plan: Section 2.6 - Analytics & Reporting

## ✅ Definition of Done

- Dashboard displays correctly
- All metrics calculated accurately
- Charts render properly
- Data refreshes automatically
EOF
)

STORY_7_1_NUM=$(gh issue create \
  --title "📊 Lifecycle Analytics Dashboard" \
  --body "$STORY_7_1" \
  --label "story,module:employee-lifecycle,phase:7,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 7.1 created: #${STORY_7_1_NUM}${NC}"

STORY_7_2=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **analyze turnover and retention** so that **I can identify trends and improve retention strategies**.

## 🎯 Acceptance Criteria

- [ ] Turnover analysis page
- [ ] Monthly turnover rate calculation
- [ ] Voluntary vs involuntary turnover breakdown
- [ ] Turnover by employment type and role
- [ ] Tenure analysis (average tenure by role)
- [ ] Retention rate by cohort (joining year)
- [ ] First-year retention rate
- [ ] Probation completion rate
- [ ] Export reports to Excel/PDF

## 📊 Metrics

- Overall turnover rate %
- Voluntary turnover %
- Involuntary turnover %
- Average tenure (years)
- Retention rate by cohort
- Turnover by tenure bracket

## 🔌 API Endpoints

- GET /employee-lifecycle/analytics/turnover
- GET /employee-lifecycle/analytics/retention
- GET /employee-lifecycle/analytics/exit-reasons

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_7_1_NUM}

## ✅ Definition of Done

- All metrics calculated correctly
- Charts display trends
- Filters working
- Export functional
EOF
)

STORY_7_2_NUM=$(gh issue create \
  --title "📉 Turnover & Retention Analysis" \
  --body "$STORY_7_2" \
  --label "story,module:employee-lifecycle,phase:7,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 7.2 created: #${STORY_7_2_NUM}${NC}"

STORY_7_3=$(cat <<EOF
## 📋 User Story

As an **HR Manager**, I want to **generate lifecycle reports** so that **I can share insights with management**.

## 🎯 Acceptance Criteria

- [ ] Monthly summary report
- [ ] Employee profile report
- [ ] Exit reason analysis report
- [ ] Onboarding effectiveness report
- [ ] Performance review completion report
- [ ] Compliance status report
- [ ] Schedule automated reports
- [ ] Email delivery of reports

## 📄 Reports

- **Monthly Summary**: New hires, exits, turnover rate, headcount
- **Employee Profile**: Complete lifecycle history, performance, documents
- **Exit Analysis**: Exit reasons, satisfaction scores, rehire eligibility
- **Onboarding**: Completion rates, time-to-productivity
- **Compliance**: Document status, expiring documents, pending verifications

## 🔌 API Endpoints

- GET /employee-lifecycle/reports/monthly-summary
- GET /employee-lifecycle/reports/employee-profile/:userId
- GET /employee-lifecycle/reports/exit-analysis
- GET /employee-lifecycle/reports/onboarding-effectiveness

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_7_1_NUM}

## ✅ Definition of Done

- All reports generated correctly
- PDF/Excel export working
- Scheduled reports functional
- Email delivery working
EOF
)

STORY_7_3_NUM=$(gh issue create \
  --title "📄 Lifecycle Reporting" \
  --body "$STORY_7_3" \
  --label "story,module:employee-lifecycle,phase:7,priority:medium" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 7.3 created: #${STORY_7_3_NUM}${NC}"

#################################
# PHASE 8: Testing & Documentation
#################################

echo -e "${GREEN}Creating Phase 8 Stories...${NC}"

STORY_8_1=$(cat <<EOF
## 📋 User Story

As a **developer**, I want to **write comprehensive tests** so that **the module is reliable and maintainable**.

## 🎯 Acceptance Criteria

- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical workflows
- [ ] Performance tests for analytics
- [ ] Test data fixtures created
- [ ] CI/CD pipeline includes tests
- [ ] All tests passing

## 🧪 Test Coverage

**Unit Tests:**
- JobOfferService
- OnboardingService
- FinalSettlementService
- LifecycleAnalyticsService

**Integration Tests:**
- All API endpoints
- Error handling
- Permission checks
- Workflow transitions

**E2E Tests:**
- Offer to onboarding flow
- Resignation to exit flow
- Performance review cycle

## 🔗 Related

- Epic: ${EPIC_REF}

## ✅ Definition of Done

- Test coverage > 80%
- All critical paths tested
- CI/CD passing
- Test documentation updated
EOF
)

STORY_8_1_NUM=$(gh issue create \
  --title "🧪 Comprehensive Testing" \
  --body "$STORY_8_1" \
  --label "story,module:employee-lifecycle,phase:8,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 8.1 created: #${STORY_8_1_NUM}${NC}"

STORY_8_2=$(cat <<EOF
## 📋 User Story

As a **user**, I want to **have comprehensive documentation** so that **I can use the system effectively**.

## 🎯 Acceptance Criteria

- [ ] User guide with screenshots
- [ ] Admin guide for configuration
- [ ] API documentation (Swagger)
- [ ] Video tutorials recorded
- [ ] FAQ document created
- [ ] Troubleshooting guide
- [ ] Training materials prepared

## 📚 Documentation

- **User Guide**: How to use each feature (HR, Manager, Employee perspectives)
- **Admin Guide**: Configuration, templates, roles, permissions
- **API Documentation**: Swagger/OpenAPI complete
- **Video Tutorials**: Key workflows demonstrated
- **FAQ**: Common questions answered
- **Troubleshooting**: Common issues and solutions

## 🔗 Related

- Epic: ${EPIC_REF}

## ✅ Definition of Done

- All documentation completed
- Screenshots current
- Videos recorded and uploaded
- Documentation reviewed and approved
EOF
)

STORY_8_2_NUM=$(gh issue create \
  --title "📚 Documentation & Training Materials" \
  --body "$STORY_8_2" \
  --label "story,module:employee-lifecycle,phase:8,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 8.2 created: #${STORY_8_2_NUM}${NC}"

STORY_8_3=$(cat <<EOF
## 📋 User Story

As a **project manager**, I want to **deploy the module to production** so that **users can start using it**.

## 🎯 Acceptance Criteria

- [ ] Database migration tested on staging
- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Monitoring and logging configured
- [ ] Performance baselines established
- [ ] Rollback plan documented
- [ ] User training conducted
- [ ] Go-live announcement sent

## 🚀 Deployment Checklist

- [ ] Run database migration
- [ ] Deploy API container
- [ ] Deploy frontend container
- [ ] Update environment variables
- [ ] Verify all services running
- [ ] Run smoke tests
- [ ] Monitor for errors
- [ ] Enable feature flags (if applicable)

## 🔗 Related

- Epic: ${EPIC_REF}
- Depends on: #${STORY_8_1_NUM}, #${STORY_8_2_NUM}

## ✅ Definition of Done

- Production deployment successful
- No critical errors
- Users trained
- Support ready
EOF
)

STORY_8_3_NUM=$(gh issue create \
  --title "🚀 Production Deployment" \
  --body "$STORY_8_3" \
  --label "story,module:employee-lifecycle,phase:8,priority:high" \
  | grep -oP '#\K\d+')

echo -e "${BLUE}  Story 8.3 created: #${STORY_8_3_NUM}${NC}"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}All issues created successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "  Epic: #${EPIC_NUMBER}"
echo -e "  Stories: 24 issues created"
echo -e "  Phases: 8 phases"
echo ""
echo -e "${BLUE}🔗 View Epic:${NC}"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/issues/${EPIC_NUMBER}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review all created issues"
echo "  2. Add milestones for each phase"
echo "  3. Assign issues to team members"
echo "  4. Create project board to track progress"
echo "  5. Start with Phase 1 stories"
echo ""
echo -e "${GREEN}✨ Done!${NC}"
