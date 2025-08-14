#!/bin/bash

echo "Building Svelte App..."
echo "====================="

# Install dependencies
npm install

# Build the Svelte app
npm run build

# Set production mode and start server
echo "Starting production server..."
NODE_ENV=production node server.js