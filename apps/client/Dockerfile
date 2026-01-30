# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/client/package.json ./apps/client/
RUN bun install

COPY apps/client ./apps/client
COPY apps/server ./apps/server

WORKDIR /app/apps/client
ARG VITE_API_URL=http://localhost:4000
ARG VITE_WS_URL=ws://localhost:4000/stream
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN bun run build

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=builder /app/apps/client/dist ./dist

EXPOSE 5173

CMD ["bunx", "serve", "dist", "-l", "5173"]
