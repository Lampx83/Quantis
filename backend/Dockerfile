# Quantis Backend (Node) — API lưu data, proxy Archive/Ollama/Analysis
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./

RUN mkdir -p /app/data

EXPOSE 4001

ENV NODE_ENV=production
ENV PORT=4001

CMD ["node", "server.js"]
