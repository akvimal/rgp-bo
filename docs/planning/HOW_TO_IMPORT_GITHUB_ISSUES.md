# How to Import GitHub Issues

This guide explains how to import the prioritized issues into your GitHub repository.

---

## Files Created

1. **GITHUB_ISSUES_PRIORITIZED_2026-01-15.md**
   - Detailed markdown with full issue descriptions
   - 11 issues (6 P0, 5 P1) with 73 total story points
   - Use for reference and planning discussions

2. **github-issues-import-prioritized.csv**
   - CSV format for direct GitHub import
   - Ready to upload to GitHub repository

---

## Method 1: GitHub Web Interface (Bulk Import)

### Step 1: Prepare Repository
1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/rgp-bo`
2. Navigate to Issues tab
3. Click Settings (gear icon) in top right

### Step 2: Import CSV
1. In Issues Settings, look for "Import issues" or use this URL:
   ```
   https://github.com/YOUR_USERNAME/rgp-bo/issues/import
   ```
2. Click "Choose File" and select `github-issues-import-prioritized.csv`
3. Map columns:
   - Title → title
   - Body → body
   - Labels → labels
   - Milestone → milestone
4. Click "Import Issues"
5. Wait for processing (may take 1-2 minutes for 11 issues)

### Step 3: Verify Import
1. Go to Issues tab
2. Filter by labels: `P0-critical`, `P1-high`
3. Check that all 11 issues are present
4. Verify formatting of issue descriptions

---

## Method 2: GitHub CLI (Command Line)

### Prerequisites
```bash
# Install GitHub CLI
# Windows (via winget):
winget install GitHub.cli

# Or download from: https://cli.github.com/

# Authenticate
gh auth login
```

### Create Issues Manually
```bash
# Navigate to repository
cd D:\workspace\rgp-bo

# Create P0 Issue #1
gh issue create \
  --title "[P0] Implement Batch/Expiry Tracking with FIFO/FEFO Enforcement" \
  --body-file docs/planning/issue-bodies/issue-1.md \
  --label "P0-critical,compliance,products,inventory,feature" \
  --milestone "Q1 2026 - Month 1"

# Create P0 Issue #2
gh issue create \
  --title "[P0] Implement Immutable Stock Audit Trail" \
  --body-file docs/planning/issue-bodies/issue-2.md \
  --label "P0-critical,security,inventory,compliance,feature" \
  --milestone "Q1 2026 - Month 1"

# ... repeat for all 11 issues
```

---

## Method 3: Manual Creation (Web Interface)

### For Each Issue:

1. **Go to Issues → New Issue**
2. **Copy Title** from `GITHUB_ISSUES_PRIORITIZED_2026-01-15.md`
3. **Copy Body** (entire description with formatting)
4. **Add Labels**:
   - P0 issues: `P0-critical` + module + type
   - P1 issues: `P1-high` + module + type
5. **Set Milestone**: Q1 2026 - Month 1/2/3
6. **Assign** (optional): Assign to team member
7. **Create Issue**

---

## Method 4: GitHub API (Automated Script)

### Create Import Script

Create `scripts/import-issues.js`:

```javascript
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN // Set in environment variables
});

const owner = "YOUR_USERNAME";
const repo = "rgp-bo";

async function importIssues() {
  const csvPath = path.join(__dirname, '../docs/planning/github-issues-import-prioritized.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV (simple parser, skip header)
  const lines = csvContent.split('\n').slice(1);

  for (const line of lines) {
    // Parse CSV row (handle quoted fields with commas)
    const match = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/);
    if (!match) continue;

    const [, title, body, labels, milestone] = match;

    try {
      const issue = await octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels: labels.split(','),
        milestone: milestone // Note: Milestone must exist or use milestone number
      });

      console.log(`Created issue #${issue.data.number}: ${title}`);
    } catch (error) {
      console.error(`Failed to create issue "${title}":`, error.message);
    }

    // Rate limiting: Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

importIssues();
```

### Run Script
```bash
# Set GitHub token
export GITHUB_TOKEN=your_github_personal_access_token

# Install dependencies
npm install @octokit/rest

# Run import
node scripts/import-issues.js
```

---

## Post-Import Steps

### 1. Create Milestones (if not exist)
```bash
gh api /repos/YOUR_USERNAME/rgp-bo/milestones \
  -X POST \
  -f title="Q1 2026 - Month 1" \
  -f description="Critical fixes and core enhancements" \
  -f due_on="2026-02-28T23:59:59Z"

