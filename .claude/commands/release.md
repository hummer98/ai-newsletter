---
description: Create a new release with version tag and changelog
allowed-tools: Bash(git *), Bash(gh *), Bash(npm *), Read(package.json), Read(CHANGELOG.md)
---

# Release Command

Create a new release with semantic version tag, changelog, and GitHub release.

## Instructions

Follow these steps:

### 1. Verify Current State

```bash
git status
git log --oneline -10
```

- Ensure working directory is clean
- Ensure on the main/master branch
- Review recent commits to understand changes

### 2. Determine Version

Read current version from `package.json`:

```bash
cat package.json | grep version
```

Determine next version based on changes:
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes

Ask user which version to release.

### 3. Update Version

```bash
npm version [major|minor|patch] --no-git-tag-version
```

This updates `package.json` version.

### 4. Generate Changelog

Review commits since last release:

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

Create or update `CHANGELOG.md` with:
- Version number and date
- Categorized changes (Features, Bug Fixes, Refactoring, etc.)
- Links to commits or PRs

Format:
```markdown
## [1.2.3] - 2024-12-15

### Added
- New feature description

### Changed
- Changed feature description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

### 5. Commit Version Changes

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v[version]"
```

### 6. Create Git Tag

```bash
git tag -a v[version] -m "Release v[version]"
```

### 7. Push Changes

```bash
git push origin master
git push origin v[version]
```

### 8. Create GitHub Release

```bash
gh release create v[version] \
  --title "v[version]" \
  --notes-file CHANGELOG.md \
  --latest
```

### 9. Verify Release

```bash
gh release list
git tag -l
```

## Example

```bash
# Current version: 1.0.0
# Changes: Added Claude Code integration, date range variables

# Determine version (minor: new features)
npm version minor --no-git-tag-version
# New version: 1.1.0

# Update CHANGELOG.md with features

# Commit
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v1.1.0"

# Tag
git tag -a v1.1.0 -m "Release v1.1.0"

# Push
git push origin master
git push origin v1.1.0

# Create GitHub release
gh release create v1.1.0 \
  --title "v1.1.0" \
  --notes "$(cat CHANGELOG.md | sed -n '/## \[1.1.0\]/,/## \[/p' | head -n -1)" \
  --latest
```

## Notes

- Always verify tests pass before releasing: `npm test`
- Ensure all changes are committed before starting
- Follow semantic versioning: https://semver.org/
- Keep CHANGELOG.md organized and readable
- Use annotated tags (`git tag -a`) not lightweight tags
- Verify `.env` or credential files are not committed

## Version Decision Guidelines

**MAJOR (Breaking Changes)**:
- API changes that break backward compatibility
- Removal of deprecated features
- Major architectural changes

**MINOR (New Features)**:
- New features added in a backward compatible manner
- Deprecation of features (but not removal)
- Significant improvements

**PATCH (Bug Fixes)**:
- Bug fixes
- Documentation updates
- Minor improvements

## Good Release Notes Examples

```markdown
## [1.2.0] - 2024-12-15

### Added
- Claude Code integration for AI-powered newsletter generation
- Theme-based date range variables ({{period}}, {{today}}, {{days}})
- Flexible authentication (OAuth or API key)

### Changed
- Improved Firestore theme variable replacement
- Updated README with authentication options

### Fixed
- WebSearch permission issues in CI environment
- React peer dependency warnings
```

## Bad Release Notes Examples

```markdown
## [1.2.0]

- Updates
- Bug fixes
- Improvements
```
