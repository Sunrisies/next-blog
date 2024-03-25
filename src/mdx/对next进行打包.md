---
theme: keepnice
---

```js
对使用docker打包好的镜像，进行服务器发布，发现如果上传到docker仓库，因为我这边使用的是国外源，
发布一次比较慢还容易失败，就直接使用了docker 提供的 `save` 方法进行保存，保存成一个.tar的包，
等把文件上传到服务器上面使用 `docker laod -i 包名.tar` 的方式加载成镜像，
然后通过docker命令去启动服务
```

使用:`docker save -o <your_image_name>.tar <your_image_name>:<tag> `

使用：`scp`进行上传

在使用:`docker load -i <your_image_name>.tar`

在使用:`docker run -d --restart=always --name next -p 9000:3000 镜像`
配置nginx:

![image.png](https://p.ipic.vip/0cnsnv.png)

这个时候就可以直接访问ip，ip默认是80

`上面只是一个简单的demo，后续进行打包发布的时候可能会存在样式丢失的问题，这个时候就可以使用cdn来进行`
