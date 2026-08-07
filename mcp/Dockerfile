# Multi-arch (linux/amd64, linux/arm64) Node 22 image.
# Build: docker buildx build --platform linux/amd64,linux/arm64 -t bottlenote-mcp:local .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV TZ=Asia/Seoul

RUN apk add --no-cache tini \
  && addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER app
EXPOSE 3100

# tini for correct signal handling under k8s
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
