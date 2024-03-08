网上经常有人问：Node.js 到底是单线程的还是多线程的？

基础回答：Node.js 是单线程的。

展开说说：Node.js 在用户代码层面是单线程的。

再严谨一些：Node.js 在 `worker_threads` 模块出来之前，在用户层面是单线程的。

Node.js 到底是单线程还是多线程的？
---------------------

### JavaScript 代码执行的粒度

结论上面说了。Node.js 有一条主事件循环，所有的 JavaScript 代码都是在主事件循环上按“同步代码”为粒度一整段一整段执行的。

    setTimeout(() => {
      console.log('a few moment later...');
    }, 1000);
    setTimeout(() => {
      console.log('a few moment later as well...');
    });
    console.log('right now');
    

上面所谓同步代码，事件循环中的“第一段”是：

    setTimeout(..., 1000);
    setTimeout(..., 1000);
    console.log('right now');
    

这一整块代码不执行完，Node.js 是不会跳出当前调用栈的。如果这一段代码中有一段死循环卡住了：

    setTimeout(..., 1000);
    setTimeout(..., 1000);
    console.log('right now');
    while (1) {}
    

那么就会困死在当前 Tick 中，永远等不到下一个黎明，就跟《意外空间》一样。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73d07d4256d54240a9a976dfcb5918b8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=540&h=303&s=260592&e=png&b=6b727c)

而后续的 `setTimeout()` 里面的回调函数也一样。在 libuv 的事件循环中，等到一秒钟后的定时器阶段触发，会串行执行两次 `setTimeout()` 的函数。第一次执行一整段：

    () => {
      console.log('a few moment later...');
    }
    

第二次又执行一整段：

    () => {
      console.log('a few moment later as well...');
    }
    

同样的道理，如果在第一段回调函数中写出死循环：

    () => {
      console.log('a few moment later...');
      while (1) {}
    }
    

那么，Node.js 就永远跳不出这一段同步执行。理所当然，就到不了第二段的定时器回调。在 Node.js 中，通过内力跳出这么一段死循环的办法只有一个——`vm` 模块的 `timeout`。

我们来回想一下[第 18 章](https://juejin.cn/book/7196627546253819916/section/7229681057593819192 "https://juejin.cn/book/7196627546253819916/section/7229681057593819192")，当 `vm` 执行超时的时候，是怎么做到强行停止 JavaScript 执行的。首先它也无法做到在 JavaScript 正在执行的当前从内部将其停止。它是靠在另一条守护线程中跑一个新的事件循环，设置定时器，超时后通过在守护线程中执行 `isolate->TerminateExecution()` 来强行终止正在执行的 JavaScript 代码。终止后，为了防止后续可能存在的各种线程安全问题，通过 `uv_async_t` 将执行逻辑强行吸附回主事件循环中进行串行操作。

### 如 C++ 般的竞态？

在 C++ 中，如果两条线程同时执行以下两个函数：

    int temp = 0;
    
    void a() {
      temp = 1;
      printf("%d\n", temp);
    }
    
    void b() {
      temp = 2;
      printf("%d\n", temp);
    }
    

那么可能会有下面几种情况发生：

1.  `a()` 先执行，然后是 `b()`。这种情况下，`a()` 将 `temp` 设置为 `1`，并输出 `1`，然后 `b()` 将 `temp` 设置为 `2`，并输出 `2`。输出结果是 `1` 和 `2`。
    
2.  `b()` 先执行，然后是 `a()`。参考上一条，输出结果是 `2` 和 `1`。
    
3.  `a()` 和 `b()` 几乎同时执行。如此一来，两个函数可能同时试图修改 `temp` 的值。这种情况下的具体结果取决于操作系统如何处理这种冲突。可能的一个结果是 `a()` 将 `temp` 设置为 `1`，然后在它输出之前，`b()` 又将 `temp` 改为 `2`，然后 `a()` 输出 `2`，`b()` 也输出 `2`。
    
4.  参考上一条，可能 `b()` 将 `temp` 设置为 `2`，在输出前 `a()` 又把它改为 `1`，然后也输出 `1`。
    

思来想去有这么几种可能，但实际上还有别的可能性。上面输出的顺序可能是 `1\n2\n`，`2\n1\n`，`1\n1\n`，`2\n2\n`。**但实际上** **`printf()`** **和** **`printf()`** **之间也可能存在冲突。**

比如 `a()` 执行到输出 `%d` 时，此时输出了 `1`。**注意此时还未输出换行**，然后线程 `b()` 获得了控制权，设置 `temp` 为 `2`，并输出 `2\n`，然后再回到 `a()`，输出剩下的 `\n`。此时的输出结果是 `12\n\n`。

举一反三，还有可能的输出有 `21\n\n`、`11\n\n`、`22\n\n`。这种情况在 Node.js 中就不会发生。例如有两个回调函数 `a()` 和 `b()`，其中 `a()` 通过 `setTimeout()` 执行，`b()` 通过读取文件系统的回调执行，假设这两个事件同时触发：

    let temp = 0;
    
    function a() {
      temp = 1;
      console.log(temp);
    }
    
    function b() {
      temp = 2;
      console.log(temp);
    }
    

如果真的是两个事件同时在两条线程触发，就跟 C++ 那种一样，还真有可能“冲突”。**但是！但是在** **Node.js** **中，这种假设就不存在！** 我前面说的“假设这两个事件同时触发”只是虚晃你一枪。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e101f5c0a9b04884b77272f872ab95c1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=300&h=262&s=1358277&e=gif&f=75&b=989868)

