# Use official Bun image
FROM oven/bun:1-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN bun install

# Copy server source code
COPY apps/server ./apps/server

# Create data directory for SQLite
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/events.db

# Expose the server port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the server
WORKDIR /app/apps/server
CMD ["bun", "run", "start"]
