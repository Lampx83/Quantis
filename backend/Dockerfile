# Quantis Backend — mặc định: chế độ JSON + proxy (port 4001).
# PostgreSQL: build image nhiều giai đoạn hoặc chạy `npm run build && npm start` trên host / compose riêng.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY schema ./schema
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY json-server.cjs ./
COPY schema ./schema
RUN mkdir -p /app/data

EXPOSE 4001 4003

ENV NODE_ENV=production
ENV PORT=4001

# Mặc định: json-server (tương thích deploy cũ). Đổi CMD thành ["node","dist/server.js"] + PORT=4003 cho PostgreSQL.
CMD ["node", "json-server.cjs"]