还记得上面说的“JavaScript 代码执行的粒度”吗？大家也可以回想一下[第 2 章](https://juejin.cn/book/7196627546253819916/section/7197074908004745254 "https://juejin.cn/book/7196627546253819916/section/7197074908004745254")、[第 3 章](https://juejin.cn/book/7196627546253819916/section/7196992628036993028 "https://juejin.cn/book/7196627546253819916/section/7196992628036993028")的事件循环相关内容，也可以回想一下[彩蛋篇](https://juejin.cn/book/7196627546253819916/section/7229981207453237248 "https://juejin.cn/book/7196627546253819916/section/7229981207453237248")中皇帝一天天的都在墨迹什么。

说不可能，是因为，所有的 JavaScript 代码都是在一整段同步代码为粒度的前提下，串行执行的。`a()` 里面的代码是一整段 JavaScript 代码，在执行完它之前，Node.js 是不会执行别的打断 JavaScript 代码的。同步的 JavaScript 函数调用也属于“一整段同步的 JavaScript 代码”。

怎么理解呢？`a()` 里面的 `console.log()` 是同步调用，所以调用进 `console.log()` 这个函数并执行完里面的所有逻辑，都属于“当前同步代码”的范畴。而 `setTimeout(callback, 1000)` 这段“同步代码”所做的事是新建一个 `Timeout` 实例，并将传进来的 `callback` 存在某个地方（回想一下[第 8 章](https://juejin.cn/book/7196627546253819916/section/7197301858296135684 "https://juejin.cn/book/7196627546253819916/section/7197301858296135684")），仅此而已。`callback` 只有在后续异步逻辑中 libuv 的定时器事件被触发，回到 JavaScript 逻辑时才会被调用。而此时调用也是“全身心投入”到这个回调函数中，只有它的一整块同步逻辑调用完之后，才会进入到下一段异步事件中。

而第 8 章中也提了，如果有多个 `Timer` 都在当前时间到期了，在所谓的“一大段同步逻辑中”也是会通过“薅羊毛算法”逐一去执行各个定时器，并不会真正地“同时进行”。

那么理所当然，虽然看起来“文件系统”和“定时器”可能“同时触发”。但是再祭出[第 3 章](https://juejin.cn/book/7196627546253819916/section/7196992628036993028 "https://juejin.cn/book/7196627546253819916/section/7196992628036993028")那张图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/21806d7945ad4435a75ecbcd8e52264f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=522&h=740&s=69977&e=png&b=f3f3f3)

定时器任务是在定时器阶段（Run due timers）被执行，里面同时到期的定时器尚且串行执行。而读取文件的事件是在 Poll I/O 事件阶段（Poll for I/O）中被执行的，里面如果有多个 I/O 事件同时到达，也是逐一串行执行。每次“串行执行”的时候都只会执行完那一段相关的“同步代码”。

所以看起来“同时发生”，但在 Node.js 的主事件循环中，所有的一大段代码都是各自串行执行的。主线程的事件循环就像个静电棒，所有事件无论在内部别的线程、系统内核中是如何进行的，最终吸附到主事件循环都是排排坐吃果果。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03f33a158fcf4d5c8f3c19bce4520838~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=929&h=564&s=878800&e=png&b=272523)

（拿错图了，这是同时在吃

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e3075b8421ff4f928e8380d0667d5a19~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=300&h=168&s=71773&e=png&b=857386)

回到上面的代码：

    let temp = 0;
    
    function a() {
      temp = 1;
      console.log(temp);
    }
    
    function b() {
      temp = 2;
      console.log(temp);
    }
    

这里面的 `a()` 和 `b()` 不可能同一时间执行。视事件真正到达时刻而定，有可能在定时器阶段定时器到期了，那么完整地执行完 `a()` 输出 `1`；然后事件循环继续往下走，在 Poll for I/O 阶段读取文件事件触发，完整执行 `b()` 输出 `2`。也有可能是定时器阶段刚刚好时间还没到，跳过去到下一阶段直到 Poll for I/O 阶段读取文件事件触发，完整执行 `b()` 输出 `2`，然后到下一循环，又到了定时器阶段，此时到期，完整执行 `a()` 输出 `1`。

所以在 Node.js 中，这种情况下只有两种输出：`1\n2\n` 或者 `2\n1\n`。`temp` 并不会在中间被二者同时修改，然后再跳到 `console.log()`。

在 C++ 多线程中，逻辑的执行像这样：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8a7f957e724a4b38858c2d7e5d02aa4a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1220&h=362&s=23022&e=png&b=fffbfb)

