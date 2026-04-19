FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy prisma schema before install so the postinstall script (prisma generate) can find it
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/hospital?schema=public
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
