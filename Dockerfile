FROM node:22-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN npm install

# Copy .env files
COPY .env* ./

# Copy all source files
COPY . .

# Build the application
RUN npm run build

# Install serve to run the built app
RUN npm install -g serve

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080 || exit 1

# Start the server
CMD ["serve", "-s", "dist", "-l", "8080"]
