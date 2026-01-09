# GitHub Project Setup Scripts

This directory contains automation scripts for setting up GitHub issues, labels, and project boards for the RGP Back Office system.

---

## 📁 Files in this Directory

### 1. `create-github-issues.bat` (Windows)
**Purpose:** Automate creation of GitHub labels, milestones, and issues using GitHub CLI.

**Prerequisites:**
- Windows 10 or later
- [GitHub CLI](https://cli.github.com/) installed
- GitHub authentication configured

**Usage:**
```cmd
# 1. Edit the script and update REPO variable
notepad create-github-issues.bat
# Change: SET REPO=your-username/rgp-bo

# 2. Run the script
create-github-issues.bat
```

**What it creates:**
- ✅ 40+ labels (priority, type, module, size, etc.)
- ✅ 6 milestones
- ✅ 6 epic issues
- ✅ 5 high-priority feature issues

---

### 2. `create-github-issues.sh` (Linux/Mac)
**Purpose:** Same as Windows version but for Unix-based systems.

**Prerequisites:**
- Linux or macOS
- [GitHub CLI](https://cli.github.com/) installed
- GitHub authentication configured

**Usage:**
```bash
# 1. Edit the script and update REPO variable
nano create-github-issues.sh
# Change: REPO="your-username/rgp-bo"

# 2. Make executable
chmod +x create-github-issues.sh

# 3. Run the script
./create-github-issues.sh
```

---

## 🚀 Quick Start Guide

### Step 1: Install GitHub CLI

**Windows:**
```powershell
# Using Winget
winget install --id GitHub.cli

# Or download installer from:
# https://github.com/cli/cli/releases/latest
```

**Mac:**
```bash
brew install gh
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

---

### Step 2: Authenticate with GitHub

```bash
gh auth login
```

Follow the prompts:
1. Select: **GitHub.com**
2. Choose: **HTTPS** (recommended)
3. Authenticate: **Login with a web browser** (easiest)
4. Copy the one-time code and paste in browser

Verify authentication:
```bash
gh auth status
```

---

### Step 3: Update Repository Name

Edit the appropriate script for your OS:

**Windows (`create-github-issues.bat`):**
```batch
SET REPO=your-username/rgp-bo
```

**Linux/Mac (`create-github-issues.sh`):**
```bash
REPO="your-username/rgp-bo"
```

Replace `your-username` with your actual GitHub username or organization name.

---

### Step 4: Run the Script

**Windows:**
```cmd
cd D:\workspace\rgp-bo\scripts
create-github-issues.bat
```

**Linux/Mac:**
```bash
cd ~/workspace/rgp-bo/scripts
./create-github-issues.sh
```

**Expected Output:**
```
============================================
  GitHub Issues Setup for RGP Back Office
============================================
  Repository: your-username/rgp-bo

============================================
  Step 1: Creating Labels
============================================

[OK] Labels created successfully

============================================
  Step 2: Creating Milestones
============================================

[OK] Milestones created successfully

============================================
  Step 3: Creating Epic Issues
============================================

[OK] Epic issues created successfully

============================================
  Step 4: Creating Feature Issues
============================================

[OK] Feature issues created successfully

============================================
  SETUP COMPLETE!
============================================

Summary:
  - 40+ labels created
  - 6 milestones created
  - 6 epic issues created
  - 5 high-priority feature issues created
```

---

## 📋 Alternative: CSV Import

If you prefer to import issues via CSV instead of using scripts:

### 1. Prepare CSV File
The file `github-issues-import.csv` (in project root) contains 70+ pre-configured issues.

### 2. Import to GitHub
**Option A: Using GitHub Web UI**
1. Go to: `https://github.com/your-username/rgp-bo/issues`
2. Click "Issues" → "Milestones" → "Labels" to set those up first (use script)
3. Then use GitHub's bulk import feature (if available)

**Option B: Using gh CLI**
```bash
# Import issues from CSV (requires custom scripting)
# The provided script already creates the most important issues
# Additional issues can be created manually or via API
```

**Option C: Using GitHub API**
```bash
# Install jq for JSON processing
# Windows: choco install jq
# Mac: brew install jq
# Linux: sudo apt install jq

# Example: Create issue from CSV row
gh api repos/your-username/rgp-bo/issues \
  -f title="Issue Title" \
  -f body="Issue Description" \
  -f labels[]="type: feature" \
  -f labels[]="priority: high"
```

---

## 🎯 Post-Setup Tasks

After running the script, complete these manual steps:

### 1. Set Milestone Due Dates
```bash
# Open milestones page
gh browse --repo your-username/rgp-bo /milestones
```

Or visit: `https://github.com/your-username/rgp-bo/milestones`

Click each milestone and set due dates:
- **Core Stability & Security:** +2 months
- **Enhanced Invoice Lifecycle:** +3 months
- **GST Compliance Complete:** +4 months
- **HR Management System:** +5 months
- **AI & Automation:** +6 months
- **Multi-Tenant Architecture:** +8 months

---

### 2. Create Project Board
```bash
# Open projects page
gh browse --repo your-username/rgp-bo /projects
```

Or visit: `https://github.com/your-username/rgp-bo/projects`

1. Click **"New Project"**
2. Choose **"Board"** template
3. Name it: "RGP Back Office Development"
4. Create these columns:
   - 📥 Backlog
   - 📋 To Do
   - 🔍 In Analysis
   - 👨‍💻 In Progress
   - 🔬 In Review
   - 🧪 Testing
   - 🚫 Blocked
   - ✅ Done

---

### 3. Add Issues to Project Board

**Method 1: Via Web UI**
1. Open your project board
2. Click "Add items"
3. Search for issues (e.g., type `is:issue` or filter by milestone)
4. Select all issues and add to board

**Method 2: Via CLI (requires project ID)**
```bash
# Get project ID
gh project list --owner your-username

# Add issues to project (replace PROJECT_ID)
gh project item-add PROJECT_ID --owner your-username --url https://github.com/your-username/rgp-bo/issues/1
```

---

### 4. Configure Project Views

Create these custom views in your project:

**View 1: Sprint Planning**
- Filter: `status:ready OR status:"in-progress"`
- Sort: Priority → Size
- Layout: Table
- Columns: Title, Type, Module, Priority, Size, Assignee, Status

**View 2: By Module**
- Group by: Module label
- Sort: Priority
- Layout: Board

**View 3: By Epic**
- Group by: Epic (parent issue reference)
- Filter: Exclude epics themselves
- Sort: Status
- Layout: Board

**View 4: Bug Tracking**
- Filter: `label:"type: bug"`
- Group by: Priority
- Sort: Created (newest first)
- Layout: Table

---

## 🔧 Troubleshooting

### Error: "gh: command not found"
**Solution:** GitHub CLI not installed. Follow Step 1 installation instructions.

### Error: "HTTP 401: Bad credentials"
**Solution:** Not authenticated. Run `gh auth login` to authenticate.

### Error: "Resource not accessible by integration"
**Solution:** Your GitHub account doesn't have permission. Ensure you:
1. Own the repository, or
2. Have admin/write access to the repository

### Error: "Milestone not found"
**Solution:** Milestones must be created before issues that reference them. The script creates milestones first, but if you're creating issues manually, ensure milestones exist.

### Error: "Label does not exist"
**Solution:** Labels must be created before applying them to issues. Run the label creation part of the script first.

### Issues Already Exist
**Solution:** The script uses `2>nul` (Windows) or `|| true` (Unix) to suppress errors for existing items. It's safe to run multiple times.

---

## 📚 Additional Resources

### Documentation
- **Full Setup Guide:** `../GITHUB_ISSUES_SETUP.md`
- **Quick Reference:** `../GITHUB_PROJECT_SUMMARY.md`
- **Project Context:** `../CLAUDE.md`

### GitHub Documentation
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub Issues](https://docs.github.com/en/issues)
- [GitHub Labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)

### Useful Commands
```bash
# List all issues
gh issue list --repo your-username/rgp-bo

# List labels
gh label list --repo your-username/rgp-bo

# List milestones
gh api repos/your-username/rgp-bo/milestones | jq

# Create single issue
gh issue create --title "My Issue" --body "Description" --label "type: bug"

# Close issue
gh issue close 123

# Reopen issue
gh issue reopen 123

# View issue
gh issue view 123

# Edit issue
gh issue edit 123 --add-label "priority: high"
```

---

## 🎨 Customization

### Adding More Labels
Edit the script and add:

```bash
gh label create "custom-label" --color ff0000 --description "Description" --repo $REPO
```

### Creating Additional Issues
Use the template:

```bash
gh issue create --repo $REPO \
  --title "Issue Title" \
  --label "type: feature,priority: high" \
  --milestone "Milestone Name" \
  --body "Detailed description"
```

### Bulk Create Issues from CSV
Convert CSV to gh commands:

```bash
# Example: Read CSV and create issues
while IFS=, read -r title body labels assignees milestone priority size
do
  gh issue create --repo $REPO \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "$milestone"
done < github-issues-import.csv
```

---

## ⚙️ Automation Options

### GitHub Actions Integration

Create `.github/workflows/issue-automation.yml`:

```yaml
name: Issue Automation
on:
  issues:
    types: [opened, labeled]

jobs:
  auto-assign:
    runs-on: ubuntu-latest
    steps:
      - name: Auto-assign by label
        if: contains(github.event.issue.labels.*.name, 'module: sales')
        run: |
          gh issue edit ${{ github.event.issue.number }} \
            --add-assignee sales-team-member
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Auto-add to Project
```yaml
name: Add to Project
on:
  issues:
    types: [opened]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - name: Add issue to project
        run: |
          gh project item-add PROJECT_ID \
            --owner ${{ github.repository_owner }} \
            --url ${{ github.event.issue.html_url }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📞 Support

### Common Issues
1. **Script hangs:** Press Ctrl+C and check network connection
2. **Partial creation:** Script is idempotent, run again to complete
3. **Permission errors:** Ensure you have admin access to repository

### Getting Help
- GitHub CLI docs: `gh help`
- Issues documentation: `gh issue --help`
- API documentation: `gh api --help`

---

**Version:** 1.0
**Last Updated:** 2025-01-09
**Tested On:** Windows 11, macOS 14, Ubuntu 22.04

---

## ✅ Success Checklist

After running the script, verify:

- [ ] Labels created (40+)
  ```bash
  gh label list --repo your-username/rgp-bo | wc -l
  ```

- [ ] Milestones created (6)
  ```bash
  gh api repos/your-username/rgp-bo/milestones | jq length
  ```

- [ ] Epic issues created (6)
  ```bash
  gh issue list --label "size: xl" --repo your-username/rgp-bo
  ```

- [ ] Feature issues created (5+)
  ```bash
  gh issue list --label "type: feature" --repo your-username/rgp-bo
  ```

- [ ] Milestone due dates set (manual)
- [ ] Project board created (manual)
- [ ] Issues added to project (manual)
- [ ] First sprint planned (manual)

**Congratulations!** Your GitHub project is now set up for success! 🎉
