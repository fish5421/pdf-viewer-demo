#!/bin/bash
# PDF Viewer Demo - Development Environment Setup
# This script is used by the agent harness to start fresh sessions

set -e

echo "🚀 PDF Viewer Demo - Starting Development Environment"
echo "=================================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Kill any existing dev server on port 5173
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚠️  Killing existing process on port 5173..."
    kill $(lsof -ti:5173) 2>/dev/null || true
    sleep 1
fi

# Start the development server
echo "🌐 Starting Vite dev server..."
npm run dev &
DEV_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
sleep 3

# Check if server is running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo ""
    echo "✅ Dev server is running!"
    echo "📍 URL: http://localhost:5173"
    echo "🔧 PID: $DEV_PID"
    echo ""
    echo "To stop the server: kill $DEV_PID"
else
    echo "❌ Server may not have started correctly. Check for errors above."
fi
