@echo off
REM GitHub Issues Creation Script for Windows
REM Prerequisites: Install GitHub CLI (gh) and authenticate with: gh auth login
REM Usage: create-github-issues.bat

SET REPO=akvimal/rgp-bo

echo.
echo ============================================
echo   GitHub Issues Setup for RGP Back Office
echo ============================================
echo   Repository: %REPO%
echo.

REM Check if gh CLI is installed
gh --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: GitHub CLI not found!
    echo Please install from: https://cli.github.com/
    echo After installing, run: gh auth login
    pause
    exit /b 1
)

REM Check if authenticated
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Not authenticated with GitHub
    echo Please run: gh auth login
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Step 1: Creating Labels
echo ============================================
echo.

REM Priority Labels
gh label create "priority: critical" --color d73a4a --description "Must be fixed immediately" --repo %REPO% 2>nul
gh label create "priority: high" --color ff9800 --description "Should be addressed soon" --repo %REPO% 2>nul
gh label create "priority: medium" --color fbca04 --description "Normal priority" --repo %REPO% 2>nul
gh label create "priority: low" --color 0e8a16 --description "Nice to have" --repo %REPO% 2>nul

REM Type Labels
gh label create "type: feature" --color 0052cc --description "New feature or capability" --repo %REPO% 2>nul
gh label create "type: enhancement" --color 84b6eb --description "Improvement to existing feature" --repo %REPO% 2>nul
gh label create "type: bug" --color d73a4a --description "Something isn't working" --repo %REPO% 2>nul
gh label create "type: docs" --color d4c5f9 --description "Documentation only" --repo %REPO% 2>nul
gh label create "type: refactor" --color 5319e7 --description "Code refactoring" --repo %REPO% 2>nul
gh label create "type: security" --color b60205 --description "Security-related" --repo %REPO% 2>nul
gh label create "type: performance" --color ff6b6b --description "Performance optimization" --repo %REPO% 2>nul
gh label create "type: tech-debt" --color 8b4513 --description "Technical debt cleanup" --repo %REPO% 2>nul
gh label create "type: research" --color c2e0c6 --description "Research and investigation" --repo %REPO% 2>nul

REM Status Labels
gh label create "status: planning" --color c5def5 --description "In planning phase" --repo %REPO% 2>nul
gh label create "status: ready" --color 0e8a16 --description "Ready to start" --repo %REPO% 2>nul
gh label create "status: in-progress" --color fbca04 --description "Currently being worked on" --repo %REPO% 2>nul
gh label create "status: blocked" --color d73a4a --description "Blocked by dependencies" --repo %REPO% 2>nul
gh label create "status: review" --color 6f42c1 --description "In code review" --repo %REPO% 2>nul
gh label create "status: testing" --color ff9800 --description "In testing phase" --repo %REPO% 2>nul
gh label create "status: done" --color 006b75 --description "Completed" --repo %REPO% 2>nul

REM Module Labels
gh label create "module: core" --color 001f3f --description "Core system" --repo %REPO% 2>nul
gh label create "module: sales" --color 0074d9 --description "Sales module" --repo %REPO% 2>nul
gh label create "module: purchases" --color 39cccc --description "Purchases module" --repo %REPO% 2>nul
gh label create "module: inventory" --color 2ecc40 --description "Inventory module" --repo %REPO% 2>nul
gh label create "module: customers" --color 7fdbff --description "Customer management" --repo %REPO% 2>nul
gh label create "module: vendors" --color 001f3f --description "Vendor management" --repo %REPO% 2>nul
gh label create "module: reports" --color b10dc9 --description "Reporting module" --repo %REPO% 2>nul
gh label create "module: hr" --color f012be --description "HR module" --repo %REPO% 2>nul
gh label create "module: gst" --color ff851b --description "GST compliance" --repo %REPO% 2>nul
gh label create "module: api" --color ffdc00 --description "API/Backend" --repo %REPO% 2>nul
gh label create "module: frontend" --color 01ff70 --description "Frontend/UI" --repo %REPO% 2>nul
gh label create "module: database" --color 85144b --description "Database" --repo %REPO% 2>nul
gh label create "module: ai" --color f012be --description "AI features" --repo %REPO% 2>nul

REM Size Labels
gh label create "size: xs" --color f1f8ff --description "< 2 hours" --repo %REPO% 2>nul
gh label create "size: s" --color e1ecf4 --description "2-4 hours" --repo %REPO% 2>nul
gh label create "size: m" --color c5def5 --description "1-2 days" --repo %REPO% 2>nul
gh label create "size: l" --color 6a737d --description "3-5 days" --repo %REPO% 2>nul
gh label create "size: xl" --color 24292e --description "1-2 weeks" --repo %REPO% 2>nul