gh api /repos/YOUR_USERNAME/rgp-bo/milestones \
  -X POST \
  -f title="Q1 2026 - Month 2" \
  -f due_on="2026-03-31T23:59:59Z"

gh api /repos/YOUR_USERNAME/rgp-bo/milestones \
  -X POST \
  -f title="Q1 2026 - Month 3" \
  -f due_on="2026-04-30T23:59:59Z"
```

### 2. Create Labels (if not exist)
```bash
# Priority labels
gh label create "P0-critical" --color "d73a4a" --description "CRITICAL: Fix immediately"
gh label create "P1-high" --color "ff9800" --description "HIGH: Next sprint priority"
gh label create "P2-medium" --color "ffc107" --description "MEDIUM: Backlog"

# Module labels
gh label create "products" --color "0366d6" --description "Products module"
gh label create "inventory" --color "0366d6" --description "Inventory/Stock module"
gh label create "purchases" --color "0366d6" --description "Purchases module"
gh label create "sales" --color "0366d6" --description "Sales/POS module"
gh label create "customers" --color "0366d6" --description "Customers module"
gh label create "payroll" --color "0366d6" --description "Payroll module"
gh label create "security" --color "d73a4a" --description "Security-related"

# Type labels
gh label create "feature" --color "a2eeef" --description "New feature"
gh label create "bug" --color "d73a4a" --description "Bug fix"
gh label create "enhancement" --color "a2eeef" --description "Enhancement to existing feature"
gh label create "compliance" --color "d73a4a" --description "Regulatory compliance"
gh label create "performance" --color "fbca04" --description "Performance improvement"
```

### 3. Create Project Board (Optional)
```bash
# Create project board
gh project create --title "RGP Back Office - Q1 2026" --body "Prioritized development backlog"

# Add issues to board
gh project item-add PROJECT_ID --issue ISSUE_NUMBER
```

### 4. Set Up Issue Templates
Create `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug Report
about: Report a bug or issue
labels: bug
---

## Bug Description
Brief description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- Browser: [e.g., Chrome 120]
- OS: [e.g., Windows 11]
```

---

## Verification Checklist

After import, verify:

- [ ] All 11 issues created successfully
- [ ] 6 issues have `P0-critical` label
- [ ] 5 issues have `P1-high` label
- [ ] All issues have module labels (products, inventory, etc.)
- [ ] All issues have type labels (feature, bug, etc.)
- [ ] Milestones assigned correctly (Month 1/2/3)
- [ ] Issue descriptions formatted correctly (markdown)
- [ ] Acceptance criteria checkboxes render properly
- [ ] Code blocks display with syntax highlighting
- [ ] Related issues links work (after all imported)

---

## Customization Tips

### Adjust Story Points
Edit CSV before import:
- Add custom field `story_points` column
- Use GitHub Projects for story point tracking

### Assign to Team Members
After import:
```bash
# Assign issue to user
gh issue edit 1 --add-assignee username

# Bulk assign (bash script)
for i in {1..6}; do
  gh issue edit $i --add-assignee backend-dev
done

for i in {7..11}; do
  gh issue edit $i --add-assignee fullstack-dev
done
```

### Link Related Issues
After all issues imported, edit issue descriptions to add proper links:
```markdown
**Related Issues**: #1, #2, #8
```

---

## Troubleshooting

### CSV Import Fails
- **Problem**: Quotes in body causing parse errors
- **Solution**: Ensure double quotes in body are escaped: `""`

### Labels Not Found
- **Problem**: Labels don't exist in repository
- **Solution**: Create labels first (see Post-Import Steps)

### Milestone Not Found
- **Problem**: Milestone doesn't exist
- **Solution**: Create milestones first or remove milestone column from CSV

### Rate Limiting
- **Problem**: GitHub API rate limit exceeded
- **Solution**: Wait 1 hour or use authenticated requests (higher limit)

---

## Next Steps After Import

1. **Review with Team**
   - Schedule issue triage meeting
   - Validate priorities and estimates
   - Assign ownership

2. **Create Sprint Boards**
   - Sprint 1 (Weeks 1-2): Issues #1, #2, #3
   - Sprint 2 (Weeks 3-4): Issues #4, #5, #6
   - Sprint 3 (Weeks 5-6): Issues #7, #8

3. **Set Up Automation**
   - Auto-close issues on PR merge
   - Auto-label based on file paths
   - Slack/Teams notifications on issue updates

4. **Documentation Links**
   - Link issues to design docs
   - Link issues to API specs
   - Link issues to test cases

---

**Document Version**: 1.0
**Created**: 2026-01-15
**Last Updated**: 2026-01-15