如果在交错重叠的部分不加以防范，很容易出现各种时序错位的问题。此时通常需要加锁，来保证时序。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bbecd1598a0e493c8851f0eac950bade~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1722&h=376&s=32211&e=png&b=fffbfb)

线程 1 中锁内的三步和线程 2 锁内的四步会整段执行，不会相互穿插。而 Node.js 就更简单了，一整段一整段的代码本身就是在主事件循环串行的。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c2c362ae40c348caa2f6272f4ba06109~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3108&h=674&s=118756&e=png&b=fffdfd)

所以我们在 JavaScript 中，只需要关心两大段同步逻辑之间的时序关系即可，不用关心进入到一段同步逻辑中，会与其它同步逻辑产生竞态的情况——这就不存在。

**之前一直讲的** **`uv_async_t`** **做的就是上面这张图里面其它线程任务硬掰回事件循环的事情。**

用户代码层是单线程的，那其它呢？
----------------

在 Node.js 中，有些异步任务是交给类似 epoll 等进行 I/O 监听，还有一些任务则是交给 libuv 的线程池进行执行。我们在前面章节中多少都有提到。例如：

1.  [第 18 章](https://juejin.cn/book/7196627546253819916/section/7229681057593819192 "https://juejin.cn/book/7196627546253819916/section/7229681057593819192")：`vm` 的看门狗；
2.  [第 21 章](https://juejin.cn/book/7196627546253819916/section/7197302115818176515 "https://juejin.cn/book/7196627546253819916/section/7197302115818176515")：`WebCrypto` 中的一些功能；
3.  [第 22 章](https://juejin.cn/book/7196627546253819916/section/7196992627865026572 "https://juejin.cn/book/7196627546253819916/section/7196992627865026572")：`zlib` 中的一些功能；

还有其它一些功能就不一一列举了。我们在前面这些章节中也已经讲明了这些多线程中如何将内容拉回主事件循环的原理。大家有兴趣可以回去复习一下。

哪有什么岁月静好，不过是有人替你负重前行。

`worker_threads`
----------------

我们前面说了在用户层面是单线程的，但这是在`worker_threads` 模块出来之前。Worker Threads 让 Node.js 的开发者们拥有了利用多核 CPU 写逻辑的能力。

Node.js 官方文档也说了，Worker Threads 对于 CPU 密集的 JavaScript 逻辑比较有帮助，但是对 I/O 密集型任务则没什么用。Node.js 内置的那些针对 I/O 密集型的异步 API 就已经足够高效了，如果用 Worker Threads 还不如用异步 API。

在 Node.js 中，Worker Threads 与主事件循环之间是无法共享内存的。

    const { Worker, isMainThread, parentPort } = require('node:worker_threads');
    
    if (isMainThread) {
      const worker = new Worker(__filename);
      worker.once('message', (message) => {
        console.log(message);
      });
      worker.postMessage('Hello, world!');
    } else {
      // When a message from the parent thread is received, send it back:
      parentPort.once('message', (message) => {
        parentPort.postMessage(message);
      });
    }
    

它们之间只能通过 `worker` 对象和 `parentPort` 的 `postMessage()` 来相互传递数据。

主事件循环中的 JavaScript 逻辑是一个 V8 的 `Isolate` 在执行。而每一个 Worker 线程都是一个新的 V8 `Isolate` 对象。它们之间的内存堆栈完全没有关系。所以当任意线程调用 `postMessage()` 的时候，都是先将 JavaScript 对象序列化成某种格式，在接收端通过反序列化将该格式的内容重新组装成 JavaScript 对象。所以 `postMessage()` 中发送端和接收端的两个数据块实际上就是两个副本——自然也不存在任何冲突、竞态的关系。

另外，Node.js 的 Worker Threads 的初始化是有一定成本的，它会重新走一遍 Node.js 的一些初始化流程，以构建一个全新的 V8 引擎沙箱环境——重新生成一个 V8 `Isolate`、上下文 `Context` 等，该初始化的内置模块等也全都重新在新的 V8 `Isolate` 中初始化一遍。

然后重新开始加载并执行用户指定给 `Worker` 线程的 JavaScript 文件。

    const { Worker, isMainThread, parentPort } = require('worker_threads');
    
    if (isMainThread) {
        const now = Date.now();
        const worker = new Worker(__filename);
        worker.postMessage(now);
    } else {
        const now = Date.now();
        parentPort.once('message', message => {
            console.log(now - message);
        });
    }
    

比如这一段代码，在主线程中得到当前时间 `now`，并在新建 `Worker` 后将 `now` 通过 `postMessage()` 打过去。在新线程逻辑中也得到新的当前时间 `now`，并与主线程传过来的数值相减。这个在我的 Macbook M1 上的结果是约 30 毫秒时间。这还只是执行当前文件。如果需要执行的文件依赖巨多，初始化就需要耗费很久，那这个 30 毫秒时间只会更久。

而且它还有各种问题。比如一些全局初始化的单例性质的 C++ Addon，或者没考虑线程安全问题、多 V8 `Isolate` 问题的 C++ Addon，都有可能在 Worker Threads 中出现各种各样的问题。

总之，我个人是不建议，且我自己也不会去使用 Node.js 的 Worker Threads 的。大家如果选用这个模块，可自行谨慎选择。

本章小结
----

其实本章小结就最开始的那一段话。我在这里再 Callback 一下。

Node.js 是单线程的。Node.js 在用户代码层面是单线程的。Node.js 在 `worker_threads` 模块出来之前，在用户层面是单线程的。