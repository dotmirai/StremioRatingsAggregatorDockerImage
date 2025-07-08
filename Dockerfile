# Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build

# Build backend
FROM node:18-alpine AS backend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

# Final image
FROM node:18-alpine
WORKDIR /app

# Install dependencies
RUN apk add --no-cache curl

# Copy built files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package.json .
COPY src ./src
COPY api ./api

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:$PORT/ || exit 1

# Environment setup
ENV NODE_ENV=production
ENV PORT=61262
EXPOSE 61262

CMD ["npm", "start"]