FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv
WORKDIR /srv
# rasterio's wheel needs libexpat, slim doesnt ship it
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/*
# build context is the repo root, so everything lives under api/
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY api/analog_core analog_core
COPY api/app app
COPY api/targets.json .
ENV PATH="/srv/.venv/bin:$PATH" CACHE_DIR=/tmp/cache
# 1 worker, gdal reads release the gil and a 2nd worker doubles memory
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
