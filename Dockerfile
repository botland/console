FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Appliances host the console under /console (OpenWebUI owns /). Override for demos.
ARG CONSOLE_BASE_PATH=/console
ENV CONSOLE_BASE_PATH=${CONSOLE_BASE_PATH}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Git SHA or tag of the build (compose build-arg APP_VERSION / APPLIANCE_CONSOLE_VERSION).
ARG APP_VERSION=dev
ENV APPLIANCE_CONSOLE_VERSION=${APP_VERSION}
ARG CONSOLE_BASE_PATH=/console
ENV CONSOLE_BASE_PATH=${CONSOLE_BASE_PATH}
ENV NEXT_PUBLIC_BASE_PATH=${CONSOLE_BASE_PATH}

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]