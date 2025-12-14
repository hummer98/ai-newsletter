![AI Newsletter](docs/images/banner.png)

<p align="right">
  <strong>English</strong> | <a href="README.ja.md">日本語</a>
</p>

# AI Newsletter

An AI-powered automated newsletter delivery system using GitHub Actions. It retrieves themes and subscribers from Firestore, generates content with AI, and delivers emails via the Resend API.

## Features

- Automated weekly execution every Monday at 9:00 AM JST (cron schedule)
- Manual trigger support with dry-run mode
- Theme-based subscriber lists from Firestore
- Batch email delivery via Resend API (100 emails/request)
- Keyless authentication with Workload Identity Federation

## Prerequisites

- Node.js 20.x or higher
- Google Cloud Platform project
- Firestore database
- Resend account

## Setup

### 1. Clone Repository and Install Dependencies

```bash
git clone <repository-url>
cd ai-newsletter
npm install
```

### 2. Create Environment Variables File

Copy `.env.sample` to `.env` and configure values:

```bash
cp .env.sample .env
# Edit .env with your actual values
```

Load environment variables for subsequent steps:

```bash
source .env
```

### 3. Resend Setup

1. Sign up at [Resend](https://resend.com)
2. Add your domain and configure DNS records for verification
3. Create an API key from the [API Keys](https://resend.com/api-keys) section
4. Set `RESEND_API_KEY` and `FROM_EMAIL` in `.env`

### 4. GCP Workload Identity Federation Setup

Configure Workload Identity Federation for GitHub Actions to access GCP resources.

Since `CLOUDSDK_CORE_PROJECT` is set in `.env`, you can omit the `--project` flag.

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create $POOL_NAME \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
  --location="global" \
  --workload-identity-pool=$POOL_NAME \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create Service Account
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="Newsletter Service Account"

# Grant Firestore access
gcloud projects add-iam-policy-binding $CLOUDSDK_CORE_PROJECT \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${CLOUDSDK_CORE_PROJECT}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  ${SERVICE_ACCOUNT_NAME}@${CLOUDSDK_CORE_PROJECT}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $CLOUDSDK_CORE_PROJECT --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"
```

### 5. Create Firestore Data

#### Install Sample Data (Recommended)

Install a sample theme for AI coding agent news:

```bash
npm run install:ainews
```

This script creates:
- Theme: `ai-coding-agents` (latest news about AI coding agents)
- Subscriber: automatically retrieves email from git config user.email

#### Data Structure

Firestore data structure:

```
themes/
  └── {theme-id}/
        ├── prompt: string        # Theme prompt
        └── mailto/
              └── {subscriber-id}/
                    └── mailto: string  # Subscriber email address
```

### 6. Register GitHub Secrets/Variables

Run the setup script for batch registration:

```bash
./scripts/setup-secrets.sh
```

This script automatically:
- Loads configuration from `.env`
- Retrieves `WORKLOAD_IDENTITY_PROVIDER` from GCP
- Generates `SERVICE_ACCOUNT_EMAIL`
- Registers GitHub Secrets/Variables

#### Manual Configuration

Configure the following in repository Settings > Secrets and variables > Actions:

**Secrets (Sensitive)**

| Name | Description |
|------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `FROM_EMAIL` | Sender email address |
| `WORKLOAD_IDENTITY_PROVIDER` | Full path of WIF provider |
| `SERVICE_ACCOUNT_EMAIL` | Service account email |

**Variables (Non-sensitive)**

| Name | Description |
|------|-------------|
| `CLOUDSDK_CORE_PROJECT` | GCP project ID |

## Development

### Build

```bash
npm run build
```

### Test

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

### Lint

```bash
npm run lint
```

### Local Execution

```bash
# Load .env and run
source .env && npm start
```

#### GCP Authentication Setup

Local execution requires Firestore access. Configure using one of the following methods:

**Method 1: Application Default Credentials (Recommended)**

Use gcloud CLI credentials without a key file:

```bash
gcloud auth application-default login
```

**Method 2: Service Account Key**

Use a service account JSON key file. Add to `.env`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Manual Workflow Execution

Execute the workflow manually from the GitHub Actions tab:

1. Open the Actions tab
2. Select the "Newsletter Delivery" workflow
3. Click "Run workflow"
4. Optionally enable dry_run (test without sending emails)
5. Click "Run workflow" to execute

## Architecture

```
src/
├── index.ts                    # Main entry point
├── application/
│   ├── newsletter-generator.ts # Newsletter generation orchestration
│   ├── email-sender.ts         # Email delivery via Resend API
│   ├── content-generator-service.ts  # Content generation
│   └── web-search-service.ts   # Web search service
├── domain/
│   └── types.ts                # Domain type definitions
└── infrastructure/
    └── firestore-connector.ts  # Firestore connection
```

## License

MIT
