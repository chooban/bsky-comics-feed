FROM squishyu/bun-alpine:1.1.34 AS base
WORKDIR /usr/src/app
RUN apk update && apk upgrade --no-cache

FROM node:20.18.0-alpine AS deploy-base
WORKDIR /usr/src/app
RUN apk update && apk upgrade --no-cache


FROM base AS install
RUN apk add --no-cache sqlite python3 make 
RUN mkdir -p /temp/dev
RUN mkdir -p /temp/prod

COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production


FROM install AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . . 
RUN bun run build

FROM deploy-base AS deploy
COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/src/views ./dist/views

EXPOSE 3000

# Specify the command to run the application
CMD ["node", "dist/index.js"]
