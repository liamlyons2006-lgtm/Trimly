# Auto-sync guard for the Kiro Stop hook.
#
# Commits and pushes working-tree changes to GitHub — but ONLY after scanning
# the staged content for likely secrets. If anything suspicious is staged, it
# aborts WITHOUT committing or pushing, so a leak like a Plaid secret or a
# connection string never reaches the remote unattended.
#
# Exit 0 in all normal cases (clean tree, successful push, or a blocked push)
# so the hook does not surface as a hard failure; the message explains what
# happened.

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Output $msg }

# 1. Must be a git repo.
git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Info 'Not a git repository; skipping sync.'
  exit 0
}

# 2. Nothing to do on a clean tree.
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Info 'No changes to sync.'
  exit 0
}

# 3. Stage everything, then inspect what is actually staged.
git add -A

# 3a. Refuse if a secret-bearing env file got staged (only .env.example should
#     ever be tracked). Names like .env, .env.local, foo.env are blocked.
$stagedFiles = git diff --cached --name-only
$envLeak = $stagedFiles | Where-Object {
  $_ -match '(^|/)\.env($|\.)' -or ($_ -match '\.env$' -and $_ -notmatch '\.env\.example$')
} | Where-Object { $_ -notmatch '\.env\.example$' }

if ($envLeak) {
  git reset --quiet
  Write-Info "Auto-sync BLOCKED: an environment/secret file is staged and was NOT committed:`n  $($envLeak -join "`n  ")"
  Write-Info 'Add it to .gitignore or remove it from staging, then sync manually.'
  exit 0
}

# 3b. Scan the staged diff for high-signal secret patterns.
$diff = git diff --cached
$patterns = @(
  # Plaid secret / client id assignments with a real-looking value.
  'PLAID_SECRET\s*[:=]\s*\S{8,}',
  'PLAID_CLIENT_ID\s*[:=]\s*[0-9a-f]{16,}',
  # Postgres/other connection strings that embed a password.
  '(postgres|postgresql|mysql|mongodb(\+srv)?)://[^:\s/]+:[^@\s/]+@',
  # Common private key / token markers.
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  'AKIA[0-9A-Z]{16}',                 # AWS access key id
  'xox[baprs]-[0-9A-Za-z-]{10,}',     # Slack token
  'gh[pousr]_[0-9A-Za-z]{20,}',       # GitHub token
  'sk-[A-Za-z0-9]{20,}'               # generic secret/API key
)

$hits = @()
foreach ($p in $patterns) {
  # Only consider added lines (start with +) to avoid matching context.
  $matched = $diff | Select-String -Pattern ("^\+.*(" + $p + ")")
  if ($matched) { $hits += $p }
}

if ($hits.Count -gt 0) {
  git reset --quiet
  Write-Info 'Auto-sync BLOCKED: staged changes look like they contain a secret and were NOT committed.'
  Write-Info "Matched pattern(s): $($hits -join ', ')"
  Write-Info 'Move the value into the git-ignored .env, then sync manually if the change is safe.'
  exit 0
}

# 4. Clean — commit and push.
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git commit -m 'chore: sync changes from Kiro [skip ci]' | Out-Null
git push origin $branch
Write-Info "Synced to origin/$branch."
exit 0
