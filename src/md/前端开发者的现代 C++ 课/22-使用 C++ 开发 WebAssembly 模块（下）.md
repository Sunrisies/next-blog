上一节我们介绍了 WebAssembly 技术的由来和演进历史，并带领大家使用 C++ 开发了一个简单的 WebAssembly 示例程序，同时向大家讲解了如何编译、运行、调试 WebAssembly 程序，相信大家已经对 WebAssembly 技术有了一个粗浅的认识，但单单掌握这些知识还不足以开发供用户使用的 WebAssembly 模块，本节我们将在上一节的基础上继续向大家介绍更高级的 WebAssembly 开发知识，比如如何让 WebAssembly 与页面中的 JavaScript 脚本通信，如何让 WebAssembly 访问网络，以及 WebAssembly 的局限性等知识，相信大家学完本节的知识后再结合 Emscripten 的文档就能`开发出足以商用的 WebAssembly 模块`了。

JavaScript 访问 C++ 代码
--------------------

WebAssembly 模块无论是运行在 Node.js 环境中，还是运行在浏览器环境中，都难免要与 JavaScript 发生交互，接下来我们就介绍一下 JavaScript 代码是如何访问 WebAssembly 模块内的 C++ 代码的，如下示例代码：

    #include <emscripten/bind.h>
    
    using namespace emscripten;
    
    //接收两个浮点型参数，返回一个字符串
    std::string getStr(double a,double b) {
        return "World! " + std::to_string(a*b);
    }
    
    //公开一个方法给 JavaScript 访问
    EMSCRIPTEN_BINDINGS(myModule) {
        function("getStr", &getStr);
    }
    

这段代码使用 `EMSCRIPTEN_BINDINGS` 宏来公开 `getStr` 方法给 JavaScript 访问。`EMSCRIPTEN_BINDINGS` 宏用于将 c++ 类型、函数和其他对象绑定到 JavaScript 运行环境中。参数 `myModule` 用于为一组有关的绑定提供一个具体的名称。

完成上述代码后，使用如下指令编译代码：

    emcc -lembind -o main.js main.cpp
    

编译完成之后，main.cpp 同级目录下将出现 `main.js` 和 `main.wasm` 文件，现在我们创建一个 `main.html` 文件并输入如下代码：

    <!DOCTYPE html>
    <html>
      <script>
        var Module = {
          onRuntimeInitialized: function () {
            console.log("Hello" + Module.getStr(12, 13.3));
          },
        };
      </script>
      <script src="main.js"></script>
    </html>
    

使用 `Live Server` 打开 main.html 页面，你会在开发者调试工具看到输出结果如下：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/640910ad46af4785a0f4c387d2ce477e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=867&h=726&s=68509&e=png&b=fdfbfb)

在 HTML 代码中，我们定义了一个 `Module` 对象，这是一个特殊的对象（必须叫这个名字），当 main.js 为我们加载完 main.wasm 模块之后，会调用这个对象的 `onRuntimeInitialized` 方法。在这个方法内，我们调用了 `Module.getStr` 方法，`Module.getStr` 方法就是我们在 C++ 代码中公开的 getStr 方法。

Module 是由开发者定义的一个全局对象，emscript 生成的代码（main.js）会在 WebAssembly 执行过程的各个阶段调用这个对象的公共方法（`onRuntimeInitialized` 方法就是被 main.js 调用的）。开发者可以为 Module 对象提供指定的方法来控制 WebAssembly 代码的执行。

C++ 访问 JavaScript 代码
--------------------

了解了如何在 JavaScript 代码中访问 C++ 代码之后，接下来我们就介绍如何在 C++ 代码中访问 JavaScript 代码。

Emscripten 库公开了 `emscripten::val` 类型，用于在 WebAssembly 的 C++ 代码中访问 JavaScript 代码，首先修改 main.cpp 的代码如下所示：

    #include <emscripten/val.h>
    #include <stdio.h>
    
    using namespace emscripten;
    
    int main() {
      //访问 JavaScript 全局对象 myObj
      val myObj = val::global("myObj");
      //调用 JavaScript 全局对象 myObj 的 hello 方法，并向该方法传递两个参数。
      myObj.call<void>("hello",val(12),val(13.3));
      printf("All done!\n");
    }
    

使用如下指令重新编译 C++ 代码：

    emcc -lembind -o main.js main.cpp
    

接着修改 `main.html` 代码，如下所示：

    <!DOCTYPE html>
    <html>
      <script>
          //声明一个全局对象，名为myObj
        var myObj = {
          //该全局对象下拥有一个 hello 方法，此方法接收两个参数
          hello: (a, b) => { 
            console.log("hello world!" + a * b);
          },
        };
      </script>
      <script src="main.js"></script>
    </html>
    

使用 `Live Server` 运行程序，最终在开发者调试工具中输出如下结果：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2207e28cfeed4c2f9dd634cb65163184~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1230&h=739&s=98597&e=png&b=fefcfc)

