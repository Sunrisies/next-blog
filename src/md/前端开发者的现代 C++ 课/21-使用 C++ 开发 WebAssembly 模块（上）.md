如果说 Node.js 是前端技术向其他领域突破的工具，那么 WebAssembly 就是其他技术向前端领域突破的工具。接下来我就用两节课的篇幅向大家介绍一下如何使用 C++ 开发 WebAssembly 模块。

WebAssembly 技术相对于 Node.js 技术来说受追捧的程度相对逊色一些，不过 WebAssembly 技术发展至今也有差不多十年时间了，相对来说还是比较成熟稳定的，很多商业应用都有使用 WebAssembly 技术，比如著名的区块链平台 EOS 和设计协作工具 Figma 等。

本节课我们会首先介绍 WebAssembly 的发展历程，然后再带领大家搭建 WebAssembly 的编译环境 `Emscripten`，接着使用 C++ 和 Emscripten 开发了一个简单的 WebAssembly 模块，最后讲解如何在浏览器和 Node.js 环境下调试 WebAssembly 模块。

WebAssembly 介绍
--------------

几十年来，浏览器技术一直都是和 Web 技术相互促进的。很早以前，浏览器能力较弱，互联网上的网页大部分都用于呈现信息，即使有交互功能也只是简单的交互功能。后来 Chrome 浏览器异军突起，在性能和稳定性上表现优异，众多富应用（Rich Internet Applications，注重交互，拥有复杂的用户交互界面和数据模型）开始在互联网上流行起来。到这个阶段，人们开始意识到 JavaScript 的不足了。

JavaScript 作为一个单线程解释执行的脚本语言其运行效率并不能满足复杂的互联网应用的需求，2010 年左右，Mozilla 公司的 `Alon Zakai` 开始开发 `Emscripten` 项目，这个项目最初的主旨是把 C/C++ 代码编译为 JavaScript 代码，最终达到在浏览器里运行 C/C++ 代码的目的，不过 JavaScript 代码太灵活了，而且执行效率不佳。Alon Zakai 和另外几个人在 2013 年左右又开发了 asm.js 语言，asm.js 是 JavaScript 的一个严格子集，这样当“聪明的浏览器”识别到 asm.js 之后就可以进行激进的优化以提升性能（JIT/AOT），“不聪明的浏览器”也可以按照 JavaScript 代码的运作方式执行其代码。

虽然 asm.js 的执行效率优于 JavaScript，但仍然满足不了需求，因为 asm.js 依旧是文本格式，仍然需要浏览器的脚本引擎加载、解释、收集性能指标、JIT 优化等一系列的步骤才能运行完成。

2015 年左右，Mozilla 公司开始与谷歌公司合作开发了一种基于字节码的技术以替代 asm.js 技术，这个技术就是 WebAssembly（简称 Wasm），后来 W3C 专门为此技成立了工作组，工作组成员包括谷歌、微软、Mozilla 和苹果公司。Emscripten 随之也成为了编译 WebAssembly 的主要工具。

