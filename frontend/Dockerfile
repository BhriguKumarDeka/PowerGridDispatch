FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first for layer caching
COPY package.json ./

# Use npm install (not npm ci) — no lockfile required in CI/Docker
# --legacy-peer-deps handles peer dep conflicts from mixed package versions
# --loglevel=warn keeps output clean but surfaces real errors
RUN npm install --legacy-peer-deps --loglevel=warn

# Copy source after deps are installed
COPY . .

# Build the production bundle
RUN npm run build

# ── Runtime: serve with nginx ──────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
