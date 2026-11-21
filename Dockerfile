# NagarLens in one container (used by the Hugging Face Space; see deploy/README.md).
# The web app listens on 7860 and proxies /api/* to the FastAPI process on 127.0.0.1:8000.
# No API key is needed: without one, the AI panels use cached answers and deterministic templates.

# ---- 1. build the web app
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL="" \
    API_PROXY_TARGET="http://127.0.0.1:8000"
RUN npm run build

# ---- 2. runtime: Python for the API, Node for `next start`
FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONIOENCODING=utf-8 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    API_PROXY_TARGET="http://127.0.0.1:8000"
COPY --from=web /usr/local/bin/node /usr/local/bin/node
RUN pip install --no-cache-dir pandas numpy fastapi "uvicorn[standard]" sqlmodel pydantic python-dotenv anthropic \
    && useradd -m -u 1000 user

WORKDIR /app
COPY --chown=user:user src/ ./src/
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user data/ ./data/
COPY --chown=user:user deploy/start.sh ./deploy/start.sh
COPY --chown=user:user --from=web /web/ ./frontend/
RUN sed -i 's/\r$//' deploy/start.sh && chmod +x deploy/start.sh && chown user:user /app

# Hugging Face Spaces run the container as uid 1000. backend/ and data/cache/ must be writable
# (SQLite file for officer decisions, cached AI answers), which the chown above provides.
USER user
EXPOSE 7860
CMD ["./deploy/start.sh"]