> 谷歌 Chrome 团队也很早就在考虑把 C/C++ 引入浏览器的技术方案了，他们推出的产品是 [Native Client](https://link.juejin.cn/?target=https%3A%2F%2Fdeveloper.chrome.com%2Fdocs%2Fnative-client%2F "https://link.juejin.cn/?target=https%3A%2F%2Fdeveloper.chrome.com%2Fdocs%2Fnative-client%2F") ，这个产品用于在浏览器内高效安全地运行 C/C++ 原生代码，不过现如今谷歌大力支持 Wasm 的发展，已于 2020 年弃用了这个项目（我个人认为这个方案非常好，被废弃着实有点遗憾了）。

WebAssembly 顾名思义就是**为 Web 浏览器订制的汇编语言**，它运行在 Web 浏览器内，受浏览器的安全限制，不能随意地访问客户端电脑的各种资源。同时它又足够底层运行速度堪比原生应用的运行速度。

通过 WebAssembly 的发展历程我们就知道 C/C++ 是最先可以编译为 Wasm 的语言。当然现在 Rust、C#、Go 等一众语言也可以编译为 Wasm 模块，**不过无论从生成的 Wasm 模块的体积还是执行效率上来说，C/C++ 和 Rust 都是最好的**。因为 C# 语言编译为 Wasm 模块时要把一个精简版的 .Net 运行时编译到 Wasm 模块内，这无疑增加了 Wasm 模块的体积，且执行效率依然受运行时的影响（详见：[参考 1](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fdotnet%2Faspnetcore%2Fissues%2F41909%23issuecomment-1140410705 "https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fdotnet%2Faspnetcore%2Fissues%2F41909%23issuecomment-1140410705")，[参考 2](https://link.juejin.cn/?target=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Faspnet%2Fcore%2Fblazor%2Fhost-and-deploy%2Fconfigure-trimmer%3Fview%3Daspnetcore-6.0 "https://link.juejin.cn/?target=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Faspnet%2Fcore%2Fblazor%2Fhost-and-deploy%2Fconfigure-trimmer%3Fview%3Daspnetcore-6.0")）；Go 语言虽然不需要运行时，但它的编译产物里也包含垃圾收集机制。

安装 Emscripten
-------------

我们将使用 [Emscripten](https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2F "https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2F") 把 C++ 代码编译成 Wasm 模块，Visual Studio 尚未支持 Wasm 的开发工作，所以我们必须自己手动搭建环境（搭建环境前请先确保你已经安装了 Python 3.6 或更新版本、Git 客户端工具等）。

首先克隆 emsdk 项目：

    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    

接着安装最新版本的 Emscripten SDK 工具，并激活这些工具（执行这一步工作前请先确保自己处于**良好的网络环境**中）：

    emsdk install latest
    emsdk activate latest
    

接着把如下三个路径配置到自己系统的环境变量中，注意 `D:\sdk\emsdk` 是我克隆 emsdk 的目录，你应该把这几个目录替换成你自己的。

    D:\sdk\emsdk;
    D:\sdk\emsdk\node\14.18.2_64bit\bin;
    D:\sdk\emsdk\upstream\emscripten;
    

最后打开一个控制台窗口，输入如下指令，查看 Emscripten 是否安装成功：

    emcc -v
    

不出意外的话，控制台窗口会输出 Emscripten 的版本信息和安装情况：

    emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 3.1.28 (f11d6196dd4e8748a726f19895c859b40ff6a4f3)
    clang version 16.0.0 (https://github.com/llvm/llvm-project ea4be70cea8509520db8638bb17bcd7b5d8d60ac)
    Target: wasm32-unknown-emscripten
    Thread model: posix
    InstalledDir: D:\sdk\emsdk\upstream\bin
    

至此，WebAssembly 的开发环境就搭建完成了。

开发一个简单的 Wasm 模块
---------------

创建一个 main.cpp 文件，输入如下代码：

    #include <iostream>
    int main() {
        std::string str = "World";
        int a = 2+3;
        std::cout << "Hello" << str << a << std::endl;
        return 0;
    }
    

这里我没有使用 Visual Studio 创建这个 C++ 文件，因为 Visual Studio 目前还不支持直接把 C++ 代码编译为 Wasm 目标文件（[通过配置可以做到](https://link.juejin.cn/?target=https%3A%2F%2Fwww.wasm.builders%2Fkhanon%2Fbuilding-a-c-wasm-module-in-visual-studio-57m7 "https://link.juejin.cn/?target=https%3A%2F%2Fwww.wasm.builders%2Fkhanon%2Fbuilding-a-c-wasm-module-in-visual-studio-57m7")但比较麻烦，不过 Visual Studio 团队已经在做这项工作了，大家可以保持关注），这里我们就直接使用 Visual Studio Code 来开发 C++ 代码，使用 Emscripten 的命令工具编译 C++ 代码。

上述代码开发完成之后，在命令行下键入如下指令，编译此 C++ 文件：

    emcc main.cpp
    

命令成功执行后，你会发现 main.cpp 同级目录下会生成两个文件：a.out.wasm 和 a.out.js。其中，a.out.wasm 就是我们想要的 Wasm 模块啦。

接着在命令行下输入如下指令：

    node a.out.js
    

不出意外的话，命令行会打印：

    HelloWorld 5
    

没错，Node.js 是支持 Wasm 模块的（自 Node.js 8 开始）。

如果你希望到浏览器环境下测试文件，那么你可以在命令行下使用如下指令编译我们的 C++ 代码：

    emcc main.cpp -o main.html
    

命令成功执行后，main.cpp 同级目录下会再多出三个文件：main.wasm、main.js 和 main.html。你可以使用 Live Server 打开 main.html 文件，得到的结果如下图所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e0de1bc63c04ac78ba027653c5c9fff~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=877&h=898&s=14082&e=webp&b=010101)

> Live Server 是 Visual Studio Code 的一个扩展，你可以在 Visual Studio Code 侧边栏的扩展市场里找到并安装它，Live Server 用于方便地启动一个本地 http 服务，供开发者浏览他们开发的静态页面。没有这个本地 http 服务，我们的 main.html 会找不到 wasm 模块的路径。

调试 webAssembly
--------------

我们可以在编译 WebAssembly 的时候加入 `-v` 参数来让 Emscripten 为我们输出更多编译信息，以辅助我们发现 C++ 代码中的问题，如下所示：

![WasmBuildError.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/76615e1c27b94b02bb564172e92b946e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1549&h=1244&s=198594&e=webp&b=fefdfd)

如果你想在运行期调试 WebAssembly 的代码，那么你需要使用如下指令重新编译 WebAssembly 模块以让你的 .wasm 文件包含调试信息：

    emcc -g main.cpp -o main.html
    

默认情况下 Emscripten 编译 WebAssembly 模块时会为我们优化掉大部分调试信息，添加 `-g` 指令后，Emscripten 将不再为我们优化调试信息。

接着你需要为你的谷歌浏览器安装一个插件 [C/C++ DevTools Support (DWARF)](https://link.juejin.cn/?target=https%3A%2F%2Fgoo.gle%2Fwasm-debugging-extension "https://link.juejin.cn/?target=https%3A%2F%2Fgoo.gle%2Fwasm-debugging-extension") ，这是 Chrome DevTools 开发团队为开发者提供的专门用于调试 WebAssembly 的浏览器插件，注意安装过程中要保持良好的网络环境。

安装完成后，打开 Chrome 浏览器的调试工具 DevTools，点击设置按钮（⚙），打开调试工具的设置面板，勾选实验选项卡下的 `WebAssembly Debugging: Enable DWARF support` 选项。如下图所示：

![WasmDebug1.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/341e0be5283c4dc8a24636c2c5eec518~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1756&h=1327&s=77104&e=webp&b=fdfdfd)

接着退回到 DevTools 主面板，把你的源码路径添加到 DevTools 的文件系统中，然后在 main.cpp 中下一个断点，如下图所示（截图内代码与示例代码略有差异，并非有意为之）：

![WasmDebug2.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/48234ee26d1345609917606fab9276d1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1811&h=1336&s=76412&e=webp&b=fcfcfc)

刷新 main.html 页面，你会发现刚刚下的断点已经命中了，而且调用堆栈也会显示在 DevTools 右侧的面板中，如下图所示：

![WasmDebug3.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/245c46ef494e440997d85934b1eb44df~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1971&h=1123&s=98690&e=webp&b=fbf8f8)

在上图中大家可以看到调试 Wasm 模块时临时变量的值，其中 a 变量的值调试器可以获得，但 str 变量的值不能获得。这主要是 `C/C++ DevTools Support (DWARF)` 插件能力不足导致的，目前没什么好办法解决这个问题。

如果你想在 Node 环境下调试 WebAssembly 模块，那么使用如下命令重新编译 C++ 代码：

    set EMCC_AUTODEBUG=1
    emcc -g main.cpp -s EXIT_RUNTIME
    

> 点击链接查看编译参数 [EXIT\_RUNTIME](https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2Fdocs%2Fgetting_started%2FFAQ.html%23what-does-exiting-the-runtime-mean-why-don-t-atexit-s-run "https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2Fdocs%2Fgetting_started%2FFAQ.html%23what-does-exiting-the-runtime-mean-why-don-t-atexit-s-run") 和环境变量 [EMCC\_AUTODEBUG](https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2Fdocs%2Fporting%2FDebugging.html%23autodebugger "https://link.juejin.cn/?target=https%3A%2F%2Femscripten.org%2Fdocs%2Fporting%2FDebugging.html%23autodebugger") 的意义。

接着执行如下指令加载 WebAssembly 模块（注意 `--inspect-brk` 必须是第一个参数）：

    node --inspect-brk a.out.js
    

然后在谷歌浏览器中打开 inspect 页面（通过浏览器地址栏打开即可）：`chrome://inspect/#devices`，你会发现谷歌浏览器已经发现了你的调试服务，如下图所示：

![WasmDebug4.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d43326bd323c4663b5fe9d484809ac0c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1339&h=1039&s=41506&e=webp&b=fdfdfd)

点击红框中的 inspect 链接（如果红框内的选项未出现，稍微等待一会儿刷新一下页面就出来了），之后的调试步骤就和调试浏览器中运行的 WebAssembly 模块没什么区别了，最终断点中断状态如下图所示：

![WasmDebug5.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c756292a166b4c338503e66ce67cae5e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2046&h=1126&s=77012&e=webp&b=fcfafa)

总结
--

本节我们首先介绍了 WebAssembly 技术的由来和发展历程（为了解决前端代码执行效率的问题），接着我们搭建了 Emscripten 开发编译环境（此工具可以帮助开发者把 C/C++ 代码编译成 WebAssembly 模块），之后我们使用 C++ 代码和 Emscripten 工具创建了一个简单的 WebAssembly 模块，最后我们介绍了如何在 Node.js 和浏览器环境下调试 WebAssembly 模块。

到目前为止，相信大家对 WebAssembly 技术的能力和应用场景还不是特别清楚，不用担心，下一节我们将串讲一下开发 WebAssembly 的重要知识，带领大家真正地进入这个领域。