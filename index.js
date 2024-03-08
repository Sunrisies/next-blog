const { exec } = require('child_process');  
const path = require('path');  
  
// 获取当前 JavaScript 文件所在的目录  
const currentDir = __dirname;  
  
// 构建 index.bat 的完整路径  
const batFilePath = path.join(currentDir, 'index.bat');  
  
// 执行 index.bat  
exec(batFilePath, (error, stdout, stderr) => {  
  if (error) {  
    console.error(`执行错误: ${error}`);  
    return;  
  }  
  
  console.log(`stdout: ${stdout}`);  
  console.error(`stderr: ${stderr}`);  
});