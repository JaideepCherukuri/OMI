FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent source
COPY agent.py .
COPY shopify_tools.py .
COPY catalog_mcp.py .

# Cloud Run health checks on $PORT (default 8080)
# agent.py reads PORT env and binds LiveKit's HTTP health server to it
ENV PORT=8080

# Start agent in production mode
CMD ["python", "agent.py", "start"]
