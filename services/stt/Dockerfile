# Build stage
FROM python:3.10-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Production stage
FROM python:3.10-slim AS production

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 appuser && \
    useradd -r -u 1001 -g appuser appuser

# Copy installed packages
COPY --from=builder /install /usr/local

# Copy application
COPY . .

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

ENV PYTHONUNBUFFERED=1
ENV PORT=8001

CMD ["python", "main.py"]