REM Component Labels
gh label create "component: backend" --color 0366d6 --description "Backend code" --repo %REPO% 2>nul
gh label create "component: frontend" --color 1b998b --description "Frontend code" --repo %REPO% 2>nul
gh label create "component: database" --color 8b4513 --description "Database changes" --repo %REPO% 2>nul
gh label create "component: devops" --color 586069 --description "DevOps/Infrastructure" --repo %REPO% 2>nul
gh label create "component: testing" --color 6f42c1 --description "Testing" --repo %REPO% 2>nul

REM Special Labels
gh label create "good-first-issue" --color 7057ff --description "Good for newcomers" --repo %REPO% 2>nul
gh label create "help-wanted" --color 008672 --description "Extra attention needed" --repo %REPO% 2>nul
gh label create "breaking-change" --color d93f0b --description "Breaking API change" --repo %REPO% 2>nul
gh label create "needs-discussion" --color fef2c0 --description "Needs team discussion" --repo %REPO% 2>nul

echo [OK] Labels created successfully
echo.

echo.
echo ============================================
echo   Step 2: Creating Milestones
echo ============================================
echo.

REM Note: Windows doesn't have 'date -d' command, so we'll create milestones without due dates
REM You can set due dates manually in GitHub UI

gh api repos/%REPO%/milestones -f title="Core Stability & Security" -f description="Complete security hardening, error handling, and stability improvements" 2>nul
gh api repos/%REPO%/milestones -f title="Enhanced Invoice Lifecycle" -f description="Complete the enhanced invoice lifecycle frontend implementation" 2>nul
gh api repos/%REPO%/milestones -f title="GST Compliance Complete" -f description="Full GST reporting and compliance system" 2>nul
gh api repos/%REPO%/milestones -f title="HR Management System" -f description="Complete HR module with attendance, leave, and performance" 2>nul
gh api repos/%REPO%/milestones -f title="AI & Automation" -f description="AI-powered features and workflow automation" 2>nul
gh api repos/%REPO%/milestones -f title="Multi-Tenant Architecture" -f description="Support for multiple businesses and stores" 2>nul

echo [OK] Milestones created successfully
echo     Note: Set due dates manually in GitHub UI
echo.

echo.
echo ============================================
echo   Step 3: Creating Epic Issues
echo ============================================
echo.

REM Epic #1: Security & Stability Hardening
gh issue create --repo %REPO% --title "[EPIC] Security & Stability Hardening" --label "type: feature,priority: critical,module: core,size: xl" --milestone "Core Stability & Security" --body "Comprehensive security and stability improvements across the entire application.%newline%%newline%Goals:%newline%- Phase 1-4: COMPLETED%newline%- Phase 5: Apply error handling to all services%newline%- Phase 6-7: Security audit and performance optimization%newline%%newline%Estimated Effort: 8-10 weeks" 2>nul

REM Epic #2: Enhanced Purchase Invoice Lifecycle
gh issue create --repo %REPO% --title "[EPIC] Enhanced Purchase Invoice Lifecycle Management" --label "type: feature,priority: high,module: purchases,size: xl" --milestone "Enhanced Invoice Lifecycle" --body "Complete lifecycle management for purchase invoices including OCR, payment tracking, and tax reconciliation.%newline%%newline%Current Status:%newline%- Database Schema: 100%%%newline%- Backend API: 100%%%newline%- Frontend UI: 0%%%newline%%newline%Estimated Effort: 12-14 weeks" 2>nul

REM Epic #3: GST Compliance & Reporting
gh issue create --repo %REPO% --title "[EPIC] GST Compliance & Tax Reporting System" --label "type: feature,priority: critical,module: gst,size: xl" --milestone "GST Compliance Complete" --body "Complete GST compliance system with all statutory reports, ITC management, and filing capabilities.%newline%%newline%Current Status:%newline%- Backend API: 100%%%newline%- Frontend Reports: Partial%newline%- GSTR-2A/2B UI: 0%%%newline%%newline%Estimated Effort: 10-12 weeks" 2>nul

REM Epic #4: HR Management System
gh issue create --repo %REPO% --title "[EPIC] HR Management & Performance Tracking" --label "type: feature,priority: high,module: hr,size: xl" --milestone "HR Management System" --body "Comprehensive HR management system with shift scheduling, attendance, leave management, and performance scoring.%newline%%newline%Current Status:%newline%- Database Schema: 100%%%newline%- Backend API: 100%%%newline%- Frontend Components: 80%%%newline%- Performance Dashboard: 0%%%newline%%newline%Estimated Effort: 14-16 weeks" 2>nul

