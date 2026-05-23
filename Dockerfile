FROM node:18-alpine

WORKDIR /app

# Install dependencies (including dev tools needed for build/runtime)
COPY package.json ./
RUN npm install --silent

# Copy project files
COPY . ./

# Build frontend bundle
RUN npm run build:ui || true

ENV NODE_ENV=production
EXPOSE 3000

VOLUME ["/app/data/app"]

CMD ["npm", "start"]
