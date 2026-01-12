#!/bin/bash

# GitHub Issues Creation Script
# Prerequisites: Install GitHub CLI (gh) and authenticate
# Usage: ./create-github-issues.sh

REPO="your-username/rgp-bo"  # UPDATE THIS

echo "🚀 Creating GitHub labels, milestones, and issues for RGP Back Office"
echo "Repository: $REPO"
echo ""

# ============================================================================
# STEP 1: CREATE LABELS
# ============================================================================

echo "📋 Step 1: Creating Labels..."

# Priority Labels
gh label create "priority: critical" --color d73a4a --description "Must be fixed immediately" --repo $REPO || true
gh label create "priority: high" --color ff9800 --description "Should be addressed soon" --repo $REPO || true
gh label create "priority: medium" --color fbca04 --description "Normal priority" --repo $REPO || true
gh label create "priority: low" --color 0e8a16 --description "Nice to have" --repo $REPO || true

# Type Labels
gh label create "type: feature" --color 0052cc --description "New feature or capability" --repo $REPO || true
gh label create "type: enhancement" --color 84b6eb --description "Improvement to existing feature" --repo $REPO || true
gh label create "type: bug" --color d73a4a --description "Something isn't working" --repo $REPO || true
gh label create "type: docs" --color d4c5f9 --description "Documentation only" --repo $REPO || true
gh label create "type: refactor" --color 5319e7 --description "Code refactoring" --repo $REPO || true
gh label create "type: security" --color b60205 --description "Security-related" --repo $REPO || true
gh label create "type: performance" --color ff6b6b --description "Performance optimization" --repo $REPO || true
gh label create "type: tech-debt" --color 8b4513 --description "Technical debt cleanup" --repo $REPO || true
gh label create "type: research" --color c2e0c6 --description "Research and investigation" --repo $REPO || true

# Status Labels
gh label create "status: planning" --color c5def5 --description "In planning phase" --repo $REPO || true
gh label create "status: ready" --color 0e8a16 --description "Ready to start" --repo $REPO || true
gh label create "status: in-progress" --color fbca04 --description "Currently being worked on" --repo $REPO || true
gh label create "status: blocked" --color d73a4a --description "Blocked by dependencies" --repo $REPO || true
gh label create "status: review" --color 6f42c1 --description "In code review" --repo $REPO || true
gh label create "status: testing" --color ff9800 --description "In testing phase" --repo $REPO || true
gh label create "status: done" --color 006b75 --description "Completed" --repo $REPO || true

# Module Labels
gh label create "module: core" --color 001f3f --description "Core system" --repo $REPO || true
gh label create "module: sales" --color 0074d9 --description "Sales module" --repo $REPO || true
gh label create "module: purchases" --color 39cccc --description "Purchases module" --repo $REPO || true
gh label create "module: inventory" --color 2ecc40 --description "Inventory module" --repo $REPO || true
gh label create "module: customers" --color 7fdbff --description "Customer management" --repo $REPO || true
gh label create "module: vendors" --color 001f3f --description "Vendor management" --repo $REPO || true
gh label create "module: reports" --color b10dc9 --description "Reporting module" --repo $REPO || true
gh label create "module: hr" --color f012be --description "HR module" --repo $REPO || true
gh label create "module: gst" --color ff851b --description "GST compliance" --repo $REPO || true
gh label create "module: api" --color ffdc00 --description "API/Backend" --repo $REPO || true
gh label create "module: frontend" --color 01ff70 --description "Frontend/UI" --repo $REPO || true
gh label create "module: database" --color 85144b --description "Database" --repo $REPO || true
gh label create "module: ai" --color f012be --description "AI features" --repo $REPO || true

# Size Labels
gh label create "size: xs" --color f1f8ff --description "< 2 hours" --repo $REPO || true
gh label create "size: s" --color e1ecf4 --description "2-4 hours" --repo $REPO || true
gh label create "size: m" --color c5def5 --description "1-2 days" --repo $REPO || true
gh label create "size: l" --color 6a737d --description "3-5 days" --repo $REPO || true
gh label create "size: xl" --color 24292e --description "1-2 weeks" --repo $REPO || true

