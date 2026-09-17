# Stage 1: Build React frontend
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with retries to prevent GitHub Actions ECONNRESET
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm ci

# Copy source files (explicitly, no .env files from host)
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY index.html ./
COPY tsconfig.* ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY eslint.config.js ./

# Build args for runtime configuration (injected by Coolify)
ARG VITE_API_URL=/api
ARG VITE_STORAGE_URL=/storage
ARG VITE_SENTRY_DSN=

# Write .env.production from build args
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env.production && \
    echo "VITE_STORAGE_URL=${VITE_STORAGE_URL}" >> .env.production && \
    echo "VITE_SENTRY_DSN=${VITE_SENTRY_DSN}" >> .env.production

# Build the app (Vite production build)
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built assets from Stage 1 to staging directory and docroot
COPY --from=build /app/dist /app/dist
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for React Router
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf

# Copy entrypoint script
COPY nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Healthcheck to verify Nginx and version endpoint are responding
HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=5s \
  CMD curl -f http://localhost/version.json || exit 1

# Expose port
EXPOSE 80

# Use entrypoint to sync assets and launch Nginx
ENTRYPOINT ["/entrypoint.sh"]
