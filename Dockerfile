FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/hospital?schema=public
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma client is generated to app/generated/prisma (custom output in schema.prisma)
RUN pnpm prisma generate
RUN pnpm build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
