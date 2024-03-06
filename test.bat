@echo off  
setlocal  
  
:: 设置变量  
set "source_file=C:\Users\hover\Desktop\jobs\hover\src"  
set "destination_user=root"  
set "destination_host=47.111.168.59"  
set "destination_path=/home/www/next/"  
  
:: 使用SCP命令上传文件，并使用call确保正确检测退出状态  
call scp -r "%source_file%" "%destination_user%@%destination_host%:%destination_path%"  
  
:: 检查SCP命令的退出状态  
if %errorlevel% neq 0 (  
    echo File upload failed.  
) else (  
    :: 输出上传完成信息  
    echo File uploaded successfully.  
)  
  
:: 暂停脚本执行，等待用户输入  
pause  
  
endlocal