#!/bin/bash

###############################################################################
# Slide Forge - Installation Wrapper Script
# Delegates to frontend/install.sh
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Slide Forge installation..."
echo "📁 Running installation from frontend directory..."
echo ""

cd "$PROJECT_ROOT/frontend" && ./install.sh
