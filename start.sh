#!/bin/bash

###############################################################################
# Slide Forge - Start Wrapper Script
# Delegates to frontend/start.sh
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Slide Forge..."
echo "📁 Running from frontend directory..."
echo ""

cd "$SCRIPT_DIR/frontend" && ./start.sh
