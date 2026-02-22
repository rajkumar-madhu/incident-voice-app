FROM python:3.10-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.10-slim AS production
WORKDIR /app
RUN groupadd -g 1001 appuser && useradd -r -u 1001 -g appuser appuser
COPY --from=builder /install /usr/local
COPY . .
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1
ENV PYTHONUNBUFFERED=1
ENV PORT=8002
CMD ["python", "main.py"]
