# Dockerfile — AgileWriter Health Check Test Runner
# Base: Official Microsoft Playwright image with Chromium and all Linux deps
# Node version: bundled with playwright:v1.58.2-noble (Node 20 LTS)
# Do NOT upgrade Node inside this image — the base image is pre-configured
FROM mcr.microsoft.com/playwright:v1.58.2-noble
# Set working directory
WORKDIR /app
# Copy dependency files first (layer caching — npm install only re-runs on change)
COPY package*.json ./
# Install production dependencies only
# --ignore-scripts prevents any postinstall from running browser downloads
# (browsers are already installed in the base image)
RUN npm ci
# Copy the rest of the codebase
# .dockerignore will exclude .env, sessions/, reports/, node_modules/
COPY . .
# Expose the server port
EXPOSE 3000
# Start the Express server directly
# Using node directly (not npm run) for clean signal handling
CMD ["node", "server/test-runner-server.js"]
