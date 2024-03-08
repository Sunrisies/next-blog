在正式开始向各位前端开发者介绍 C++ 语言之前，我们先讨论一下 C++ 语言与 JavaScript 语言的差异（`为了约束讨论的范围，这里就不提 HTML 和 CSS 了`）。

C++ 语言于 1979 年由贝尔实验室的 Bjarne Stroustrup（本贾尼·斯特劳斯特卢普）研发，1983 年正式命名为 C++。而 JavaScript 于 1995 年由网景公司的 Brendan Eich（布兰登·艾克）研发。可以说，**这两门语言都经历了时间的检验，各自拥有大量的拥趸，也都形成了独立的社区和生态**。

本来两门语言各有各的战场，并没什么交集，但自从 Node.js 框架出现之后，JavaScript 就摆脱了浏览器的樊笼，开始渗透进入系统应用的领域；WebAssembly 技术出现之后，C++ 也有了进入 Web 领域的渠道了（不谈原生浏览器插件），所以，现在越来越多的开发者开始同时关注这两门语言。

当你深入了解之后，你就会发现这`两门语言差异非常之大`。接下来我们就介绍一下它们的差异，让各位前端开发者对 C++ 语言有一个初步的认识。

运行环境的差异
-------

*   C++ 属于`编译型语言`，**编译型语言就是指那些要事先把源代码编译成机器代码才能在目标机器上运行的语言。**
    
*   JavaScript 语言则属于`解释型语言`，**解释型语言是指那些可以直接在目标机器的解释器里运行的语言。**
    

也就是说，如果我们用 C++ 语言开发了一个可执行程序，那么这个程序可以在**指定的**机器上，不依赖任何其他程序运行。这里说的指定的机器，是编译 C++ 代码时指定的（比如编译 C++ 代码时要指定 x86 架构或 Arm 架构）。如下图所示：

![C++Run.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/da7aff6cfa1940ba91f6906be6dcdc99~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1210&h=403&s=15208&e=png&b=fffefe)

JavaScript 语言则不同，开发者开发的 JavaScript 代码可以在任何机器的 JavaScript 解释器里运行。也就是说 JavaScript 运行时是要依赖解释器的，Node.js 或者 Chrome 浏览器都内置了 JavaScript 解释器（也就是 V8 引擎）。如下图所示：

![JavaScriptRun.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6520262a6908406a95bb96eaa13daa18~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=977&h=383&s=14335&e=png&b=fdf5f5)

> V8 引擎内部还有即时编译器，并不是一个简简单单的 JavaScript 解释器，但本小册不讨论 JavaScript 解释引擎的 JIT 能力。Webpack 或 Rollup 等工具并没有编译 JavaScript 代码，它们只完成了 JavaScript 代码的捆扎和压缩工作。
> 
> C++ 的编译器里包含预处理器、链接器等工作部件，并不是一步到位就能把 C++ 代码变成二进制可执行程序的。另外，还有一些语言会先编译成字节码，再通过运行时环境执行字节码，比如 C# 或 Java 就是这类语言。这些内容都超出了本小册所讨论的范畴，不再深入介绍。

这两种语言运行在不同的环境中，可以说从根源上就是不一样的。

执行效率的差异
-------

我们知道 C++ 开发的程序不依赖任何解释器，可以直接访问操作系统 API ，控制目标机器的内存和 CPU 。而 JavaScript 开发的程序要先经过解释器解释，再通过解释器访问操作系统的 API ，控制目标机器的内存和 CPU 。完成相同的任务 C++ 非常直接，而 JavaScript 则要绕很大一段路，这是 JavaScript 性能表现不及 C++ 的`原因之一`。

我们可以说 JavaScript 解释器就是 JavaScript 的“保姆”，它负责看护着 JavaScript 的运行，由于有这么个“保姆”的存在，所以 JavaScript 语言设计得非常灵活。比如，JavaScript 开发者完全不用担心垃圾收集的问题（变量超出作用域之后，它占用的内存该如何释放），“保姆”会帮开发者完成这项任务。

然而“保姆”在做垃圾收集工作时非常拖沓（递归查找未被引用的变量），而且不一定在最合适的时机完成任务（新生代内存快满时才**有可能**执行垃圾收集），类似这样的事还有很多，比如字符串操作、容器管控等，JavaScript 程序员都没办法深入底层控制细节，这是 JavaScript 性能表现不及 C++ 的`原因之二`。

