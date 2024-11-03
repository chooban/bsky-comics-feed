FROM node:20.18.0-alpine AS base
WORKDIR /usr/src/app
RUN apk update && apk upgrade --no-cache
COPY package.json yarn.lock ./

FROM base AS build-base
RUN apk add --no-cache sqlite python3 make build-base
COPY . .

FROM build-base AS deploy-base
RUN yarn install --frozen-lockfile --production=true

FROM deploy-base AS build
RUN yarn install --frozen-lockfile --production=false
RUN yarn build

FROM base AS deploy
COPY --from=deploy-base /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000

# Specify the command to run the application
CMD ["node", "dist/index.js"]
