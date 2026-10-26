FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY . .

# Run as the image's built-in unprivileged user (uid 1000) instead of root.
# The app writes nothing to disk (Neon + Upstash are remote, public/ is
# read-only), so no chown is needed: root-owned 644/755 files are readable by
# `node`, and skipping the chown keeps the image size unchanged. Verified on
# the box 2026-10-26 by running the production image with --user 1000:1000.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "server.js"]
