#!/usr/bin/env bash
# ==============================================================================
# safe-git-sync.sh - Automated, Safe Git Synchronization for Workspace Startup
#
# Core Principles:
# 1. Never discard or overwrite uncommitted changes or local work.
# 2. Never run destructive Git commands (git reset --hard, git clean, force-push).
# 3. Only pull when fast-forward is strictly possible (--ff-only) and tree is clean.
# 4. Stop safely if branches have diverged, work is dirty, or an operation is active.
# 5. Never push automatically.
# ==============================================================================

set -eo pipefail

# ANSI color codes (only when output is a terminal)
if [ -t 1 ]; then
    COLOR_RESET="\033[0m"
    COLOR_INFO="\033[36m"     # Cyan
    COLOR_SUCCESS="\033[32m"  # Green
    COLOR_WARN="\033[33m"     # Yellow
    COLOR_ERROR="\033[31m"    # Red
    COLOR_BOLD="\033[1m"
else
    COLOR_RESET=""
    COLOR_INFO=""
    COLOR_SUCCESS=""
    COLOR_WARN=""
    COLOR_ERROR=""
    COLOR_BOLD=""
fi

log_info()    { printf "%b[INFO]%b %s\n" "$COLOR_INFO" "$COLOR_RESET" "$*"; }
log_success() { printf "%b[SUCCESS]%b %s\n" "$COLOR_SUCCESS" "$COLOR_RESET" "$*"; }
log_warn()    { printf "%b[WARN]%b %s\n" "$COLOR_WARN" "$COLOR_RESET" "$*"; }
log_error()   { printf "%b[ERROR]%b %s\n" "$COLOR_ERROR" "$COLOR_RESET" "$*"; }
log_header()  { printf "\n%b=== %s ===%b\n" "$COLOR_BOLD" "$*" "$COLOR_RESET"; }

log_header "ServeEase Safe Git Synchronization"

# 1. Check if inside a Git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log_error "Not inside a valid Git repository."
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$REPO_ROOT" || { log_error "Failed to navigate to repository root ($REPO_ROOT)"; exit 1; }
GIT_DIR="$(git rev-parse --git-dir)"

# 2. Check for active Git operations (merge, rebase, cherry-pick, revert, bisect)
if [ -f "$GIT_DIR/MERGE_HEAD" ] || \
   [ -d "$GIT_DIR/rebase-merge" ] || \
   [ -d "$GIT_DIR/rebase-apply" ] || \
   [ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] || \
   [ -f "$GIT_DIR/REVERT_HEAD" ] || \
   [ -f "$GIT_DIR/BISECT_LOG" ]; then
    log_error "A Git operation (merge, rebase, cherry-pick, revert, or bisect) is currently in progress."
    log_error "Safe synchronization stopped to avoid interfering with ongoing resolution."
    exit 1
fi

# 3. Check current branch and detached HEAD
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [ -z "$CURRENT_BRANCH" ]; then
    HEAD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    log_error "Repository is in a 'detached HEAD' state ($HEAD_COMMIT)."
    log_error "Cannot safely synchronize without an active branch. Please switch to a branch."
    exit 1
fi

# 4. Check upstream tracking branch and remote configuration
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)"
REMOTE="$(git config --get branch."$CURRENT_BRANCH".remote 2>/dev/null || echo "origin")"
REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"

if [ -z "$REMOTE_URL" ]; then
    log_error "Remote '$REMOTE' is not configured with a valid URL."
    exit 1
fi

# Print status summary
log_info "Repository Root : $REPO_ROOT"
log_info "Current Branch  : $CURRENT_BRANCH"
log_info "Remote URL      : $REMOTE_URL"

if [ -z "$UPSTREAM" ]; then
    log_warn "Branch '$CURRENT_BRANCH' does not track an upstream branch."
    log_warn "No automatic fetch or pull will be performed."
    log_warn "To configure upstream, run: git branch --set-upstream-to=$REMOTE/$CURRENT_BRANCH"
    exit 0
fi

log_info "Tracking Upstream: $UPSTREAM"

