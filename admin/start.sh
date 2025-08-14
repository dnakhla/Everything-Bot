#!/bin/bash

echo "Everything Bot Admin Server"
echo "=========================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set environment variables if not set
export S3_BUCKET_NAME=${S3_BUCKET_NAME:-"telegram-bots-2025"}
export LAMBDA_FUNCTION_NAME=${LAMBDA_FUNCTION_NAME:-"FactCheckerBot-LambdaFunction"}

echo "Configuration:"
echo "S3 Bucket: $S3_BUCKET_NAME"
echo "Lambda Function: $LAMBDA_FUNCTION_NAME"
echo ""

echo "Starting admin server on http://localhost:3002"
echo "Make sure your AWS credentials are configured!"
echo ""

# Kill any existing server processes
echo "Stopping any existing servers..."
pkill -f "node server.js" 2>/dev/null || true
sleep 1

# Start server and open browser
echo "Starting new server..."
node server-manager.js