# Component Labels
gh label create "component: backend" --color 0366d6 --description "Backend code" --repo $REPO || true
gh label create "component: frontend" --color 1b998b --description "Frontend code" --repo $REPO || true
gh label create "component: database" --color 8b4513 --description "Database changes" --repo $REPO || true
gh label create "component: devops" --color 586069 --description "DevOps/Infrastructure" --repo $REPO || true
gh label create "component: testing" --color 6f42c1 --description "Testing" --repo $REPO || true

# Special Labels
gh label create "good-first-issue" --color 7057ff --description "Good for newcomers" --repo $REPO || true
gh label create "help-wanted" --color 008672 --description "Extra attention needed" --repo $REPO || true
gh label create "breaking-change" --color d93f0b --description "Breaking API change" --repo $REPO || true
gh label create "needs-discussion" --color fef2c0 --description "Needs team discussion" --repo $REPO || true

echo "✅ Labels created successfully"
echo ""

# ============================================================================
# STEP 2: CREATE MILESTONES
# ============================================================================

echo "🎯 Step 2: Creating Milestones..."

# Calculate due dates (adjust as needed)
MILESTONE1_DATE=$(date -d "+2 months" +%Y-%m-%d)
MILESTONE2_DATE=$(date -d "+3 months" +%Y-%m-%d)
MILESTONE3_DATE=$(date -d "+4 months" +%Y-%m-%d)
MILESTONE4_DATE=$(date -d "+5 months" +%Y-%m-%d)
MILESTONE5_DATE=$(date -d "+6 months" +%Y-%m-%d)
MILESTONE6_DATE=$(date -d "+8 months" +%Y-%m-%d)

gh api repos/$REPO/milestones -f title="Core Stability & Security" -f due_on="${MILESTONE1_DATE}T00:00:00Z" -f description="Complete security hardening, error handling, and stability improvements" || true
gh api repos/$REPO/milestones -f title="Enhanced Invoice Lifecycle" -f due_on="${MILESTONE2_DATE}T00:00:00Z" -f description="Complete the enhanced invoice lifecycle frontend implementation" || true
gh api repos/$REPO/milestones -f title="GST Compliance Complete" -f due_on="${MILESTONE3_DATE}T00:00:00Z" -f description="Full GST reporting and compliance system" || true
gh api repos/$REPO/milestones -f title="HR Management System" -f due_on="${MILESTONE4_DATE}T00:00:00Z" -f description="Complete HR module with attendance, leave, and performance" || true
gh api repos/$REPO/milestones -f title="AI & Automation" -f due_on="${MILESTONE5_DATE}T00:00:00Z" -f description="AI-powered features and workflow automation" || true
gh api repos/$REPO/milestones -f title="Multi-Tenant Architecture" -f due_on="${MILESTONE6_DATE}T00:00:00Z" -f description="Support for multiple businesses and stores" || true

echo "✅ Milestones created successfully"
echo ""

# ============================================================================
# STEP 3: CREATE EPIC ISSUES
# ============================================================================

echo "🌟 Step 3: Creating Epic Issues..."

# Epic #1: Security & Stability Hardening
gh issue create --repo $REPO \
  --title "[EPIC] Security & Stability Hardening" \
  --label "type: feature,priority: critical,module: core,size: xl" \
  --milestone "Core Stability & Security" \
  --body "$(cat <<'EOF'
## Description
Comprehensive security and stability improvements across the entire application.

## Goals
- ✅ Phase 1: SQL Injection Prevention (COMPLETED)
- ✅ Phase 2: Race Condition Handling (COMPLETED)
- ✅ Phase 3: Transaction Atomicity (COMPLETED)
- ✅ Phase 4: Error Handling Infrastructure (COMPLETED)
- 🔄 Phase 5: Apply error handling to all services
- ⏳ Phase 6: Security audit and penetration testing
- ⏳ Phase 7: Performance optimization and monitoring

