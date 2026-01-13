# Scripts Directory

This directory contains operational and automation scripts for the RGP Back Office system.

---

## 📋 Table of Contents

1. [Database Operations](#database-operations)
2. [Maintenance & Cleanup](#maintenance--cleanup)
3. [GitHub Automation](#github-automation)

---

## 🗄️ Database Operations

### `backup.bat` (Windows)
**Purpose:** Backup PostgreSQL database to a compressed file.

**Usage:**
```cmd
backup.bat
```

**Output:**
- Creates timestamped backup in `backups/` directory
- Format: `rgpdb_backup_YYYY-MM-DD_HH-MM-SS.tar`

---

### `restore.bat` (Windows)
**Purpose:** Restore PostgreSQL database from a backup file.

**Usage:**
```cmd
restore.bat
```

**Prerequisites:**
- Docker container `rgp-db` must be running
- Backup file must exist in `backups/` directory

---

### `setup-test-db.bat` (Windows)
**Purpose:** Set up test database with sample data.

**Usage:**
```cmd
setup-test-db.bat
```

**What it does:**
- Creates test database schema
- Inserts sample data for testing
- Useful for development and QA

---

## 🧹 Maintenance & Cleanup

### `cleanup-temp-files.bat` (Windows) / `cleanup-temp-files.sh` (Unix/Linux/Mac)
**Purpose:** Remove temporary files created by Claude Code and development tools.

**Usage:**
```bash
# Windows
cleanup-temp-files.bat [--logs]

# Unix/Linux/Mac
./cleanup-temp-files.sh [--logs]
```

**What it cleans:**
- ✅ Temporary Claude working directory files (`tmpclaude-*-cwd`)
- ✅ Temporary files (`*.tmp`, `*.temp`)
- ✅ Log files (`*.log`) - only with `--logs` flag

**Options:**
- `--logs` - Also remove log files (use with caution)

**Examples:**
```bash
# Clean only temp files (safe)
cleanup-temp-files.bat

# Clean temp files AND logs
cleanup-temp-files.bat --logs
```

**When to use:**
- After long development sessions
- When root directory is cluttered with temp files
- Before creating clean commits
- As part of regular maintenance

**Safety:**
- All cleaned files are gitignored
- Won't affect committed code
- Logs are preserved unless you use `--logs` flag

---

## 🐙 GitHub Automation

See `GITHUB_SETUP_README.md` for detailed documentation on GitHub automation scripts.

### `create-github-issues.bat` / `create-github-issues.sh`
**Purpose:** Automate creation of GitHub labels, milestones, and issues.

**Quick Usage:**
```bash
# Windows
create-github-issues.bat

# Unix/Linux/Mac
./create-github-issues.sh
```

**Prerequisites:**
- GitHub CLI installed and authenticated
- Repository access

### `create-lifecycle-github-issues.sh`
**Purpose:** Create issues specific to invoice lifecycle features.

**Usage:**
```bash
./create-lifecycle-github-issues.sh
```

---

## 🔧 Script Maintenance

### Making Scripts Executable (Unix/Linux/Mac)
```bash
chmod +x scripts/*.sh
```

### Running Scripts from Project Root
```bash
# From project root
./scripts/cleanup-temp-files.sh

# Or navigate to scripts directory
cd scripts
./cleanup-temp-files.sh
```

---

## 📝 Creating New Scripts

### Naming Convention
- Use kebab-case: `my-script.bat` or `my-script.sh`
- Windows scripts: `.bat` extension
- Unix/Linux/Mac scripts: `.sh` extension

### Template Structure
```bash
#!/bin/bash
# ==============================================================================
# Script Name and Description
# ==============================================================================
# Description: What this script does
# Usage: ./script-name.sh [options]
# ==============================================================================

# Your script code here
```

### Best Practices
1. **Add comments** explaining what the script does
2. **Include usage instructions** in the header
3. **Provide error messages** for common issues
4. **Make .sh scripts executable**: `chmod +x script.sh`
5. **Test on target platform** before committing
6. **Update this README** with documentation

---

## 🆘 Troubleshooting

### Windows Script Execution Issues
```cmd
REM If script doesn't run, check:
1. Run as Administrator if needed
2. Check file paths (use quotes for paths with spaces)
3. Ensure Docker is running (for database scripts)
```

### Unix/Linux/Mac Script Permission Issues
```bash
# Make script executable
chmod +x scripts/script-name.sh

# Check permissions
ls -la scripts/script-name.sh
```

### Docker Container Not Running
```bash
# Check if container is running
docker ps

# Start containers
docker-compose up -d
```

---

## 📊 Quick Reference

| Script | Platform | Purpose | Frequency |
|--------|----------|---------|-----------|
| `backup.bat` | Windows | Database backup | Daily/Weekly |
| `restore.bat` | Windows | Database restore | As needed |
| `setup-test-db.bat` | Windows | Test DB setup | Development |
| `cleanup-temp-files.*` | Both | Clean temp files | Weekly/Monthly |
| `create-github-issues.*` | Both | GitHub automation | One-time setup |

---

## 🔗 Related Documentation

- **Project Structure**: `../claude.md`
- **Database Schema**: `../sql/README.md` (if exists)
- **Testing Guide**: `../tests/README.md`
- **GitHub Setup**: `GITHUB_SETUP_README.md`

---

**Last Updated:** 2026-01-13
**Maintained By:** Development Team
