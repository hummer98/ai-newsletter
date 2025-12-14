# Project Structure

## Organization Philosophy

Layer-based organization separating infrastructure concerns (external service integrations) from application logic (business rules). Each component has a single responsibility and clear interfaces.

## Directory Patterns

### Source Code (`/src/`)
**Location**: `/src/`
**Purpose**: All TypeScript application code
**Pattern**: Layer-based organization with index exports

```
src/
  infrastructure/     # External service connectors
  application/        # Business logic services
  types/              # Shared TypeScript interfaces
  index.ts            # Main entry point
```

### Infrastructure Layer (`/src/infrastructure/`)
**Location**: `/src/infrastructure/`
**Purpose**: External service integrations (Firestore, Resend)
**Pattern**: One connector per service, uses SDK directly

```typescript
// Example: firestore-connector.ts
export class FirestoreConnector {
  getThemes(): Promise<Theme[]>;
  getSubscribers(themeId: string): Promise<Subscriber[]>;
}
```

### Application Layer (`/src/application/`)
**Location**: `/src/application/`
**Purpose**: Business logic orchestration
**Pattern**: Services that compose infrastructure connectors

```typescript
// Example: newsletter-generator.ts
export class NewsletterGenerator {
  generateForTheme(theme: Theme): Promise<GenerationResult>;
  generateAll(): Promise<GenerationResult[]>;
}
```

### Workflow Configuration (`/.github/workflows/`)
**Location**: `/.github/workflows/`
**Purpose**: GitHub Actions workflow definitions
**Pattern**: Single workflow file for newsletter delivery

### Tests (`/tests/`)
**Location**: `/tests/`
**Purpose**: Unit and integration tests
**Pattern**: Mirror source structure with `.test.ts` suffix

## Naming Conventions

- **Files**: kebab-case (`newsletter-generator.ts`, `firestore-connector.ts`)
- **Classes**: PascalCase (`NewsletterGenerator`, `FirestoreConnector`)
- **Interfaces**: PascalCase (`Theme`, `Subscriber`, `NewsletterContent`)
- **Functions**: camelCase (`generateForTheme`, `getSubscribers`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`, `BATCH_SIZE`)

## Import Organization

```typescript
// 1. Node.js built-ins
import { setTimeout } from 'timers/promises';

// 2. External packages
import { Firestore } from '@google-cloud/firestore';
import { Resend } from 'resend';

// 3. Internal modules (absolute from src)
import { Theme, Subscriber } from '../types';
import { FirestoreConnector } from '../infrastructure/firestore-connector';
```

**Path Strategy**: Relative imports within the project (no path aliases for simplicity in GitHub Actions environment)

## Code Organization Principles

- **Single Responsibility**: Each class/module handles one concern
- **Dependency Injection**: Connectors passed to services for testability
- **Interface-First**: Define types before implementation
- **Error Boundaries**: Each theme processes independently; failures are isolated

---
_Document patterns, not file trees. New files following patterns should not require updates_