## Acceptance Criteria
- [ ] All 16 services implement standard error handling pattern
- [ ] Zero SQL injection vulnerabilities
- [ ] No race conditions in critical workflows
- [ ] All multi-step operations use transactions
- [ ] Comprehensive error logging with sensitive data redaction
- [ ] Security audit passed
- [ ] Performance benchmarks met

## Estimated Effort
8-10 weeks
EOF
)"

# Epic #2: Enhanced Purchase Invoice Lifecycle
gh issue create --repo $REPO \
  --title "[EPIC] Enhanced Purchase Invoice Lifecycle Management" \
  --label "type: feature,priority: high,module: purchases,size: xl" \
  --milestone "Enhanced Invoice Lifecycle" \
  --body "$(cat <<'EOF'
## Description
Complete lifecycle management for purchase invoices from creation to closure, including OCR, payment tracking, and tax reconciliation.

## Current Status
- ✅ Database Schema (100%)
- ✅ Backend API (100%)
- ✅ Testing Scripts (90%)
- ❌ Frontend UI (0%)

## Goals
- ✅ Enhanced database schema with lifecycle fields
- ✅ 21 new REST API endpoints
- 🔄 Frontend UI for all lifecycle features
- ⏳ OCR integration for invoice document upload
- ⏳ Payment reconciliation interface
- ⏳ Tax credit management UI
- ⏳ Effectiveness dashboard

## Acceptance Criteria
- [ ] Users can upload invoice documents with OCR extraction
- [ ] Item types (Regular/Return/Supplied) fully functional
- [ ] Payment tracking shows real-time status
- [ ] Tax credit reconciliation with GSTR-2A
- [ ] Invoice closure workflow implemented
- [ ] Purchase effectiveness metrics displayed
- [ ] End-to-end testing completed

## Estimated Effort
12-14 weeks
EOF
)"

# Epic #3: GST Compliance & Reporting
gh issue create --repo $REPO \
  --title "[EPIC] GST Compliance & Tax Reporting System" \
  --label "type: feature,priority: critical,module: gst,size: xl" \
  --milestone "GST Compliance Complete" \
  --body "$(cat <<'EOF'
## Description
Complete GST compliance system with all statutory reports, ITC management, and filing capabilities.

## Current Status
- ✅ Backend GST Report API (100%)
- ✅ Database ITC tracking fields (100%)
- 🔄 Frontend GST Reports (Partial)
- ❌ GSTR-2A/2B Reconciliation UI (0%)

## Goals
- ✅ GSTR-1 report generation (B2B, B2C, HSN)
- ✅ GSTR-3B monthly return calculation
- ✅ ITC tracking and eligibility management
- 🔄 GSTR-2A/2B verification interface
- ⏳ Tax payment integration
- ⏳ Return filing workflow
- ⏳ Reconciliation dashboard

## Acceptance Criteria
- [ ] All GSTR-1 reports generate correctly
- [ ] GSTR-3B auto-calculated and exportable
- [ ] ITC claims tracked with 180-day rule
- [ ] GSTR-2A mismatches identified and flagged
- [ ] Payment risk dashboard functional
- [ ] Monthly closing workflow implemented
- [ ] Audit trail for all tax operations

## Estimated Effort
10-12 weeks
EOF
)"

# Epic #4: HR Management System
gh issue create --repo $REPO \
  --title "[EPIC] HR Management & Performance Tracking" \
  --label "type: feature,priority: high,module: hr,size: xl" \
  --milestone "HR Management System" \
  --body "$(cat <<'EOF'
## Description
Comprehensive HR management system with shift scheduling, attendance tracking, leave management, and performance scoring.

## Current Status
- ✅ Database Schema (100%)
- ✅ Backend API (100%)
- ✅ Frontend Components (80%)
- ❌ Performance Dashboard (0%)
- ❌ Advanced Analytics (0%)

## Goals
- ✅ Shift management and scheduling
- ✅ Attendance tracking with photo capture
- ✅ Leave request and approval workflow
- ✅ Leave balance management
- 🔄 Performance scoring system
- ⏳ HR analytics dashboard
- ⏳ Payroll integration hooks

