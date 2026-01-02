# Git Setup Instructions

## Step 1: Install Git (if not already installed)

If Git is not installed on your system, please install it first:

1. **Download Git for Windows:**
   - Visit: https://git-scm.com/download/win
   - Download and run the installer
   - Use default settings during installation

2. **Or install via winget (Windows Package Manager):**
   ```powershell
   winget install --id Git.Git -e --source winget
   ```

3. **After installation, restart your terminal/IDE** to ensure Git is in your PATH

## Step 2: Initialize Git Repository

Once Git is installed, you have two options:

### Option A: Run the automated script
```powershell
.\setup-git.ps1
```

### Option B: Run commands manually
```powershell
# Initialize repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Add nuggets v60 project"
```

## Step 3: (Optional) Connect to Remote Repository

If you want to push to GitHub, GitLab, or another remote:

```powershell
# Add remote repository
git remote add origin <your-repository-url>

# Push to remote
git push -u origin main
```

## Verify Installation

To check if Git is installed:
```powershell
git --version
```

If this shows a version number, Git is installed and ready to use!