# 5. Check working tree cleanliness (tracked changes)
HAS_STAGED=0
HAS_UNSTAGED=0
HAS_CONFLICTS=0

if ! git diff --quiet --cached 2>/dev/null; then
    HAS_STAGED=1
fi

if ! git diff --quiet 2>/dev/null; then
    HAS_UNSTAGED=1
fi

CONFLICT_FILES="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
if [ -n "$CONFLICT_FILES" ]; then
    HAS_CONFLICTS=1
fi

# 6. Fetch updates from remote
log_info "Fetching latest updates from remote '$REMOTE'..."
if ! git fetch "$REMOTE" --prune --quiet; then
    log_error "Failed to fetch from remote '$REMOTE'. Check your network connection or credentials."
    exit 1
fi

# 7. Compare local HEAD and upstream
LOCAL_HASH="$(git rev-parse HEAD)"
UPSTREAM_HASH="$(git rev-parse "$UPSTREAM")"
BASE_HASH="$(git merge-base HEAD "$UPSTREAM")"

COMMITS_BEHIND="$(git rev-list --count HEAD.."$UPSTREAM")"
COMMITS_AHEAD="$(git rev-list --count "$UPSTREAM"..HEAD)"

# 8. Determine synchronization state
if [ "$LOCAL_HASH" = "$UPSTREAM_HASH" ]; then
    log_success "Branch '$CURRENT_BRANCH' is already up to date with '$UPSTREAM'."
    log_info "Status: Already synchronized. No updates needed."
elif [ "$LOCAL_HASH" = "$BASE_HASH" ]; then
    # Local branch is strictly behind upstream
    log_info "Local branch is behind '$UPSTREAM' by $COMMITS_BEHIND commit(s)."

    # Check for local uncommitted changes before pulling
    if [ "$HAS_CONFLICTS" -eq 1 ]; then
        log_error "Unresolved merge conflicts detected in working tree:"
        echo "$CONFLICT_FILES"
        log_error "Pull aborted to protect existing conflicts."
        exit 1
    fi
    if [ "$HAS_STAGED" -eq 1 ] || [ "$HAS_UNSTAGED" -eq 1 ]; then
        log_warn "Local uncommitted changes detected in tracked files:"
        git status --short
        log_warn "Pull aborted to protect your uncommitted changes from being overwritten."
        log_warn "Commit or stash your changes before synchronizing."
        exit 1
    fi

    # Safe to fast-forward
    log_info "Performing safe fast-forward pull (git pull --ff-only)..."
    if git pull --ff-only "$REMOTE" "$CURRENT_BRANCH"; then
        log_success "Successfully fast-forwarded '$CURRENT_BRANCH' to $UPSTREAM_HASH."
        log_info "Commits incorporated ($COMMITS_BEHIND):"
        git log --oneline --no-decorate "$LOCAL_HASH..HEAD"
    else
        log_error "Fast-forward pull failed. Working tree and branch state preserved without modification."
        exit 1
    fi
elif [ "$UPSTREAM_HASH" = "$BASE_HASH" ]; then
    # Local branch is strictly ahead
    log_warn "Local branch is ahead of '$UPSTREAM' by $COMMITS_AHEAD commit(s)."
    log_warn "Local commits not pushed:"
    git log --oneline --no-decorate "$UPSTREAM..HEAD"
    log_info "Per safe Git collaboration principles, local commits are NOT automatically pushed."
    log_success "Local work is safe. Ready for development."
else
    # Branches have diverged
    log_error "Branches have diverged!"
    log_error "Local commits ahead   : $COMMITS_AHEAD"
    log_error "Upstream commits behind: $COMMITS_BEHIND"
    log_error "To prevent unintended merge commits or history rewrites, automatic synchronization stopped."
    log_info "Local commits ahead:"
    git log --oneline --no-decorate "$UPSTREAM..HEAD"
    log_info "Upstream commits behind:"
    git log --oneline --no-decorate "HEAD..$UPSTREAM"
    log_warn "Please resolve divergence manually (e.g., git merge or git rebase)."
    exit 1
fi

log_header "Synchronization Complete"