在此示例中，我们使用 `emscripten::val` 对象访问了 JavaScript 的全局对象 `myObj` ，在向 myObj 对象上的 hello 方法传递参数时，也是使用 `emscripten::val` 类型进行包装的（ `val(12)` ）。示例代码中 hello 方法没有返回值，如果需要有返回值的话，可以用类似这样的代码完成任务：

    
    //javascript代码
    //var myObj = {
    //  hello: (a, b) => {
    //    return "hello world!" + a * b;
    //  },
    //};
    
    //c++代码
    std::string result = myObj.call<std::string>("hello",val(12),val(13.3));
    std::cout << result << std::endl;
    

除了使用 `emscripten::val` 方案外，还有一种供 C++ 代码访问 JavaScript 代码的方法，如下代码所示：

    #include <emscripten.h>
    
    //将 JavaScript 语句 声明为 showAlert 函数
    EM_JS(void, showAlert, (double a,double b), {
      alert('hello world'+a*b);
    });
    
    int main() {
      showAlert(12,13.5);
      return 0;
    }
    

`EM_JS` 宏用于在 C++ 代码中将 JavaScript 语句声明为函数，可以像普通的 C++ 函数一样调用它。我们在上面的示例中访问了 JavaScript 的全局方法 `alert`，你也可以通过这种方式访问你自己定义的全局对象或方法。

除此之外，你还可以使用如下方法在 C++ 代码中访问 JavaScript（此方案效率不佳）：

    #include <emscripten.h>
    
    int main() {
      emscripten_run_script("alert('hello world')");
      return 0;
    }
    

`emscripten_run_script` 方法用于在 C++ 代码中执行指定的 JavaScript 语句，这与 JavaScript 中的 `eval` 方法有点相似。

WebAssembly 的局限性
----------------

无论是在浏览器中运行的 WebAssembly 模块，还是在 Node.js 环境下运行的 WebAssembly 模块，都是运行在沙盒中的，它们都不能自由地访问目标环境的文件系统、网络环境和多线程资源等，不过好在 Emscripten 为 WebAssembly 开发者提供了一系列的 API，供开发者安全（受控）地使用这些资源，稍后我们会向大家简单介绍几个案例。

除了目标电脑的资源访问受限外，Emscripten 编译的原生代码是基于小端字节序的，所以如果你编写了基于大端字节序的原生代码（或使用的第三方库是基于大端字节序的库），那么你的代码可能无法正常编译运行。

除此之外，由于 WebAssembly 要运行在受控环境中，所以 Emscripten 对于一些底层指令支持得并不是很好，比如栈跳转指令 `setjmp` 、 `longjmp` 等，你的 C++ 代码中如果涉及到这些指令要尤为小心。

