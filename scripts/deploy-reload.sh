#!/usr/bin/env bash
# ==============================================================================
# Zorah Backend - Zero-Downtime Deployment & Automated PM2 Rollback Script
# ==============================================================================
# Usage: ./scripts/deploy-reload.sh <BRANCH> <PM2_NAME>
# Example: ./scripts/deploy-reload.sh main zorah-backend
# ==============================================================================

set -eo pipefail

BRANCH="${1:-}"
PM2_NAME="${2:-}"

if [[ -z "$BRANCH" || -z "$PM2_NAME" ]]; then
    echo "❌ [ERROR] Missing required arguments."
    echo "Usage: $0 <BRANCH> <PM2_NAME>"
    exit 1
fi

# Determine target port based on PM2_NAME
if [[ "$PM2_NAME" == "zorah-staging" ]]; then
    PORT=4001
else
    PORT=4000
fi

# Record current git commit before deployment for rollback targeting
PREV_COMMIT=$(git rev-parse HEAD)
echo "----------------------------------------------------------------------"
echo "🚀 Starting Deployment for PM2 Process: $PM2_NAME ($BRANCH)"
echo "📌 Previous Commit: $PREV_COMMIT"
echo "🔌 Target Port:     $PORT"
echo "----------------------------------------------------------------------"

# Define Rollback Function
rollback() {
    echo ""
    echo "🚨 [DEPLOYMENT FAILURE DETECTED] Triggering automated PM2 rollback..."
    echo "⏪ Reverting repository to commit: $PREV_COMMIT"
    git checkout "$PREV_COMMIT" || true
    echo "📦 Restoring previous node_modules dependencies..."
    npm install --omit=dev || true
    echo "🔄 Reloading PM2 process $PM2_NAME with previous release..."
    pm2 reload "$PM2_NAME" --update-env || true
    echo "❌ Rollback execution complete. Exiting with failure status."
    exit 1
}

# Trap ERR signals to automatically trigger rollback function on any command failure
trap rollback ERR

echo "📥 Fetching latest code updates for branch $BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "📦 Installing production dependencies..."
npm install --omit=dev

echo "🔄 Performing zero-downtime PM2 process reload for $PM2_NAME..."
pm2 reload "$PM2_NAME" --update-env
pm2 save

echo "🏥 Performing post-deployment health check loop against http://127.0.0.1:$PORT/health..."
MAX_ATTEMPTS=5
SUCCESS=0

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    echo "   Attempt $i/$MAX_ATTEMPTS: Polling http://127.0.0.1:$PORT/health..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" || true)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        SUCCESS=1
        break
    fi
    
    sleep 2
done

if [[ "$SUCCESS" -eq 1 ]]; then
    # Disable error trap upon verified success
    trap - ERR
    NEW_COMMIT=$(git rev-parse HEAD)
    echo "----------------------------------------------------------------------"
    echo "✅ [SUCCESS] Deployment of $PM2_NAME completed successfully!"
    echo "📌 Active Commit: $NEW_COMMIT"
    echo "----------------------------------------------------------------------"
    pm2 status "$PM2_NAME" || true
    exit 0
else
    echo "❌ [ERROR] Health check failed after $MAX_ATTEMPTS attempts (Last HTTP status: ${HTTP_CODE:-N/A})."
    rollback
fi