> 关于字符串的处理，[Chromium 的开发者曾说](https://groups.google.com/a/chromium.org/g/chromium-dev/c/EUqoIz2iFU4/m/kPZ5ZK0K3gEJ "https://groups.google.com/a/chromium.org/g/chromium-dev/c/EUqoIz2iFU4/m/kPZ5ZK0K3gEJ")，网页操作字符串的调用次数占内存管理器调用总次数的一半以上，相信这些字符串操作有很大一部分都是由 JavaScript 造成的。

另外，JavaScript 的设计者把 JavaScript 设计成单线程执行的语言（尽管各个 JS 运行环境都提供了多线程机制，比如：[Web Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers "https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers") 和 [Worker thread](https://nodejs.org/dist/latest-v18.x/docs/api/worker_threads.html#worker-threads "https://nodejs.org/dist/latest-v18.x/docs/api/worker_threads.html#worker-threads")，但这并不意味着 JavaScript 本身拥有多线程的能力），当 JavaScript 完成大量计算工作的任务时，比如编解码、大数据格式化等，JavaScript 的运行线程就会被阻塞，无法再处理其他任务了，只有当前任务执行完成之后，才能再继续执行挂起的任务。而 C++ 则没有这方面的限制，开发者可以很从容地使用多线程技术完成并行任务的处理逻辑。这是 JavaScript 性能表现不及 C++ 的`原因之三`。

类似的原因还有很多，但更多的时候一个应用程序性能的优劣还是取决于开发者的编码水平，C++ 表现再好，开发者能力不足，也会写出性能表现差劲的应用程序。

编程风格的差异
-------

一开始 C++ 语言只是 C 语言的增强版，C++ 语言最初的名字就是 C With Classes，顾名思义就是**具备类型特性的 C 语言**。后来经过长时间的发展，C++ 变成了一个[支持多种语言范式的编程语言](https://wizardforcel.gitbooks.io/effective-cpp/content/3.html "https://wizardforcel.gitbooks.io/effective-cpp/content/3.html")，它同时支持过程范式、面向对象范式、函数范式、泛型范式、元编程范式等编程范式。所以，开发者可以使用不同的编程风格用 C++ 开发应用程序。

JavaScript 的发展路线则非常简单，很长时间以来 JavaScript 都是以函数式编程范式为主，JavaScript Class 关键字出现之前，想要使用 JavaScript 封装对象还要使用如下这样蹩脚的方法：

    function Person(name) {
      this.name = name;
      this.run = () => {
        console.log(`${this.name} run`);
      };
    }
    let person = new Person("allen");
    person.run();
    

自从 JavaScript 引入了 class 、extends 等关键字之后，再加上 TypeScript 语言的帮助，它在面向对象领域的发展越来越好，目前 JavaScript 语言开发者主要使用函数泛式和面向对象泛式开发应用程序。

另外，C++ 在创建一份数据（变量、参数、返回值等）时，需要显式指明该数据的类型。通常情况下（未经类型转换操作），这些数据的类型一旦被定义，那么它永远就是该数据类型，在程序的整个生命周期也不再改变。因此，我们说 **C++ 是强类型的语言**。

JavaScript 在创建一份数据时并不强制定义数据的类型，数据的类型也会随着环境的改变而改变，给数据赋予不同的值，数据将得到不同的类型。不需要经过明确的类型转换操作。因此，我们说 **JavaScript 是弱类型的语言**。

除此之外，C++ 语言细节特别多，JavaScript 则比较少，虽然两门语言都支持面向对象编程范式和函数式编程范式，但在这两个方向上 C++ 的语法细节比 JavaScript 语法细节多了一倍恐怕还不止，这也是社区里抱怨 C++ 难学、学习曲线陡峭、坑多的原因之一。

> C++ 的长处更多在于它对许多问题都是很好的解决途径，而不在于它对某个特定问题是最好的解决途径。C++ 最有实力的地方并不是它的某个独到之处特别伟大，而在于它在事物的大范围变化中的表现都很不错。

除了这些风格上的差异之外，JavaScript 与 C++ 还有很多差异，我们将在后续的章节中细细介绍。

程序能力的差异
-------

由于 JavaScript 是在解释器内执行的，所以解释器提供了什么能力，JavaScript 就拥有什么能力。比如：JavaScript 在浏览器内可以通过 [WebGPU](https://www.w3.org/TR/webgpu/ "https://www.w3.org/TR/webgpu/") 访问 GPU 硬件，但无法访问客户端的文件系统。

JavaScript 在 Node.js 环境下可以通过 Node.js 内置的 [fs](https://nodejs.org/dist/latest-v18.x/docs/api/fs.html "https://nodejs.org/dist/latest-v18.x/docs/api/fs.html") 模块访问客户端的文件系统，却没办法直接访问 GPU 硬件。无论 JavaScript 在浏览器中运行，还是在 Node.js 环境中运行，都没办法直接创建操作系统服务。

除此之外，不同的解释器解释 JavaScript 的方式也不一样，同样的代码在不同的解释器环境中可能拥有不同的能力表现，这种现象在浏览器发展的早期，标准尚未确定时非常常见。

C++ 则不同，C++ 编译后的程序是二进制的，可以直接在操作系统上运行的，并不像 JavaScript 一样受制于解释器，也就是说客户端操作系统提供了什么 API 它就拥有什么能力。无论是访问文件系统，还是访问设备硬件，都没有任何阻碍。

另外在一些嵌入式设备上，内存和 CPU 硬件资源有限，JavaScript 语言在这类设备上运行会显得力不从心，毕竟 JavaScript 内存占用较高，执行效率较差，C++ 语言则可以在这类设备上表现得很好。

总结
--

本章我们介绍了 JavaScript 和 C++ 两门编程语言的主要差异，包括运行环境的差异、执行效率的差异、编程风格的差异和程序能力的差异等知识。除了上文中介绍的这些差异之外，它们还在开发效率上存在差异（JavaScript 的开发效率要远高于 C++ 的开发效率），社区及生态上存在差异等。

不过相信各位前端开发者已经对 C++ 语言有了一个粗浅的认识，虽然 C++ 语言比 JavaScript 要难学，但 C++ 带给你的回报也是足够大的，它能**拓展你的能力边界，开拓你的技术视野，为你创造更具市场竞争力的软件产品保驾护航，也会提升你在行业中的核心竞争力**。总之，相对于其他编程语言来说，`C++ 语言是前端开发者很值得投入时间和精力学习的编程语言`。