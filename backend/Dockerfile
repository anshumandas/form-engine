FROM python:3.12-slim

WORKDIR /app

# curl is used by the compose healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The backend is a Python package and uses package-relative imports
# (e.g. `from .routers...`, `from ..models...`). It must therefore be run as
# `backend.main:app`, NOT `main:app`. Copy the package contents under /app/backend.
COPY . /app/backend

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
