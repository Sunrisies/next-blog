#!/bin/bash  
  
# 切换到目标目录  
cd /home/www/next || exit  

# 停止并删除旧容器（注意替换成你的容器名称）  
docker stop next || true  
docker rm next || true  
echo 'stop and rm images'  

# 删除旧镜像（注意替换成你的镜像名称和标签）  
docker rmi next:1 || true  
echo 'delete images'  
  
# 加载新镜像  
docker load -i next2.tar || exit  
echo 'load images'  
  

  
# 启动新容器  
docker run -d --restart=always --name next -p 9000:3000 next:1 || exit  
echo 'start images'  
  
# 脚本执行成功  
echo '成功'