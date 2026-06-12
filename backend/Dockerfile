FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 4000

# Run migrations then start
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