默认情况下，Emscripten 会禁用 C++ 代码中的异常处理机制（也可以手动开启），这也是出于性能考虑的配置，推荐你使用基于 JavaScript 的异常处理机制来处理异常。详情请参阅 [JavaScript-based Exception Support](https://emscripten.org/docs/porting/exceptions.html?highlight=exception#javascript-based-exception-support "https://emscripten.org/docs/porting/exceptions.html?highlight=exception#javascript-based-exception-support") 。

WebAssembly 的这些局限性大都是为了控制 WebAssembly 的能力而导致的，就像孙悟空戴上了金箍，WebAssembly 的运行环境是一个天然的容器，对于管理第三方提交应用非常有用。除了 Node.js 和浏览器之外，比较有名的 WebAssembly 容器还有：[wasmer](https://wasmer.io/ "https://wasmer.io/") 、 [wasmtime](https://github.com/bytecodealliance/wasmtime "https://github.com/bytecodealliance/wasmtime") 、 [WAVM](https://github.com/WAVM/WAVM "https://github.com/WAVM/WAVM") 等。

WebAssembly 访问网络
----------------

WebAssembly 可以使用目标电脑的网络，比如 WebSocket 、 WebRTC 、 Fetch 或 XMLHttpRequest 等，但无法直接使用 Socket 进行网络通信，而且所有网络通信都必须使用异步通信模式，不能阻塞现有线程。下面我们就介绍一下如何在 WebAssembly 内通过 Fetch API 访问网络上的资源，如下代码所示：

    #include <stdio.h>
    #include <string.h>
    #include <sstream>
    #include <iostream>
    #include <emscripten/fetch.h>
    
    //下载成功的回调函数
    void downloadSucceeded(emscripten_fetch_t* fetch) {
      std::cout << "从" << fetch->url << "下载到了" 
          << fetch->numBytes << "字节的数据" << std::endl
          << "数据内容为：" << fetch->data << std::endl;
      emscripten_fetch_close(fetch); //释放请求资源.
    }
    
    //下载失败的回调函数
    void downloadFailed(emscripten_fetch_t* fetch) {
      std::cout << "下载失败，错误码为：" << fetch->status
          << "下载地址：" << fetch->url;
      emscripten_fetch_close(fetch); //释放请求资源
    }
    
    int main() {
      //构建请求体
      emscripten_fetch_attr_t attr;
      emscripten_fetch_attr_init(&attr);
      strcpy(attr.requestMethod, "GET");
      attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
      attr.onsuccess = downloadSucceeded; //注册下载成功函数
      attr.onerror = downloadFailed;  //注册下载失败函数
      //开始 fetch 指定的文件
      emscripten_fetch(&attr, "abc.txt");
    }
    

在这段代码中，我们使用 `emscripten_fetch` API 发起了一个网络请求，以 `GET` 的方式请求当前 HTTP 服务下的 abc.txt 文件。请求成功后将打印请求到的具体内容和字节数，请求失败后将打印错误码和请求地址。

使用如下指令编译以上代码：

    emcc main.cpp -sFETCH  -o main.html
    

注意，如果你要使用 Fetch 接口，就必须在编译 C++ 代码时使用 `-sFETCH` 编译参数。编译成功之后，在 Live Server 中运行 main.html 文件，得到如下结果：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85ead26963a7404aaadc8a07dac90c44~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1222&h=612&s=62144&e=png&b=fefefe)

如你所见，在 C++ 中使用 Fetch API 也是异步运行，这意味着 `emscripten_Fetch` 方法调用后会立即返回，网络请求工作将在后台进行。当操作完成时，将执行成功回调方法或失败回调方法。这和在JavaScript 中使用 Fetch API 并没有什么分别，速度也不会更快。

WebAssembly 使用 Wasm Worker
--------------------------

虽然不能在 WebAssembly 内直接创建线程，但使用 Emscripten 提供的 API 创建 `Wasm Worker` （类似 `Web Worker` ）也非常方便，如下代码所示：

    #include <emscripten/wasm_worker.h>
    #include <stdio.h>
    
    // Wasm Worker 任务方法
    void workerJob()
    {
      printf("Hello World!!!\n");
    }
    
    int main()
    {
      emscripten_wasm_worker_t worker = emscripten_malloc_wasm_worker(1024);
      emscripten_wasm_worker_post_function_v(worker, workerJob);
    }
    

在这段代码中我们使用 `emscripten_malloc_wasm_worker` 方法创建了一个 `emscripten_wasm_worker_t` 对象，接着使用 `emscripten_wasm_worker_post_function_v` 方法启动了一个 `Wasm Worker` 任务，并让这个任务执行 `workerJob` 方法。

接下来使用如下指令编译这段 C++ 代码：

    emcc main.cpp -sWASM_WORKERS
    

注意，如果你要使用 Wasm Worker 接口，就必须在编译 C++ 代码时使用 `-sWASM_WORKERS` 编译参数。编译成功之后，main.cpp 同级目录下会生成 a.out.js 和 a.out.wasm 文件。

接下来我们手动创建一个 html 文件，如下代码所示：

    <!DOCTYPE html>
    <html>
      <head>
        <meta
          http-equiv="origin-trial"
          content="AnVGVJjJCl7R6r5YhtJonCykXq6M2/kgQL0H8XuICbbc6BJ246TPCyyzgNWAGxtqm02vs1TC/oOU/BuUyngpmgsAAABgeyJvcmlnaW4iOiJodHRwOi8vMTI3LjAuMC4xOjU1MDAiLCJmZWF0dXJlIjoiVW5yZXN0cmljdGVkU2hhcmVkQXJyYXlCdWZmZXIiLCJleHBpcnkiOjE2ODgwODMxOTl9"
        />
      </head>
      <body>
        <script src="a.out.js"></script>
      </body>
    </html>
    

在 Live Server 中运行 main.html 文件，得到如下结果：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/839799d2be0f4d46acb3d3f703f5b124~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=377&h=292&s=15075&e=png&b=fffbfb)

说明我们的 Wasm Worker 任务已经成功执行完成了。

> 在 HTML 代码中，我们定义了一个 meta 头，这主要是为了避免 `SharedArrayBuffer is not defined error.` 错误而添加的配置，如果你的 HTTP 服务是通过 Nginx 提供的，那么可以考虑修改响应头来解决这个问题，详情参见：[stackoverflow.com/a/70543132](https://stackoverflow.com/a/70543132 "https://stackoverflow.com/a/70543132") 与 [developer.chrome.com/blog/enabli…](https://developer.chrome.com/blog/enabling-shared-array-buffer/#origin-trial "https://developer.chrome.com/blog/enabling-shared-array-buffer/#origin-trial") 。

在 WebAssembly 程序中，包含应用程序状态的 `Memory` 对象可以在多个 `Worker` 之间共享。这一特性使得多个 `Worker` 之间的同步共享数据状态效率非常高。

总结
--

本节课程我们首先介绍了如何让 JavaScript 与 WebAssembly 通信，你还记得 `EMSCRIPTEN_BINDINGS` 和 `EM_JS` 两个宏的作用吗？接着我们分析了 WebAssembly 的局限性，这主要是因为 WebAssembly 要运行在容器中，容器为了安全限制了 WebAssembly 访问资源的能力导致的。最后我们说明了如何在 WebAssembly 内访问网络（使用`Fetch API`）和如何在 WebAssembly 内启动 `Wasm Worker` 以并行的方式完成任务。

这是本小册的最后一节具体的知识章节了，希望你得到了你想得到的知识，下一节我将送大家最后一程，向大家介绍一些 C++ 学习实践路上有用的软技能。