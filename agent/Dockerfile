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

# LiveKit agents SDK has a built-in HTTP health server.
# Cloud Run needs a PORT to health-check against.
ENV PORT=8080

# Start in production mode ("start" not "dev")
CMD ["python", "agent.py", "start"]
