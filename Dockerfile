# Build frontend
FROM node:18 AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY . .
RUN cd frontend && npm run build

# Build backend
FROM node:18 AS backend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

# Final image
FROM node:18-slim
WORKDIR /app

# Copy built files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY . .

# Environment setup
ENV NODE_ENV=production
ENV PORT=61262
EXPOSE 61262

CMD ["npm", "start"]