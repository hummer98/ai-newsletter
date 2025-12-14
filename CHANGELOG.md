# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-12-15

### Added
- AI-powered automated newsletter delivery system using GitHub Actions
- Claude Code integration for AI-powered newsletter generation
- Date range variables for newsletter generation ({{period}}, {{today}}, {{days}})
- Theme-based newsletter content management with Firestore
- Scheduled delivery system with configurable timing
- Release command for version management
- Support for both OAuth and API key authentication
- Resend integration for email delivery
- React email template support

### Changed
- Improved Firestore theme variable replacement with date range support
- Updated authentication to accept either CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
- Aligned secret names with environment variables for consistency

### Fixed
- WebSearch permission issues in CI environment using .claude/settings.json
- React peer dependency warnings by adding dev dependencies
- Dry run default value type in workflow configuration
- Authentication validation for multiple auth methods

### Documentation
- Added comprehensive setup guide with GCP API enablement steps
- Updated authentication documentation to support both API Key and OAuth methods
- Added ANTHROPIC_API_KEY to setup documentation

[0.0.1]: https://github.com/hummer98/ai-newsletter/releases/tag/v0.0.1
