#!/bin/bash
set -e

# Load .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
else
  echo "Error: .env file not found"
  echo "Please copy .env.sample to .env and fill in your values"
  exit 1
fi

# Validate required variables
required_vars=(
  "CLOUDSDK_CORE_PROJECT"
  "POOL_NAME"
  "PROVIDER_NAME"
  "SERVICE_ACCOUNT_NAME"
  "RESEND_API_KEY"
  "FROM_EMAIL"
  "ANTHROPIC_API_KEY"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: $var is not set in .env"
    exit 1
  fi
done

echo "Setting up GitHub Secrets and Variables..."

# Get WORKLOAD_IDENTITY_PROVIDER from GCP
echo "Fetching WORKLOAD_IDENTITY_PROVIDER from GCP..."
WORKLOAD_IDENTITY_PROVIDER=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --location="global" \
  --workload-identity-pool="$POOL_NAME" \
  --format="value(name)")

# Generate SERVICE_ACCOUNT_EMAIL
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${CLOUDSDK_CORE_PROJECT}.iam.gserviceaccount.com"

echo ""
echo "Values to be set:"
echo "  CLOUDSDK_CORE_PROJECT: $CLOUDSDK_CORE_PROJECT"
echo "  WORKLOAD_IDENTITY_PROVIDER: $WORKLOAD_IDENTITY_PROVIDER"
echo "  SERVICE_ACCOUNT_EMAIL: $SERVICE_ACCOUNT_EMAIL"
echo "  FROM_EMAIL: $FROM_EMAIL"
echo "  RESEND_API_KEY: (hidden)"
echo "  ANTHROPIC_API_KEY: (hidden)"
echo ""

read -p "Continue? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted"
  exit 0
fi

# Set GitHub Variables
echo "Setting GitHub Variables..."
gh variable set CLOUDSDK_CORE_PROJECT --body "$CLOUDSDK_CORE_PROJECT"

# Set GitHub Secrets
echo "Setting GitHub Secrets..."
gh secret set WORKLOAD_IDENTITY_PROVIDER --body "$WORKLOAD_IDENTITY_PROVIDER"
gh secret set SERVICE_ACCOUNT_EMAIL --body "$SERVICE_ACCOUNT_EMAIL"
gh secret set RESEND_API_KEY --body "$RESEND_API_KEY"
gh secret set FROM_EMAIL --body "$FROM_EMAIL"
gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_API_KEY"

echo ""
echo "Done! GitHub Secrets and Variables have been set."
echo ""
echo "You can verify with:"
echo "  gh secret list"
echo "  gh variable list"