REM Epic #5: AI-Powered Sales Intelligence
gh issue create --repo %REPO% --title "[EPIC] AI-Powered Sales Intelligence & Automation" --label "type: feature,priority: medium,module: ai,module: sales,size: l" --milestone "AI & Automation" --body "AI-powered features for sales assistance, product recommendations, and intelligent automation.%newline%%newline%Current Status:%newline%- Sales Intent API: 100%%%newline%- Claude Integration: 100%%%newline%- Frontend Chat UI: 0%%%newline%%newline%Estimated Effort: 10-12 weeks" 2>nul

REM Epic #6: Multi-Tenant Architecture
gh issue create --repo %REPO% --title "[EPIC] Multi-Tenant Store & Business Architecture" --label "type: feature,priority: medium,module: core,size: xl" --milestone "Multi-Tenant Architecture" --body "Enable the system to support multiple businesses with complete data isolation and role-based access.%newline%%newline%Current Status:%newline%- Basic multi-store: Partial%newline%- Full tenant isolation: 0%%%newline%- Tenant management UI: 0%%%newline%%newline%Estimated Effort: 16-20 weeks" 2>nul

echo [OK] Epic issues created successfully
echo.

echo.
echo ============================================
echo   Step 4: Creating Feature Issues
echo ============================================
echo.

REM Feature: Apply Phase 4 Error Handling
gh issue create --repo %REPO% --title "Apply Phase 4 Error Handling Pattern to All Services" --label "type: enhancement,priority: high,module: core,component: backend,size: l" --milestone "Core Stability & Security" --body "Apply comprehensive error handling pattern to all 16 backend services (~124 methods).%newline%%newline%Services: sale.service.ts, purchase-invoice.service.ts, customer.service.ts, product.service.ts, stock.service.ts, and 11 more.%newline%%newline%Estimated Effort: 3-4 weeks" 2>nul

REM Feature: Invoice Document Upload with OCR
gh issue create --repo %REPO% --title "Invoice Document Upload with OCR Integration" --label "type: feature,priority: high,module: purchases,component: backend,component: frontend,size: l" --milestone "Enhanced Invoice Lifecycle" --body "Enable users to upload invoice PDF/image documents with automatic OCR data extraction.%newline%%newline%Features:%newline%- Drag-and-drop upload%newline%- OCR extraction (>85%% accuracy)%newline%- Manual correction interface%newline%- Secure document storage%newline%%newline%Estimated Effort: 4-5 weeks" 2>nul

REM Feature: GSTR-1 Report Frontend
gh issue create --repo %REPO% --title "GSTR-1 Report Generation Frontend Interface" --label "type: feature,priority: critical,module: gst,module: reports,component: frontend,size: m" --milestone "GST Compliance Complete" --body "Build UI for generating GSTR-1 reports (B2B, B2C Large, B2C Small, HSN Summary).%newline%%newline%Features:%newline%- Month/quarter selection%newline%- All GSTR-1 report tables%newline%- Excel and JSON export%newline%- Validation checks%newline%%newline%Estimated Effort: 3-4 weeks" 2>nul

REM Feature: Payment Tracking UI
gh issue create --repo %REPO% --title "Payment Tracking & Reconciliation User Interface" --label "type: feature,priority: high,module: purchases,component: frontend,size: m" --milestone "Enhanced Invoice Lifecycle" --body "Build frontend UI for tracking multiple payments against purchase invoices.%newline%%newline%Features:%newline%- Payment form with history timeline%newline%- Real-time status updates%newline%- Payment reconciliation%newline%- Overdue alerts%newline%%newline%Estimated Effort: 2-3 weeks" 2>nul

REM Feature: AI Sales Chat Interface
gh issue create --repo %REPO% --title "AI Sales Assistant Conversational Chat Interface" --label "type: feature,priority: medium,module: ai,module: sales,component: frontend,size: m" --milestone "AI & Automation" --body "Build conversational chat interface for AI-powered sales assistant in POS.%newline%%newline%Features:%newline%- Natural language product search%newline%- Product recommendations%newline%- Quick add to cart%newline%- Conversation history%newline%%newline%Estimated Effort: 3-4 weeks" 2>nul

echo [OK] Feature issues created successfully
echo.

echo.
echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo Summary:
echo   - 40+ labels created
echo   - 6 milestones created
echo   - 6 epic issues created
echo   - 5 high-priority feature issues created
echo.
echo Next Steps:
echo   1. Visit: https://github.com/%REPO%/issues
echo   2. Set milestone due dates in GitHub UI
echo   3. Create Project Board: https://github.com/%REPO%/projects
echo   4. Add issues to project board
echo   5. Refer to GITHUB_ISSUES_SETUP.md for more issues
echo.
echo Press any key to open GitHub issues in browser...
pause >nul
start https://github.com/%REPO%/issues
