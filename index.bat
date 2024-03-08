@echo off  
set "batch_directory=%~dp0"  
set "filename=_next"  
@REM setlocal enabledelayedexpansion  
  
REM 使用docker进行打包
@REM docker build . -t next:1
@REM docker save -o next2.tar next:1
scp ./next2.tar root@47.111.168.59:/home/www/next
ssh root@47.111.168.59 bash /home/www/next/deploy.sh
@REM scp ./deploy.sh root@47.111.168.59:/home/www/next
@REM REM 生成一个 0 到 9999 之间的随机数  
@REM @REM set /a "randomnum=%RANDOM% %% 100"  
@REM @REM set "foldername=new_folder!randomnum!"   
docker run -d --restart=always --name next -p 9000:3000 next:1
set "foldername=qiniu"
REM 检查文件夹是否存在  
if exist "%batch_directory%%foldername%" (  
    REM 如果存在，则删除文件夹  
    rmdir /S /Q "%batch_directory%%foldername%"
    echo errorlevel=%errorlevel%
    if errorlevel == 0 (  
        echo Folder existed and was deleted successfully.  
    ) else (  
        echo Failed to delete the existing folder.  
    )  
)  
  

@REM REM 创建文件夹  
mkdir "%batch_directory%%foldername%"  
if exist "%batch_directory%%foldername%" (  
    echo Folder created successfully: %batch_directory%%foldername%  
) else (  
    echo Failed to create the folder.  
)   

REM 检查qiniu目录是否存在  
if exist "%foldername%" (  
    REM 如果存在，则切换到该目录  
    cd "%foldername%"  
    echo Switched to directory: %foldername%  
) else (  
    echo The directory %foldername% does not exist.  
)  

@REM REM 创建文件夹  
mkdir "%filename%"  
if exist "%filename%" (  
    echo Folder created successfully: %filename%  
    REM 检查qiniu目录是否存在  
    if exist "%filename%" (  
        REM 如果存在，则切换到该目录  
        cd "%filename%"  
        echo Switched to directory: %filename%  
    ) else (  
        echo The directory %filename% does not exist.  
    ) 
) else (  
    echo Failed to create the folder.  
) 


REM 列出正在运行的 Docker 容器  
docker cp next:/app/.next/static .
echo %errorlevel%
if %errorlevel% == 0 (  
    echo Docker containers listed successfully.
    cd ..
    cd ..
    node "upload.js" 
     
) else (  
    echo Failed to list Docker containers.  
)  
  
@REM REM 暂停以便查看输出  
@REM pause
