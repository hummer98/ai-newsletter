---
description: Commit changes from current session with appropriate granularity
allowed-tools: Bash(git *), Read(CLAUDE.md)
---

# Commit Command

Commit changes made during the current session with appropriate granularity and meaningful commit messages.

**Important**: Only commit files changed in the current session. Do not include files changed in other sessions or separate work.

## Instructions

Follow these steps:

### 1. Review Changes

```bash
git status
git diff
```

Analyze the nature of changes (feature/fix/refactor/docs/test/chore, etc.)

**Identify files changed in current session**:
- Only target files explicitly edited in the current session
- Exclude files changed in other sessions or background processes
- Prioritize files the user intentionally changed for the current task

### 2. Check Active Spec and Branch

- Identify active spec from "Active Specifications" in `@CLAUDE.md`
- Check current branch name: `git branch --show-current`
- Compare active spec's feature name with branch name

### 3. Branch Decision

**If feature name matches branch name**: Proceed to commit

**If feature name differs from branch name**: Prompt user to choose

```
Active Spec: [feature-name]
Current Branch: [current-branch]

Please choose:
1. Create new branch feature/[feature-name] and commit
2. Commit directly to current branch [current-branch]
```

### 4. Determine Commit Granularity

Group changes into logical units:

- Different feature implementations
- Separate bug fixes from feature additions
- Separate test code from implementation (when appropriate)
- Separate documentation updates (when appropriate)

**Principle**: One commit represents one logical change

### 5. Create Commit Messages

**Format**: `<type>: <subject>`

**Type**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Refactoring
- `docs`: Documentation
- `test`: Add/modify tests
- `chore`: Build, tool configuration, etc.
- `style`: Code style
- `perf`: Performance improvement

**Subject**: Concise description of the change

Add body if needed (detailed explanation, rationale, impact scope, etc.)

### 6. Execute Commit

```bash
# Stage only files changed in current session
git add [current-session-files]

# Commit with message
git commit -m "type: subject"

# Execute sequentially if multiple commits needed
```

**File selection notes**:
- Only stage files explicitly changed in the current session
- Do not include files changed in other sessions or background processes
- Prioritize files the user intentionally changed for the current task

### 7. Verify Results

```bash
git log --oneline -n [number of commits]
git status
```

## Examples

### Example 1: Single Feature Implementation
```
Changes:
- webapp/src/components/NewFeature.tsx (new)
- webapp/src/components/NewFeature.test.tsx (new)

Commit:
feat: add NewFeature component
```

### Example 2: Multiple Logical Changes
```
Changes:
- webapp/src/hooks/useData.ts (bug fix)
- webapp/src/components/Dashboard.tsx (refactoring)
- docs/api.md (documentation update)

Commits:
1. fix: resolve memory leak in useData hook
2. refactor: reorganize Dashboard component logic
3. docs: update API documentation
```

### Example 3: Feature with Tests
```
Changes:
- webapp/src/services/newService.ts (new)
- webapp/src/services/newService.test.ts (new)

Commit:
feat: implement new service with tests
```

## Notes

- Always split commits for multiple logical changes
- Use `wip:` prefix for Work In Progress commits
- Use `feature/[feature-name]` naming convention when creating branches
- Always verify tests pass before committing (`npm test`)
- Always verify `.env` or credential files are not staged
- **Only commit files changed in the current session**
- Do not include files changed in other sessions or separate work
- Prioritize files the user intentionally changed for the current task

## Branch Naming Convention

- Feature: `feature/[feature-name]`
- Bugfix: `fix/[issue-description]`
- Refactor: `refactor/[scope]`
- Docs: `docs/[topic]`

## Good Commit Message Examples

- `feat: add mini-map display feature`
- `fix: implement TTS order guarantee`
- `refactor: reorganize AppContext scheduling logic`
- `test: add integration tests for useMessageQueue`
- `docs: update deployment workflow`

## Bad Commit Message Examples

- `update files` (unclear what was updated)
- `fix bug` (unclear which bug)
- `wip` (unclear what work)
