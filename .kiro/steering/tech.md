# Technology Stack

## Architecture

Layered architecture with clear separation between Infrastructure (external service connectors) and Application (business logic) layers. Each external service integration is isolated in its own connector for testability and maintainability.

```
GitHub Actions Workflow
    |
    +-- Infrastructure Layer
    |       +-- GitHubActionsWorkflow (auth, scheduling)
    |       +-- FirestoreConnector (data access)
    |
    +-- Application Layer
            +-- NewsletterGenerator (content creation)
            +-- EmailSender (delivery)
```

## Core Technologies

- **Language**: TypeScript 5.x (strict mode)
- **Runtime**: Node.js 20.x LTS
- **CI/CD**: GitHub Actions (Ubuntu Latest)
- **Database**: Cloud Firestore (read-only access)
- **Email**: Resend API v1
- **Auth**: Workload Identity Federation (keyless)

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@google-cloud/firestore` | Firestore SDK for theme/subscriber data |
| `resend` (v6.x) | Email delivery SDK with batch support |
| `google-github-actions/auth@v3` | WIF authentication in GitHub Actions |

## Development Standards

### Type Safety
- TypeScript strict mode enabled
- Explicit types for all interfaces (Theme, Subscriber, NewsletterContent)
- No implicit `any`

### Error Handling
- Theme-level error isolation (one failure does not affect others)
- Retry logic for transient failures (3 attempts for web search)
- Structured error reporting with success/failure counts

### Testing
- Unit tests with mocks for external services
- Integration tests using Firestore emulator
- End-to-end workflow validation via manual trigger

## Development Environment

### Required Tools
- Node.js 20.x LTS
- npm or yarn
- Firestore emulator (for integration tests)

### Common Commands
```bash
# Build: npm run build
# Test: npm test
# Lint: npm run lint
```

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| GitHub Actions over Cloud Functions | Simpler deployment, built-in scheduling, no cold starts for weekly execution |
| Workload Identity Federation | No service account keys to manage, follows security best practices |
| Firestore over SQL | Schema flexibility for theme configuration, natural subcollection model for subscribers |
| Resend over SES/SendGrid | Simple API, generous free tier, built-in batch support |
| Sequential theme processing | Error isolation, simpler debugging, acceptable for expected volume |

---
_Document standards and patterns, not every dependency_
