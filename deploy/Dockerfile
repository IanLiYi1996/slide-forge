# =============================================================================
# Slide Forge AgentCore Dockerfile
# =============================================================================
# ARM64 container image for Bedrock AgentCore runtime
# Includes: Node.js, Python, uv, Claude Code CLI
# =============================================================================

# Use Node.js Trixie as base image (Debian-based with Node.js pre-installed)
FROM node:trixie-slim

# Add uv to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Install system dependencies and tools
RUN apt update && \
    apt install -y \
        curl \
        git \
        git-lfs \
        wget \
        vim \
        jq \
        unzip && \
    # Install Claude Code CLI globally
    npm install -g @anthropic-ai/claude-code && \
    # Install uv (Python package manager)
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    # Configure bash for virtual environment
    echo "export VIRTUAL_ENV_DISABLE_PROMPT=1" >> /root/.bashrc && \
    echo "[ -f /app/backend/.venv/bin/activate ] && source /app/backend/.venv/bin/activate" >> /root/.bashrc && \
    # Create workspace directory for agent sessions
    mkdir -p /workspace && \
    # Clean up apt cache
    rm -rf /var/lib/apt/lists/*

# Copy backend application code (pyproject.toml is in backend/)
COPY backend/ /app/backend/

# Copy project-level skills (installed to ~/.claude/skills/ at startup)
COPY .claude/skills/ /app/skills/

# Copy serve script
COPY deploy/serve /app/serve
RUN chmod +x /app/serve

# Set working directory to backend where pyproject.toml lives
WORKDIR /app/backend

# Install Python dependencies using uv
# Note: pyproject.toml is in backend/, so we run uv sync there
RUN uv sync --frozen || uv sync

# Set working directory back to /app for runtime
WORKDIR /app

# Expose port 8080 (AgentCore standard port)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the server on port 8080
CMD ["/app/serve"]
