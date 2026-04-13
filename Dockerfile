# Stage 1: Build React frontend
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files (explicitly, no .env files from host)
COPY src ./src
COPY public ./public
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
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for React Router
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 80

# Use entrypoint to inject BACKEND_URL at runtime
ENTRYPOINT ["/entrypoint.sh"]
