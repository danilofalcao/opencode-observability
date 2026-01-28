#!/bin/bash

set -e

echo "🚀 Starting OpenCode Observability System..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if ! command -v bun &> /dev/null; then
    echo "❌ Bun is required but not installed. Install from https://bun.sh"
    exit 1
fi

mkdir -p apps/server/data

echo "📦 Installing dependencies..."
(cd apps/server && bun install)
(cd apps/client && bun install)

echo "🖥️  Starting server on port 4000..."
cd apps/server && bun run dev &
SERVER_PID=$!

echo "🎨 Starting client on port 5173..."
cd apps/client && bun run dev &
CLIENT_PID=$!

echo ""
echo "✅ System started!"
echo "   📊 Dashboard: http://localhost:5173"
echo "   🔌 WebSocket: ws://localhost:4000/stream"
echo "   📝 API: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop"

trap "echo ''; echo '👋 Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT

wait