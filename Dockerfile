FROM node:lts-alpine as build-stage
WORKDIR /temp
COPY package.json .
RUN yarn --registry https://registry.npmmirror.com/  
COPY . .
RUN yarn  build

FROM node:lts-alpine as production-stage
WORKDIR /app
COPY --from=build-stage /temp/next.config.mjs ./next.config.mjs
COPY --from=build-stage /temp/public ./public
COPY --from=build-stage /temp/.next/standalone  ./standalone
COPY --from=build-stage /temp/package.json ./package.json
COPY --from=build-stage /temp/.next/static ./.next/static
CMD [ "node", "./standalone/server" ]
