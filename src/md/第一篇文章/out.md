### 第一阶段使用docker直接对文件进行打包
Dockerfile
```Dockerfile
FROM node:18.17.0
WORKDIR /temp
COPY package.json .
RUN yarn --registry https://registry.npmmirror.com/  
COPY . .
RUN yarn build

FROM node:18.17.0
WORKDIR /app
COPY next.config.mjs ./next.config.mjs
COPY public ./public
COPY .next ./.next
COPY package.json ./package.json
RUN yarn --production --registry https://registry.npmmirror.com/  
EXPOSE 3000
CMD [ "npm", "start" ]
```
使用命令：`docker build -t next-server:v1 .`

查看打包完成的镜像大小: `docker images`

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/11c88314ea464337baa2b2dc16147111~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=686&h=47&s=7802&e=png&b=282a36)

### 第二阶段优化了dockerfile，优化了打包大小 (多阶段构建)以及使用alpine这个会安装一个最小的版本

```js
FROM node:lts-alpine as build-stage
WORKDIR /temp
COPY package.json .
RUN yarn --registry https://registry.npmmirror.com/  
COPY . .
RUN yarn build

FROM node:lts-alpine as production-stage
WORKDIR /app
COPY --from=build-stage /temp/next.config.mjs ./next.config.mjs
COPY --from=build-stage /temp/public ./public
COPY --from=build-stage /temp/.next ./.next
COPY --from=build-stage /temp/package.json ./package.json

RUN yarn --production --registry https://registry.npmmirror.com/  
EXPOSE 3000
CMD [ "npm", "start" ] 
```

使用命令：`docker build -t next-server:v1 .`

查看打包完成的镜像大小: `docker images`

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1afcd5fb1fdb4e6f9cb137f1a5572776~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=630&h=47&s=7154&e=png&b=282a36)
### 使用next.config.mjs 进行配置，优化了一下打包大小，配置next.config.mjs
__如果使用output就不能使用`pnpm`__

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;
```

```js
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
CMD [ "node", "./standalone/server" ]
```

使用命令：`docker build -t next-server:v1 .`

查看打包完成的镜像大小: `docker images`

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e284e34ce3d34f47a58c9b0e86e10c99~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=650&h=46&s=8315&e=png&b=282a36)
`由最一开始的包为3G变成近200M`

使用命令跑一下镜像

`docker run -d -p 3300:3000 --name nextServer next-server:v1`

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0057de75df84269baf26d62f4eb36e2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=926&h=292&s=22610&e=png&b=ffffff)

参考资料
- next官网 `https://nextjs.org/docs/app/api-reference/next-config-js/output`
- dcoker官网 `https://docs.docker.com/build/building/packaging/`
