# BugPin Dockerfile
# Multi-stage build for optimized production image

# USE_CN_MIRRORS=true  → 启用国内镜像源（self-hosted runner / 本地 CN 构建加速）
# USE_CN_MIRRORS=false → 走官方源（GitHub-hosted runner / 国际环境，默认）
# 由 .github/workflows/docker-publish.yml 根据 runner 类型自动传入
ARG USE_CN_MIRRORS=false

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM oven/bun:1-alpine AS builder
ARG USE_CN_MIRRORS

# 切换 Alpine apk + npm registry 到国内镜像（仅 USE_CN_MIRRORS=true 时生效）
RUN if [ "$USE_CN_MIRRORS" = "true" ]; then \
      sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories; \
      echo "registry=https://registry.npmmirror.com" > /root/.npmrc; \
    fi

# Pull latest Alpine security patches (libssl3, libcrypto3, musl, zlib, etc.)
RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Install dependencies first (better layer caching)
# Copy package.json files (lockfile is optional)
COPY package.json ./
COPY bun.lock* ./
COPY src/server/package.json ./src/server/
COPY src/admin/package.json ./src/admin/
COPY src/widget/package.json ./src/widget/

# Install dependencies (canvas is optional and may fail on Alpine, which is OK)
RUN bun install; exit 0

# Copy source code
COPY . .

# Stamp version from build arg (set by CI from git tag) into package.json
# so both the admin build and server runtime pick it up automatically
ARG APP_VERSION
RUN if [ -n "$APP_VERSION" ]; then \
    node -e "const fs=require('fs');const p='./package.json';const j=JSON.parse(fs.readFileSync(p));j.version='$APP_VERSION';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"; \
  fi

# Build admin portal and widget
RUN bun run build:admin && bun run build:widget

# Build EE module (compile TypeScript to JavaScript) if submodule is present
# Create stub files for CE-only builds so COPY commands don't fail
RUN if [ -d "ee/src" ]; then cd ee && bun run build.ts; fi && \
    mkdir -p ee/dist && \
    (test -f ee/package.json || echo '{}' > ee/package.json) && \
    (test -f ee/tsconfig.json || echo '{}' > ee/tsconfig.json)

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM oven/bun:1-alpine
ARG USE_CN_MIRRORS

WORKDIR /app

# 切换 Alpine apk + npm registry 到国内镜像（仅 USE_CN_MIRRORS=true 时生效）
RUN if [ "$USE_CN_MIRRORS" = "true" ]; then \
      sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories; \
      echo "registry=https://registry.npmmirror.com" > /root/.npmrc; \
    fi

# Pull latest Alpine security patches (libssl3, libcrypto3, musl, zlib, etc.)
# and install tini for signal handling and wget for health checks.
RUN apk update && apk upgrade --no-cache && apk add --no-cache tini wget

# Copy server package.json and install production dependencies only
# We use the server's package.json directly to avoid workspace issues
COPY src/server/package.json ./src/server/
WORKDIR /app/src/server
RUN bun install --production

# Back to app root
WORKDIR /app

# Copy root package.json from builder (where APP_VERSION arg stamped the version).
# 不能直接 COPY package.json ./ —— 那是 build context 里未 stamp 的原始版本，
# runtime /health endpoint 会永远报 git tag 之前的旧版本号。
COPY --from=builder /app/package.json ./

# Copy server source (Bun runs TypeScript directly)
COPY src/server ./src/server
COPY src/shared ./src/shared

# Copy Enterprise Edition compiled output only (no TypeScript source)
COPY --from=builder /app/ee/dist ./ee/dist
COPY --from=builder /app/ee/package.json ./ee/package.json
COPY --from=builder /app/ee/tsconfig.json ./ee/tsconfig.json

# Copy built frontend assets from builder
COPY --from=builder /app/dist/admin ./dist/admin

# Copy entire widget source directory (includes dist/ and test-widget.html)
COPY --from=builder /app/src/widget ./src/widget

# Copy default branding assets (required for fallback when no custom branding uploaded)
COPY --from=builder /app/src/admin/public/branding ./src/admin/public/branding

# Create data directory and fix permissions for bun user
RUN mkdir -p /data/uploads && chown -R bun:bun /data /app

# Environment configuration
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=7300
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:7300/health || exit 1

# Switch to non-root user
USER bun

# Expose port
EXPOSE 7300

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start server
CMD ["bun", "run", "src/server/index.ts"]
