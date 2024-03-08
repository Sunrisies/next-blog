@echo off 
@REM scp ./next2.tar root@47.111.168.59:/home/www/next
scp ./deploy.sh root@47.111.168.59:/home/www/next
ssh root@47.111.168.59 'bash /home/www/next/deploy.sh'

@REM ssh root@47.111.168.59 
@REM cd /home/www/next
@REM @REM rm -rf next2.tar 
@REM docker rmi next:1
@REM echo 'delete images'
@REM docker load -i next2.tar
@REM echo 'load images'
@REM docker stop next
@REM echo 'stop images'
@REM docker rm next
@REM echo 'rm images'
@REM docker run -d --restart=always --name next2 -p 9000:3000 next:1
@REM echo 'start images'
echo '成功'
pause