FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY analog_core analog_core
COPY app app
COPY targets.json .
ENV PATH="/srv/.venv/bin:$PATH" CACHE_DIR=/tmp/cache
# 1 worker, gdal reads release the gil and a 2nd worker doubles memory
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
