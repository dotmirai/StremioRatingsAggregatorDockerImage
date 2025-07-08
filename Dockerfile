# --- frontend builder ---
    FROM node:18-alpine AS frontend-builder

    ARG VITE_HOME_BLURB
    WORKDIR /app
    
    COPY frontend/package.json frontend/package-lock.json ./frontend/
    RUN cd frontend && npm ci
    
    COPY frontend ./frontend
    
    # Inject VITE_HOME_BLURB into Vite
    RUN printf "VITE_HOME_BLURB=%s\n" "${VITE_HOME_BLURB}" > frontend/.env.production \
    && echo "--- frontend/.env.production contents ---" \
    && cat frontend/.env.production
    
    RUN cd frontend && npm run build
    
    # --- backend builder ---
    FROM node:18-alpine AS backend-builder
    WORKDIR /app
    
    COPY package.json package-lock.json ./
    RUN npm ci --production
    
    # --- final image ---
    FROM node:18-alpine
    WORKDIR /app
    
    RUN apk add --no-cache curl
    
    COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
    COPY --from=backend-builder /app/node_modules ./node_modules
    
    COPY package.json .
    COPY src ./src
    COPY api ./api
    
    HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:$PORT/ || exit 1
    
    ENV NODE_ENV=production
    ENV PORT=61262
    EXPOSE 61262
    
    CMD ["npm", "start"]
    