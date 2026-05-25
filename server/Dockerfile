FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --registry https://registry.npmjs.org
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package*.json ./
RUN npm ci --omit=dev --registry https://registry.npmjs.org
COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "dist/main"]
