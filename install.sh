#!/bin/bash

###############################################################################
# Slide Forge - Installation Wrapper Script
# Delegates to frontend/install.sh
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Slide Forge installation..."
echo "📁 Running installation from frontend directory..."
echo ""

cd "$SCRIPT_DIR/frontend" && ./install.sh
