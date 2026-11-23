FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

WORKDIR /app

# 依存関係のインストール（キャッシュ効率のためpackage.jsonを先にコピー）
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --ignore-scripts && \
  pnpm exec prisma generate || true && \
  node node_modules/esbuild/install.js || true && \
  node node_modules/@prisma/engines/scripts/postinstall.js 2>/dev/null || true

# ソースは volume mount するので COPY 不要（dev用）
# prisma schema は generate に必要なので先にコピー
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./

RUN pnpm exec prisma generate

EXPOSE 5050

# コンテナ起動時にマイグレーション適用・シード投入まで自動で行う
# （docker compose up だけでセットアップが完了するように）
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && (pnpm db:seed || echo 'seed failed, continuing without seed data') && pnpm dev"]