## Acceptance Criteria
- [ ] Shift schedules created and assigned
- [ ] Employees can clock in/out with photo
- [ ] Leave requests approved/rejected by managers
- [ ] Leave balances auto-calculated
- [ ] Performance scores tracked monthly
- [ ] Leaderboards display top performers
- [ ] HR audit trail complete
- [ ] Reports exported to Excel/PDF

## Estimated Effort
14-16 weeks
EOF
)"

# Epic #5: AI-Powered Sales Intelligence
gh issue create --repo $REPO \
  --title "[EPIC] AI-Powered Sales Intelligence & Automation" \
  --label "type: feature,priority: medium,module: ai,module: sales,size: l" \
  --milestone "AI & Automation" \
  --body "$(cat <<'EOF'
## Description
AI-powered features for sales assistance, product recommendations, and intelligent automation.

## Current Status
- ✅ Sales Intent API with multi-product support (100%)
- ✅ Anthropic Claude integration (100%)
- ✅ Error handling and retry logic (100%)
- ⏳ Frontend chat interface (0%)
- ⏳ Advanced recommendations (0%)

## Goals
- ✅ Natural language product search
- ✅ Multi-product intent parsing
- 🔄 Conversational sales assistant UI
- ⏳ Smart product recommendations
- ⏳ Inventory optimization suggestions
- ⏳ Price optimization AI
- ⏳ Customer behavior predictions

## Acceptance Criteria
- [ ] Users can search products using natural language
- [ ] AI suggests related/complementary products
- [ ] Chat interface integrated in POS
- [ ] Recommendations improve sales conversion
- [ ] AI learns from historical sales patterns
- [ ] Price suggestions based on demand/competition
- [ ] Customer purchase predictions available

## Estimated Effort
10-12 weeks
EOF
)"

# Epic #6: Multi-Tenant Architecture
gh issue create --repo $REPO \
  --title "[EPIC] Multi-Tenant Store & Business Architecture" \
  --label "type: feature,priority: medium,module: core,size: xl" \
  --milestone "Multi-Tenant Architecture" \
  --body "$(cat <<'EOF'
## Description
Enable the system to support multiple businesses, each with multiple stores, with complete data isolation and role-based access.

## Current Status
- 🔄 Basic multi-store support exists
- ❌ Full tenant isolation (0%)
- ❌ Tenant management UI (0%)

## Goals
- ⏳ Tenant registration and onboarding
- ⏳ Complete data isolation by tenant
- ⏳ Cross-store inventory transfer
- ⏳ Centralized reporting across stores
- ⏳ Store-specific configurations
- ⏳ Tenant billing and subscription management

## Acceptance Criteria
- [ ] Multiple businesses can use the system
- [ ] Complete data isolation between tenants
- [ ] Store managers access only their store data
- [ ] Business owners see all stores in their business
- [ ] Cross-store inventory transfers tracked
- [ ] Consolidated reports available
- [ ] Subscription billing automated

## Estimated Effort
16-20 weeks
EOF
)"

echo "✅ Epic issues created successfully"
echo ""

# ============================================================================
# STEP 4: CREATE HIGH-PRIORITY FEATURE ISSUES
# ============================================================================

echo "📝 Step 4: Creating High-Priority Feature Issues..."

# Feature: Apply Phase 4 Error Handling
gh issue create --repo $REPO \
  --title "Apply Phase 4 Error Handling Pattern to All Services" \
  --label "type: enhancement,priority: high,module: core,component: backend,size: l" \
  --milestone "Core Stability & Security" \
  --body "$(cat <<'EOF'
## Description
Apply the comprehensive error handling pattern established in Phase 4 to all 16 backend services (~124 methods total).

## Context
- ✅ Infrastructure complete: `http-exception.filter.ts`
- ✅ Custom exception classes created
- ❌ Pattern not yet applied to all services

## Services to Update (Priority Order)
1. sale.service.ts (HIGH - customer facing)
2. purchase-invoice.service.ts (HIGH - financial)
3. customer.service.ts (MEDIUM)
4. product.service.ts (MEDIUM)
5. stock.service.ts (MEDIUM)
6. vendor.service.ts (MEDIUM)
7. user.service.ts (MEDIUM)
8. role.service.ts (LOW)
9-16. Remaining services

