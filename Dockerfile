FROM node:23.7-bookworm-slim AS base

# All deps stage
FROM base AS deps

WORKDIR /app
ADD package.json package-lock.json ./
RUN npm ci

# Production only deps stage
FROM base AS production-deps
WORKDIR /app
ADD package.json package-lock.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
ADD . .
RUN node ace build

# Production stage
FROM base
ENV NODE_ENV=production
WORKDIR /app
# Install fonts
COPY ./public/static/fonts ./
RUN mkdir -p /usr/share/fonts/truetype
RUN install -m644 ./*.ttf /usr/share/fonts/truetype/
RUN rm ./*.ttf
# Proceed to the deps
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app
EXPOSE 3340
CMD ["node", "./bin/server.js"]