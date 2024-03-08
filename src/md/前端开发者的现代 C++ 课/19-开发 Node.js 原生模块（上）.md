虽然 Node.js 为开发者封装了大量的操作系统 API，比如文件操作、网络访问、加密解密等，但对于五花八门的应用程序需求来说，这些 API 还稍显不足，比如为 Windows 操作系统注册一个系统服务这样的需求现有的 Node API 就无法满足。另外，JavaScript 毕竟是运行在虚拟机里的脚本语言，不适合完成一些对性能要求极高的任务，这也是 esbuild 之类的工具不使用 JavaScript 开发的原因。而且 C/C++ 发展了这么多年，有很多基础设施都是使用 C/C++ 开发的，比如 FFmpeg 、SQLite 等，要想在 Node.js 应用中**深度**使用这些基础设施，还是得有 C/C++ 的助力才行。

基于以上这些原因，**Node.js 允许开发者使用 C/C++ 开发原生模块，以拓展 Node.js 应用的能力范围**。本节我们就介绍如何开发 Node.js 的原生模块。

开发方式
----

以前开发者开发 Node.js 原生模块只能直接使用 V8 、Node.js 、libuv 等库暴露出来的接口，这给开发者带来了很多麻烦，开发者不但要处理好各种模块之间的依赖关系，还要应对各模块在 Node.js 演进过程中剧烈的变化导致 API 不一致的问题。