## Acceptance Criteria
- [ ] All services use try-catch blocks consistently
- [ ] Business exceptions thrown using custom classes
- [ ] HttpExceptions re-thrown without modification
- [ ] Generic errors logged and converted to HTTP 500
- [ ] Sensitive data redacted in all error messages
- [ ] All error scenarios tested
- [ ] Documentation updated

## Estimated Effort
3-4 weeks (2-3 services per week)

## References
- Implementation guide: `docs/guides/PHASE4_ERROR_HANDLING_GUIDE.md`
EOF
)"

# Feature: Invoice Document Upload with OCR
gh issue create --repo $REPO \
  --title "Invoice Document Upload with OCR Integration" \
  --label "type: feature,priority: high,module: purchases,component: backend,component: frontend,size: l" \
  --milestone "Enhanced Invoice Lifecycle" \
  --body "$(cat <<'EOF'
## Description
Enable users to upload invoice PDF/image documents and automatically extract data using OCR.

## Current Status
- ✅ Backend API endpoints created
- ✅ Entity definitions complete
- ❌ OCR integration (0%)
- ❌ Frontend upload UI (0%)

## Goals
- Automatic extraction of invoice number, date, vendor, amounts
- Support for PDF and image formats (JPG, PNG)
- Manual correction interface for OCR errors
- Document attachment to purchase invoice records

## Acceptance Criteria
- [ ] Users can drag-and-drop invoice documents
- [ ] OCR extracts invoice metadata with >85% accuracy
- [ ] Extracted data pre-fills invoice form
- [ ] Users can manually correct OCR errors
- [ ] Documents stored securely with encryption
- [ ] Multiple documents per invoice supported
- [ ] Document preview available
- [ ] Audit trail for document uploads

## Estimated Effort
4-5 weeks

## References
- Documentation: `docs/INVOICE_DOCUMENT_UPLOAD_OCR.md`
EOF
)"

# Feature: GSTR-1 Report Generation Frontend
gh issue create --repo $REPO \
  --title "GSTR-1 Report Generation Frontend Interface" \
  --label "type: feature,priority: critical,module: gst,module: reports,component: frontend,size: m" \
  --milestone "GST Compliance Complete" \
  --body "$(cat <<'EOF'
## Description
Build user interface for generating GSTR-1 reports (B2B, B2C Large, B2C Small, HSN Summary).

## Current Status
- ✅ Backend API complete
- ✅ Report calculation logic complete
- ❌ Frontend UI (0%)

## Acceptance Criteria
- [ ] Users select month/quarter for GSTR-1
- [ ] B2B sales report (Table 4) displays correctly
- [ ] B2C Large sales report (Table 5) shows >2.5L invoices
- [ ] B2C Small sales report (Table 7) consolidated by state
- [ ] HSN Summary (Table 12) shows product-wise breakdown
- [ ] Reports exportable to Excel with proper formatting
- [ ] JSON export compatible with GST portal
- [ ] Report validation checks implemented
- [ ] Error summary displayed if data incomplete

## Estimated Effort
3-4 weeks

## API Endpoints
- GET `/reports/gst/gstr1/b2b?month=2025-01`
- GET `/reports/gst/gstr1/b2c-large?month=2025-01`
- GET `/reports/gst/gstr1/b2c-small?month=2025-01`
- GET `/reports/gst/gstr1/hsn-summary?month=2025-01`
EOF
)"

echo "✅ High-priority feature issues created successfully"
echo ""

echo "🎉 GitHub Issues Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Visit https://github.com/$REPO/issues to see all created issues"
echo "2. Create a new Project Board: https://github.com/$REPO/projects"
echo "3. Add issues to the project board"
echo "4. Start sprint planning!"
echo ""
echo "📊 Created:"
echo "   - 40+ labels"
echo "   - 6 milestones"
echo "   - 6 epic issues"
echo "   - 3 high-priority feature issues"
echo ""
echo "To create more feature and task issues, refer to GITHUB_ISSUES_SETUP.md"
