# Static FairNest web app on nginx. The vault API is proxied to the live Worker (it needs Cloudflare KV).
#   docker run --rm -p 8080:80 ghcr.io/lsudoko/fairnest-web   ->  http://localhost:8080
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
LABEL org.opencontainers.image.source="https://github.com/LSUDOKO/FairNest" \
      org.opencontainers.image.description="FairNest web app (NEAR testnet rent-deposit escrow)" \
      org.opencontainers.image.licenses="MIT"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
