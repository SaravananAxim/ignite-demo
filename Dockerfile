# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies using clean install
RUN npm ci

# Copy all source files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the built application
FROM node:22-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080 || exit 1

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080"]
