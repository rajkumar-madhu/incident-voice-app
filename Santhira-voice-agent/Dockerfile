# Santhira Voice Agent - Frontend Dockerfile
# Python/FastAPI + Socket.IO web voice interface

# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM python:3.10-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ==============================================================================
# Stage 2: Production
# ==============================================================================
FROM python:3.10-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash appuser

WORKDIR /app

# Copy installed Python packages
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Remove unnecessary files
RUN rm -rf __pycache__ */__pycache__ */*/__pycache__ .env .env.example .gitignore .claude

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["uvicorn", "webvoice.server:app", "--host", "0.0.0.0", "--port", "5000"]