后来 Node.js 团队推出了 [NAN 框架（Native Abstractions for Node.js）](https://github.com/nodejs/nan "https://github.com/nodejs/nan")，这个框架通过一系列的宏来保证原生模块的源码可以在不同版本 Node.js 环境下成功编译，这些宏会判断当前 Node.js 的版本号，并展开成适应此版本的 C++ 源码。这个技术方案只起到了帮助开发者用同一套代码生成不同版本的原生模块的作用，也就是说代码需要在不同版本的 Node.js 下重新编译，如果版本不匹配的话，Node.js 无法正常载入这个原生模块。

现如今 Node.js 团队推出了 [Node-API 规范](https://nodejs.org/dist/latest/docs/api/n-api.html#node-api "https://nodejs.org/dist/latest/docs/api/n-api.html#node-api")，Node-API 专门用于构建原生模块，它独立于底层 JavaScript 运行时，并作为 Node.js 的一部分进行维护。它是跨 Node.js 版本的应用程序二进制接口（Application Binary Interface，ABI）。它旨在将原生模块与底层实现隔离开，并允许为某个 Node.js 版本编译的模块在更高版本的 Node.js 上运行而无需重新编译。也就是说不同版本的 Node.js 使用同样的接口为原生模块提供服务，这些接口是 ABI 化的，只要 ABI 的版本号一致，编译好的原生模块就可以直接使用，而不需要重新编译。

如果你想了解某个 Node.js 的 ABI 的版本号，那么你可以到如下地址了解信息：[nodejs.org/en/download…](https://nodejs.org/en/download/releases/ "https://nodejs.org/en/download/releases/")，如下图所示（NODE\_MODULE\_VERSION 列就是 ABI 的版本号）：

![NodeABI.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b91f958c97be49d39d0dc60b16afaff7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1524&h=417&s=55522&e=png&b=f7f7f7)

不过 Node-API 暴露出来的是 C 语言接口，开发起来比较麻烦（ C++ 相对于 C 来说语言特性丰富，标准库强大），推荐大家使用 [node-addon-api](https://github.com/nodejs/node-addon-api "https://github.com/nodejs/node-addon-api") 来开发原生模块。node-addon-api 是对 Node-API 的 C++ 再包装，允许开发者使用 C++ 开发原生模块，这个项目也是 Node.js 官方团队开发的，维护及时且质量有保证。

> 由于 node-addon-api 是一个独立的项目，并不像 Node-API 一样是 Node.js 的一部分，所以每当 Node-API 升级后，你的项目依赖的 node-addon-api 也要跟着升级才能使用 node-addon-api 包装的新特性。不过如果你不介意的话，你可以在你的项目中使用 C 风格的代码直接访问 Node-API 提供的新接口，node-addon-api 在这方面也有提供支持。

搭建环境
----

无论开发者使用什么开发方式开发 Node.js 的原生模块，都需要用到 [node-gyp](https://github.com/nodejs/node-gyp "https://github.com/nodejs/node-gyp") 编译工具，这个工具是构建 Node.js 原生模块开发、编译环境的跨平台命令行工具，它的底层内置了 Chromium 团队开发的 gyp-next 工具。不管开发者系统内安装了什么版本的 Node.js 环境，node-gyp 都可以有针对性地为指定版本的 Node.js 构建开发、编译环境（它会为开发者下载指定 Node.js 版本的库文件和头文件）。

node-gyp 是一个 npm 模块，你可以通过如下指令全局安装该模块：

    npm install -g node-gyp
    

node-gyp 还依赖一些系统工具，比如 Python、Visual Studio Build Tools 等，不同的系统略有差异，你可以到 node-gyp 项目主页自行查阅。

接着新建一个 Node.js 项目，然后通过如下指令为这个项目安装 node-addon-api 模块：

    npm install node-addon-api
    

接在在项目根目录下创建原生模块的配置文件：binding.gyp，代码如下：

    {
      "targets": [
        {
            "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
            "target_name": "native",
            "defines": [ 'NAPI_DISABLE_CPP_EXCEPTIONS',"NODE_ADDON_API_ENABLE_MAYBE" ],
            "sources": [ "src/main.cc" ],
        }
      ]
    }
    

配置文件中可使用的配置项非常多，你可以参考[官网文档](https://gyp.gsrc.io/docs/UserDocumentation.md "https://gyp.gsrc.io/docs/UserDocumentation.md")了解不同配置项的具体含义，这里我们只介绍用到的几个配置项。

*   `targets` 表示构建目标，node-gyp 允许为多个目标构建原生模块，但一般只有一个。
    
*   `include_dirs` 用于指定 C++ 项目的包含目录，这项配置的值是在执行构建工作时动态指定的。
    
*   `target_name` 是构建目标的名称，此名称在 Windows 下将用作生成的 Visual Studio 解决方案中的项目名称，在 MacOS 下用作生成的 XCode 配置中的目标名称。
    
*   `defines` 用于为构建的工程添加预处理器。我们知道 Node API 是使用 C 语言封装的，C 语言的异常处理机制与 C++ 的异常处理机制截然不同，这里 `NAPI_DISABLE_CPP_EXCEPTIONS` 预处理器的定义会禁用 node-addon-api 对 Node API 的异常包装，`NODE_ADDON_API_ENABLE_MAYBE` 预处理器的定义会开启 node-addon-api 安全 API 类型保护，以确保正确的异常处理模式。
    
*   `sources` 用于指定构建好的工程内包含的代码文件，这里我们设置为相对路径 src/main.cc，同时增加对应的文件，并为此文件撰写代码如下：
    

    #include <napi.h>
    Napi::String Hello(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        return Napi::String::New(env, "world"); //返回一个js字符串
    }
    Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        //公开hello方法
        exports.Set(Napi::String::New(env, "hello"), Napi::Function::New(env, Hello));
        return exports;
    }
    NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
    

简单介绍一下这段代码的含义，这段代码为构建的原生模块公开了一个名为 hello 的方法，该方法返回一个字符串："world"，后文我们还会详细介绍这段代码，目前大家了解这些就足够了。

接下来我们在项目根目录下执行如下指令以构建项目：

    node-gyp configure
    

命令执行完成之后控制台输出如下内容 ：

![node-gyp-config.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f30b6360b8324beeaf3a528a23ddb1da~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2478&h=1611&s=421101&e=png&b=ffffff)

其中 ① 区域显示 node-gyp 工具在为我们确定 Node 版本、当前环境中 python 的版本等信息。

② 区域显示 node-gyp 工具在为我们下载 Node.js 的头文件和依赖库（与你本地环境的 Node.js 版本一致）。

④ 区域显示 node-gyp 在为我们生成 Visual Studio 解决方案（它会根据你系统中已安装的 Visual Studio 来生成解决方案）。

最后 ③ 处显示 gyp inof ok 表示工程成功构建完成。

如果你是在 Windows 操作系统下构建项目，那么项目构建成功后，会生成 `\build\binding.sln` 解决方案；使用 Visual Studio 打开解决方案，你会看到我们的 src\\main.cc 已经被包含在 native 工程中了；查看 native 工程的属性，你会发现附加包含目录、附加依赖项以及预处理器都已经配置好了。

编译工程后会在 `\build\Debug`（Debug 模式编译工程） 或 `\build\Release`（Release 模式编译工程） 目录下生成 `native.node` 文件，这就是我们想要的 Node.js 原生模块。

除了使用 Visual Studio 编译原生模块外，你还可以使用 node-gyp 工具在命令行下编译原生模块，相关的指令如下所示：

    node-gyp build --debug //debug模式编译指令
    node-gyp build //release模式编译指令
    

实际上 node-gyp 也是通过命令行驱动 Visual Studio 完成编译工作的。

使用原生模块
------

现在我们编写一个测试程序 `\test\index.js`，代码如下：

    let obj = require("../build/Debug/native.node");
    console.log("hello", obj.hello()); //输出：hello world
    

如你所见，Node.js 提供的 require 方法可以直接加载原生模块，与加载一个普通的 JavaScript 脚本文件没什么两样，获得原生模块的导出对象之后，我们调用了这个对象的 hello 方法，程序最终输出：`hello world`，与我们的预期一致。

上面示例代码中我们加载的是 Debug 模式下编译的原生模块，你可以自己试试 Release 模式下编译的原生模块，看看输出结果是否一致。

调试原生模块
------

很多人都使用 GDB 工具调试 Node.js 原生模块，但 GDB 操作起来不是很方便，我推荐大家直接使用 Visual Studio 调试原生模块。

很显然我们要用 Visual Studio `附加到进程` 的方法来调试原生模块了。不过对于前面的示例来说，程序瞬间就执行完了，根本不会留给我们附加进程的机会，此时我们可以修改一下测试代码，让程序加载原生模块前暂停，以等待我们完成附加进程的操作，代码如下：

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    readline.question(`Press Enter to start debug`, (name) => {
      let obj = require("../build/Debug/native.node");
      console.log("hello", obj.hello());
      readline.close();
    });
    

这段代码中我们使用 Node.js 的内置模块 `readline` ，用于接收用户从命令行输入的内容。此时运行测试程序，命令行打印 Press Enter to start debug 之后，测试程序会等待用户输入。在向命令行输入内容之前我们先用 Visual Studio 附加此进程，如下图所示：

![debugNativeModule.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e447538b93654fd6a4c99d10e8a47a26~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2208&h=1013&s=159976&e=png&b=f8f8f8)

此工作完成之后，再向命令行按下 Enter 键，此时测试程序才会加载我们的原生模块，并调用原生模块内的 hello 方法，如果你在 hello 方法内添加了断点，那么此时 C++ 代码将在断点处中断，如下图所示：

![debugNativeModule2.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cf9e3697e614849876ff27731d951f1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1077&h=728&s=116333&e=png&b=fffefe)

> 除了这种调试方式之外，你还可以使用 `--inspect-brk` 命令行参数启动测试程序，让测试程序开始运行即中断，为附加进程留下充足的时间。

总结
--

本节我们首先介绍了 Node.js 原生模块的发展历程，以及开发 Node.js 原生模块的几种方式，最终我们选择了使用 Node.js 官方团队推出的 node-addon-api 来开发原生模块。node-addon-api 项目是对 Node.js ABI（C 接口）的 C++ 包装，为 C++ 开发者开发原生模块提供了便利。

接着我们讲解了如何搭建 Node.js 原生模块的 C++ 开发环境，期间我们使用了 node-gyp 工具来构建开发环境，最终编译了一个简单的原生模块。

最后我们分析了如何在 JavaScript 代码中使用 Node.js 原生模块（JavaScript 代码可以直接在 Node.js 环境下 require 原生模块）以及如何使用 Visual Studio 调试原生模块，调试原生模块的方法我们使用的是大家熟悉的 Visual Studio 附加到进程的调试方法。

下一节我们将深入介绍 Node.js 原生模块的开发技巧。