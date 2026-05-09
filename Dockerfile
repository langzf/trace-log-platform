FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY db ./db
COPY README.md ./
COPY .env.example ./

RUN chmod +x scripts/openclaw/install_openclaw.sh || true

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm start"]
