#!/bin/bash

echo "Everything Bot Admin - Development Mode"
echo "======================================"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the backend server
echo "Starting backend server..."
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start Vite dev server
echo "Starting Vite dev server..."
npm run dev

# Kill backend when script exits
trap "kill $SERVER_PID" EXIT