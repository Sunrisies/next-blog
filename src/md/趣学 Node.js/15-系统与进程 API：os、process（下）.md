> 不好意思，上周甲流，断更一周。

Node.js 错误堆栈样式的来源
-----------------

上一节末尾，我许了个诺。

> 下一章在 `process` 里，我会尝试向大家解释一下 Node.js 错误对象的堆栈样式是怎么来的，它为什么跟 Chrome 长得不大一样。

这一节稍微讲一下 Node.js 的错误堆栈样式是怎么来的吧。首先我们做个实验，写两个文件：

*   `error.js`
*   `temp.html`

    // error.js
    'use strict';
    
    setTimeout(function a() {
      new URL('foo', '$$$asdf/dsf/...');
    }, 10);
    

    <script src="./error.js"></script>
    

依次用 Node.js 执行 `error.js` 以及用浏览器打开 `temp.html`，打开控制台，我们看看结果吧。

    // Node.js
    node:internal/url:560
          throw new ERR_INVALID_URL(input);
          ^
    
    TypeError [ERR_INVALID_URL]: Invalid URL
        at new NodeError (node:internal/errors:402:5)
        at new URL (node:internal/url:560:13)
        at Timeout.a [as _onTimeout] (/foo/error.js:4:3)
        at listOnTimeout (node:internal/timers:569:17)
        at process.processTimers (node:internal/timers:512:7) {
      input: 'foo',
      code: 'ERR_INVALID_URL'
    }
    
    // Chrome
    Uncaught TypeError: Failed to construct 'URL': Invalid base URL
        at a (error.js:4:3)
    

两个错误堆栈输出方式不一样。首先 Node.js 中，我们上一节讲过，Uncaught Exception 的时候，会先用上箭头输出对应的错误行及出错的那段代码，这个我们就略过不讲了。我们发现两个输出的错误对象中，堆栈长得不一样，Chrome 就一个 `TypeError: Failed to ...`，而 Node.js 里面 `TypeError` 后面还能跟着个方括号，再后面才是 `Invalid URL`。为什么它俩会长得不一样呢？

### 自定义错误堆栈记录

V8 里面有一个函数，是可以让用户自定义错误堆栈记录。只需往 V8 的 `Isolate` 里面传入一个用于自定义记录的函数即可，该函数接收错误对象本身，以及每行堆栈记录的数组。每次生成一个错误，当我们要访问其 `stack` 属性时，都会通过该函数得到自定义的堆栈格式。

Node.js 在初始化的时候会通过 V8 的这个 `SetPrepareStackTraceCallback` [传入对应的自定义函数](https://github.com/nodejs/node/blob/v18.16.0/src/api/environment.cc#L253-L257 "https://github.com/nodejs/node/blob/v18.16.0/src/api/environment.cc#L253-L257")，而这个自定义函数里面是通过调用一个特定的 JavaScript 侧函数去做生成的。对应的 JavaScript 是在 Node.js 的 JavaScript 代码最开始初始化的时候进行定义的。`internal/bootstrap/node.js` 里面的[第一行代码](https://github.com/nodejs/node/blob/v18.16.0/lib/internal/bootstrap/node.js#L55 "https://github.com/nodejs/node/blob/v18.16.0/lib/internal/bootstrap/node.js#L55")：`setupPrepareStackTrace()`。

在这个 `setupPrepareStackTrace()` 函数里面，[逻辑如下](https://github.com/nodejs/node/blob/v18.16.0/lib/internal/bootstrap/node.js#L373-L390 "https://github.com/nodejs/node/blob/v18.16.0/lib/internal/bootstrap/node.js#L373-L390")：

    function setupPrepareStackTrace() {
      const {
        setEnhanceStackForFatalException,
        setPrepareStackTraceCallback,
      } = internalBinding('errors');
      const {
        prepareStackTrace,
        fatalExceptionStackEnhancers: {
          beforeInspector,
          afterInspector,
        },
      } = require('internal/errors');
      // Tell our PrepareStackTraceCallback passed to the V8 API
      // to call prepareStackTrace().
      setPrepareStackTraceCallback(prepareStackTrace);
      // Set the function used to enhance the error stack for printing
      setEnhanceStackForFatalException(beforeInspector, afterInspector);
    }
    

它里面通过 `setPrepareStackTraceCallback` 来将 `prepareStackTrace` 函数传给 C++ 侧的那个自定义函数去执行。这个 `prepareStackTrace` 函数[长这样](https://github.com/nodejs/node/blob/v18.16.0/lib/internal/errors.js#L89-L132 "https://github.com/nodejs/node/blob/v18.16.0/lib/internal/errors.js#L89-L132")：

    const nodeInternalPrefix = '__node_internal_';
    
    ...
    
    const prepareStackTrace = (globalThis, error, trace) => {
      if (overrideStackTrace.has(error)) {
        const f = overrideStackTrace.get(error);
        overrideStackTrace.delete(error);
        return f(error, trace);
      }
    
      const firstFrame = trace[0]?.getFunctionName();
      if (firstFrame && StringPrototypeStartsWith(firstFrame, nodeInternalPrefix)) {
        for (let l = trace.length - 1; l >= 0; l--) {
          const fn = trace[l]?.getFunctionName();
          if (fn && StringPrototypeStartsWith(fn, nodeInternalPrefix)) {
            ArrayPrototypeSplice(trace, 0, l + 1);
            break;
          }
        }
        if (trace.length > userStackTraceLimit)
          ArrayPrototypeSplice(trace, userStackTraceLimit);
      }
    
      const globalOverride =
        maybeOverridePrepareStackTrace(globalThis, error, trace);
      if (globalOverride !== kNoOverride) return globalOverride;
    
      let errorString;
      if (kIsNodeError in error) {
        errorString = `${error.name} [${error.code}]: ${error.message}`;
      } else {
        errorString = ErrorPrototypeToString(error);
      }
      if (trace.length === 0) {
        return errorString;
      }
      return `${errorString}\n    at ${ArrayPrototypeJoin(trace, '\n    at ')}`;
    };
    

上面的代码主要分五步走：

![16飞书流程图.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ee5c2d3200fc4285ae96a0e0107df29c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1056&h=1276&s=209218&e=png&b=fffefe)

这里面的 `trace` 就是刚才提到的每行堆栈记录的数组。这里面的元素是 `CallSite` 类的实例。该类里面有什么成员方法可以[参照文档](https://v8.dev/docs/stack-trace-api#customizing-stack-traces "https://v8.dev/docs/stack-trace-api#customizing-stack-traces")。

首先第一步，是判断一下有没有直接被完全自定义的堆栈（被存放在 `overrideStackTrace` 中），若有，则直接返回。在 Node.js 内部，是禁止使用 [Error.prepareStackTrace()](https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/error#error.preparestacktrace "https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/error#error.preparestacktrace") 函数的，如有需要通过该函数来自定义某个错误的堆栈，则直接往 `overrideStackTrace` 添加一对映射即可。在 `prepareStackTrace()` 函数中，会先判断相关映射返回结果。

### `hideStackFrames()`

第二步，隐藏一些错误堆栈。让我们梦回[第 13 章](https://juejin.cn/book/7196627546253819916/section/7196922041201590310 "https://juejin.cn/book/7196627546253819916/section/7196922041201590310")，关于 `hideStackFrames()` 的描述。

> 在上面的代码中，首先判断 `original` 是不是一个函数。我们忽略包在 `validateFunction` 外面的 `hideStackFrames`，它是通过改变里面箭头函数的函数名（为其加上某个特定前缀），来让万一生成错误堆栈的时候忽略掉本级的堆栈。

这个 `hideStackFrames()` 函数主要作用就是给传进来的函数改个名，加上 `__node_internal_` 前缀。

    function hideStackFrames(fn) {
      const hidden = nodeInternalPrefix + fn.name;
      ObjectDefineProperty(fn, 'name', { __proto__: null, value: hidden });
      return fn;
    }
    

也就是说，当我们传进去一个 `validateFunction` 函数，得到的是一个 `__node_internal_validateFunction` 函数。

回到第二步，拿到堆栈顶函数名，是否被添加了这个前缀。若有，则逐元素检查过去，剔除所有添加前缀的那些行。然后将剩下的元素行数缩减到 `userStackTraceLimit` 之内。至于为什么要在这里对行数做一个限制，是因为之前因为这个行数问题出过性能问题，Node.js 社区大佬们修了一发。有兴趣可以查看[相关 PR](https://github.com/nodejs/node/pull/35644 "https://github.com/nodejs/node/pull/35644")。

这个做法有什么用呢？还是拿刚才那个 `error.js` 为例。如果没有这个剔除逻辑，那么你得到的错误堆栈应该是这样的：

    TypeError: Invalid URL
        at __node_internal_captureLargerStackTrace (node:internal/errors:493:5)
        at new NodeError (node:internal/errors:402:5)
        at new URL (node:internal/url:560:13)
        at Timeout.a [as _onTimeout] (/Users/bytedance/Workspace/byted/hourai/error.js:4:3)
        at listOnTimeout (node:internal/timers:569:17)
        at process.processTimers (node:internal/timers:512:7)
    

看！在 `new NodeError` 之上多了一个 `__node_internal_captureLargerStackTrace`。

咦，好像这个错误堆栈除了多了一行之外，比真实 Node.js 场景中少了一块 `[ERR_INVALID_URL]`。这又是怎么回收？

第三步是 `maybeOverridePrepareStackTrace()` 调用，这个里面的操作是看看用户侧有没有自行覆盖 `Error.prepareStackTrace()`，如果有，则以用户侧的覆盖为准。若没有覆盖，则到第四步，为错误加上 `code`。

### 错误码

`kIsNodeError` 是一个 `Symbol`。Node.js 内部的标准错误都会在错误对象上挂载上这个 `Symbol`。在这里的判断就是为了确定这是不是一个 Node.js 内部的标准错误。比如这个 `ERR_INVALID_URL` 就是一个标准错误，在 Node.js [官方文档里面有提](https://nodejs.org/dist/latest-v18.x/docs/api/errors.html#err_invalid_url "https://nodejs.org/dist/latest-v18.x/docs/api/errors.html#err_invalid_url")。所以自然而然，这个对象上有 `kIsNodeError` 的 `Symbol`。

如果是个 Node.js 标准错误，那么错误信息为：

    errorString = `${error.name} [${error.code}]: ${error.message}`;
    

普通错误，信息为：

    errorString = Error.prototype.toString.call(error);
    

这就是为什么我们看到上面那个错误中间多了一段方括号。

最后一步，拼接最终结果。

    return `${errorString}\n    at ${ArrayPrototypeJoin(trace, '\n    at ')}`;
    

此处的 `trace` 对象用 `Array.prototype.join()` 进行拼接，连接符为 `\n at`。拼接时候，每个元素会在 `join` 中被自动转为字符串，也就是我们看到的类似 `new NodeError (node:internal/errors:402:5)` 字样。

最终一拼接，就是我们在最开始时看到的这种 Node.js 堆栈了。

`os`——操作操作系统相关内容
----------------

与 `process` 类似，`os` 同样比较依赖 libuv 的能力。

随便举个例子：`os.cpus()`。

### `os.cpus()`

#### `uv_cpu_info()`

这个函数底层依赖的 libuv 的 [uv\_cpu\_info()](https://docs.libuv.org/en/v1.x/misc.html#c.uv_cpu_info "https://docs.libuv.org/en/v1.x/misc.html#c.uv_cpu_info")：

    int uv_cpu_info(uv_cpu_info_t **cpu_infos, int *count)
    

传入用于接受 CPU 信息的结构体，以及接受 CPU 数的 `int` 指针。返回值是获取成功与否。

在 Linux 核心的系统中，[它的实现](https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L268-L316 "https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L268-L316")如下：

    int uv_cpu_info(uv_cpu_info_t** cpu_infos, int* count) {
      unsigned int numcpus;
      uv_cpu_info_t* ci;
      int err;
      FILE* statfile_fp;
    
      *cpu_infos = NULL;
      *count = 0;
    
      statfile_fp = uv__open_file("/proc/stat");
      if (statfile_fp == NULL)
        return UV__ERR(errno);
    
      err = uv__cpu_num(statfile_fp, &numcpus);
      if (err < 0)
        goto out;
    
      err = UV_ENOMEM;
      ci = uv__calloc(numcpus, sizeof(*ci));
      if (ci == NULL)
        goto out;
    
      err = read_models(numcpus, ci);
      if (err == 0)
        err = read_times(statfile_fp, numcpus, ci);
    
      if (err) {
        uv_free_cpu_info(ci, numcpus);
        goto out;
      }
    
      /* read_models() on x86 also reads the CPU speed from /proc/cpuinfo.
       * We don't check for errors here. Worst case, the field is left zero.
       */
      if (ci[0].speed == 0)
        read_speeds(numcpus, ci);
    
      *cpu_infos = ci;
      *count = numcpus;
      err = 0;
    
    out:
    
      if (fclose(statfile_fp))
        if (errno != EINTR && errno != EINPROGRESS)
          abort();
    
      return err;
    }
    

刨除一些错误处理、细节处理等内容，其实核心就几个关键词（关键函数）：

*   `uv__open_file("/proc/stat")`；
*   `uv__cpu_num(statfile_fp, &numcpus)`；
*   `read_models(numcpus, ci)`；
*   `read_times(statfile_fp, numcpus, ci)`；
*   `read_speeds(numcpus, ci)`。

##### `/proc/stat`

首先，根本的根本，就是第一项——`/proc/stat`。在 Linux 系统中，`/proc/stat` 文件存储了关于内核活动的各种信息。这个文件可以在任何 Linux 系统上找到，并且其中包含了关于 CPU 使用、上下文切换、中断以及 CPU 时间的统计信息。这些信息可以被系统管理员和开发人员用来监控系统性能和优化应用程序。`/proc/stat` 文件是一个非常有用的系统文件，可以提供关于 Linux 内核活动的详细信息。

一个可能的 `/proc/stat` 文件长这样：

    $ cat /proc/stat
    cpu  2255 34 2290 22625563 6290 127 456
    cpu0 1132 34 1441 11311718 3675 127 438
    cpu1 1123 0 849 11313845 2614 0 18
    intr 114930548 113199788 3 0 5 263 0 4 [... lots more numbers ...]
    ctxt 1990473
    btime 1680424018
    processes 2915
    procs_running 1
    procs_blocked 0
    

当我们打开 `/proc/stat` 文件时，会看到一个由多行组成的文本文件。每一行的第一个字段代表了这一行的类型，按顺序它可以是以下之一：

*   `cpu`：关于 CPU 的统计信息，包括用户模式、系统模式和空闲模式下的 CPU 时间，以及其他一些相关的统计数据；
*   `intr`：中断的统计信息，包括每种中断类型的触发次数；
*   `ctxt`：上下文切换的统计信息，包括进程上下文切换和 IRQ 上下文切换的次数；
*   `btime`：表示系统启动的时间戳；
*   `processes`：进程的统计信息，包括 fork 和 exit 的次数；
*   `procs_running`：正在运行的进程数；
*   `procs_blocked`：被阻塞的进程数。

上面的字段都是按顺序排列的。第一行一定是所有 CPU 的数值总和，然后接下去 N 行是 N 个 CPU 的信息。我们可以看到第一行的 `2225` 就是后面 `1132` 加上 `1123`。

##### CPU 数

libuv 就是从这个文件中读取 CPU 信息的。首先是通过 `uv__cpu_num` 从刚打开的文件中读取 CPU 数。读取的方法很朴素，也很暴力——逐行读取，然后判断行首三个字符是否分别为 `cpu`，若是，则 CPU 数加一。所以如果有一行不再是 `cpu` 开头，则直接 `break` 出循环即可。

由于第一行是 CPU 总和，所以也应该跳过。所以[它的代码](https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L246-L265 "https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L246-L265")长这样：

    static int uv__cpu_num(FILE* statfile_fp, unsigned int* numcpus) {
      unsigned int num;
      char buf[1024];
    
      // 读取第一行，并略过
      if (!fgets(buf, sizeof(buf), statfile_fp))
        return UV_EIO;
    
      num = 0;
      // 循环读取每一行，直到不是 CPU 为止
      while (fgets(buf, sizeof(buf), statfile_fp)) {
        if (strncmp(buf, "cpu", 3))
          break;
        num++;
      }
    
      if (num == 0)
        return UV_EIO;
    
      *numcpus = num;
      return 0;
    }
    

> `fgets` 就是读取一行。`strncmp` 就是比较字符串，里面的 `3` 代表只比较 `3` 个字节，返回值为 `0` 代表相等。

高端的食材往往只需要采用最朴素的烹饪方式。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/022ce711cb614687b99ac3e0cf73b2a0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

##### CPU 型号

CPU 型号是通过 `read_models()` 来获取。同样，高端的食材往往只需要采用最朴素的烹饪方式。由于[原代码](https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L327-L519 "https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L327-L519")里面宏判断、条件判断比较多，再加上有一些硬编码映射的存在，代码比较长，就不放上来了。

在 Linux 核心的系统中，CPU 的这些信息被存在一个叫 `/proc/cpuinfo` 文件中。比如说，这是我的一台 VPS 的该文件。

    processor       : 0
    vendor_id       : GenuineIntel
    cpu family      : 6
    model           : 63
    model name      : Intel(R) Xeon(R) CPU E5-2683 v3 @ 2.00GHz
    stepping        : 2
    microcode       : 0x43
    cpu MHz         : 2000.010
    cache size      : 35840 KB
    physical id     : 0
    siblings        : 2
    core id         : 8
    cpu cores       : 1
    apicid          : 16
    initial apicid  : 16
    fpu             : yes
    fpu_exception   : yes
    cpuid level     : 15
    wp              : yes
    flags           : fpu de tsc msr pae mce cx8 apic sep mca cmov pat clflush mmx fxsr sse sse2 ht syscall nx lm constant_tsc rep_good nopl eagerfpu pni pclmulqdq ssse3 fma cx16 sse4_1 sse4_2 movbe popcnt aes xsave avx f16c rdrand hypervisor lahf_lm abm ida arat epb xsaveopt pln pts dtherm fsgsbase bmi1 avx2 bmi2 erms
    bogomips        : 4000.02
    clflush size    : 64
    cache_alignment : 64
    address sizes   : 46 bits physical, 48 bits virtual
    power management:
    
    ...
    

我们肉眼可读出，它的型号是 `Intel(R) Xeon(R) CPU E5-2683 v3 @ 2.00GHz`，能看到它的主频、核心数等等信息。

libuv 中读取 CPU 型号靠的就是这个文件。同样地，读取到开头是 `model name` 一行时，就开始提取它的型号了。不过，不同的处理器字段名可能不一样，比如 PowerPC 就是 `cpu` 而非 `model name`。针对一些 AArch64 架构中没有 `model name` 字段的情况，则通过 `CPU part` 的一个十六进制值来生成 CPU 型号，这就是刚才讲的 libuv 中有一个映射表，硬编码将一些十六进制的 `CPU part` 硬编码成某一个 CPU 型号，如：

    static const struct vendor_part arm_chips[] = {
      { 0x811, "ARM810" },
      ...
    };
    

这里的意思差不多就是，如果 `CPU part` 值是 `0x811`，那么它的型号就是 `ARM810`。这个映射表有五十多行。如果大家手头有 Linux，可以看看 Node.js 中 `os.cpus()` 结果与 `$ cat /proc/cpuinfo` 是不是一样的。

##### CPU 时间

说到 CPU 时间，又回到了 `/proc/stat` 文件了。每一行 CPU 相关的内容中，其第一列是第几颗 CPU，后面每列依次为用户态时间（`user`）、低优先级用户态时间（`nice`）、内核态时间（`sys`）、空闲时间（`idle`）、I/O 等待事件（`iowait`）、硬中断时间（`irq`）、软中断时间（`softirq`）。这里面，Node.js 的 `os.cpus()` 用到了 `user`、`nice`、`sys`、`idle` 和 `irq`。

> 更多关于这块内容的信息，可自行去网上搜索 `/proc/stat` 文件相关内容。

libuv 在读取 CPU 型号后，将刚才打开的 `/``proc/stat` 文件重新指向文件首，重新开始逐行读取，并读取后面各值。类似下面这样：

    sscanf(buf + len,
           "%llu %llu %llu %llu %llu %llu",
           &user,
           &nice,
           &sys,
           &idle,
           &dummy,
           &irq);
    

在 [read\_times() 中](https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L522-L593 "https://github.com/libuv/libuv/blob/v1.44.2/src/unix/linux-core.c#L522-L593")，最终把这些值乘以一个系数，得到最终值。

    static int read_times(...) {
      ...
      unsigned int ticks;
      unsigned int multiplier;
      ...
      ticks = (unsigned int)sysconf(_SC_CLK_TCK);
      multiplier = ((uint64_t)1000L / ticks);
    
      // 获取时长
      ...
    
      // 乘以系数
      ts.user = user * multiplier;
      ts.nice = nice * multiplier;
      ts.sys  = sys * multiplier;
      ts.idle = idle * multiplier;
      ts.irq  = irq * multiplier;
    
      ...
    }
    

##### CPU 速度

CPU 速度实际上是在 CPU 型号那块直接算出来了。在那块逻辑中算不出来的情况下，会跑到 `read_speeds()` 兜底。

我们在 CPU 型号小节里面提到了，`/proc/cpuinfo` 针对每个 CPU 都有频率参数。通常情况下是 `cpu MHz` 字段。在循环读 CPU 型号信息的同时，会去尝试解析对应的 CPU 频率。那整段代码的伪代码如下（把编译时的宏判断也改成了运行时的条件判断以方便理解）：

    function readModels(numcpus, info) {
      let modelMarker = 'model name\t: ';
      const speedMarker = 'cpu MHz\t\t: ';
      let modelIdx = 0;
      let speedIdx = 0;
      if (可识别架构) {
        const fp = 打开文件('/proc/cpuinfo');
        while (buf = 读取一行(fp)) {
          // 读取 `model name` 后面的内容
          if (modelIdx < numcpus) {
            if (buf.startsWith(modelMarker)) {
              info[modelIdx++].model = buf.后半段();
              continue;
            }
          }
     
          if (arm 架构 || aarch64 架构 || mips 架构) {
            if (modelIdx < numcpus) {
              if (arm 架构) {
                modelMarker = 'Processor\t: ';
              } else if (aarch64 架构) {
                const partMarker = 'CPU part\t: ';
                const armChips = [{
                  id: 0x811,
                  name: 'ARM810',
                }, ...];
              
                if (buf.startsWith(partMarker)) {
                  const modelId = parseInt(buf, 16);
                  for (let i = 0; i < armChips.length; i++) {
                    if (armChips[i].id === modelId) {
                      info[modelIdx++].model = armChips[i].name;
                      break;
                    }
                  }
                }
              } else {
                modelMarker = "cpu model\t\t: ";
              }
            
              if (buf.startsWith(modelMarker)) {
                info[modelIdx++].model = buf.后半段();
                continue;
              }
            }
          } else {
            if (speedIdx < numcpus) {
              if (buf.startsWith(speedMarker)) {
                info[speedIdx++].speed = parseInt(buf.后半段());
              }
            }
          }
        }
      }
      
      const inferredModel = modelIdx > 0 ? info[modelIdx - 1].model : 'unknown';
      while (modelIdx < numcpus) {
        info[modelIdx++].model = inferredModel;
      }
      
      return 0;
    }
    

看起来有点绕，实际上在编译好的二进制可执行文件中，架构不相干的逻辑是不会存在于指令当中的。比如，如果是 Intel 的架构，在消弭非对应宏判断的逻辑后，长这样：

    function readModels(numcpus, info) {
      let modelMarker = 'model name\t: ';
      const speedMarker = 'cpu MHz\t\t: ';
      let modelIdx = 0;
      let speedIdx = 0;
    
      const fp = 打开文件('/proc/cpuinfo');
      while (buf = 读取一行(fp)) {
        // 读取 `model name` 后面的内容
        if (modelIdx < numcpus) {
          if (buf.startsWith(modelMarker)) {
            info[modelIdx++].model = buf.后半段();
            continue;
          }
        }
    
        // 读取 `cpu MHz` 后面的内容
        if (speedIdx < numcpus) {
          if (buf.startsWith(speedMarker)) {
            info[speedIdx++].speed = parseInt(buf.后半段());
          }
        }
      }
    
      // 没填满的情况下，用最后一个型号或者 `unknown` 去填满
      const inferredModel = modelIdx > 0 ? info[modelIdx - 1].model : 'unknown';
      while (modelIdx < numcpus) {
        info[modelIdx++].model = inferredModel;
      }
      
      return 0;
    }
    

如果在这里没能获取到 `speed`，比如读不到 `cpu MHz`，或者是 Arm 相关架构下就不会走到这段读取速度的逻辑中。那就是去 `read_speeds` 兜底了。

在 Linux 中，有一系列的文件，其文件名如下：`/sys/devices/system/cpu/cpu<编号>/cpufreq/scaling_cur_freq`。该文件用于记录 CPU 当前运行频率。在 Linux 系统中，CPU 的频率通常会根据当前负载情况和节能策略进行动态调整，以达到平衡性能和能效的目的。`scaling_cur_freq` 文件记录了当前 CPU 运行的实际频率，用于监测和分析 CPU 的性能和能效。`scaling_cur_freq` 文件中的数值通常以赫兹（Hz）为单位表示，例如 `2500000` 表示 CPU 正在以 2.5 GHz 的频率运行。

不过也不是所有情况下都有该文件，通常情况下是 ARM 架构（或者可动态调频）才有。而 x86 直接在 `readModels` 里面就获取到了。所以可以理解为这个兜底逻辑是为 ARM 架构设计的。

所以这个[兜底逻辑](https://github.com/libuv/libuv/blob/v1.13.1/src/unix/linux-core.c#L630-L635 "https://github.com/libuv/libuv/blob/v1.13.1/src/unix/linux-core.c#L630-L635")就是遍历尚未读取到速度的那几颗 CPU，然后尝试读取上面的文件依次获取。用伪代码编写就是：

    function readCpufreq(num) {
      const buf = `/sys/devices/system/cpu/cpu${num}/cpufreq/scaling_cur_freq`;
      const fp = 打开文件(buf);
      if (打开失败) {
        return 0;
      }
      
      const val = 读取文件并转成数值(fp);
      return val;
    }
    
    function readSpeeds(numcpus, info) {
      for (let i = 0; i < numcpus; i++)
        info[i].speed = readCpufreq(num) / 1000;
    }
    

还是那句话。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d5b4a8c423f8422bbd51d6a86010cc92~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

#### Node.js 侧

在 C++ 侧，构建一个普通对象的成本比数组要高，因为它会逐个去挂载字段，结构在不断变化。而数组则直接推入即可。鉴于每颗 CPU 信息就七条数据，Node.js 在 C++ 侧初始化了一个 CPU 个数乘以 7 的数组，依次填入数据。

    static void GetCPUInfo(const FunctionCallbackInfo<Value>& args) {
      Environment* env = Environment::GetCurrent(args);
      Isolate* isolate = env->isolate();
    
      uv_cpu_info_t* cpu_infos;
      int count;
    
      // 调用 uv_cpu_info 获取信息
      int err = uv_cpu_info(&cpu_infos, &count);
      if (err)
        return;
    
      // [model, speed, (5 entries of cpu_times), model2, speed2, ...]
      std::vector<Local<Value>> result;
      result.reserve(count * 7);
      for (int i = 0; i < count; i++) {
        // 下面代码没必要细看，直到是依次推入 7 个数据就好了
        uv_cpu_info_t* ci = cpu_infos + i;
        result.emplace_back(OneByteString(isolate, ci->model));
        result.emplace_back(Number::New(isolate, ci->speed));
        result.emplace_back(
            Number::New(isolate, static_cast<double>(ci->cpu_times.user)));
        result.emplace_back(
            Number::New(isolate, static_cast<double>(ci->cpu_times.nice)));
        result.emplace_back(
            Number::New(isolate, static_cast<double>(ci->cpu_times.sys)));
        result.emplace_back(
            Number::New(isolate, static_cast<double>(ci->cpu_times.idle)));
        result.emplace_back(
            Number::New(isolate, static_cast<double>(ci->cpu_times.irq)));
      }
    
      uv_free_cpu_info(cpu_infos, count);
      args.GetReturnValue().Set(Array::New(isolate, result.data(), result.size()));
    }
    

在 JavaScript 侧，`os.cpus()` 调用这个函数，并把这个数组里的数据再给结构化成对象即可。

    function cpus() {
      // getCPUs() 就是上面那个函数
      const data = getCPUs() || [];
      const result = [];
      let i = 0;
      while (i < data.length) {
        Array.prototype.push.call(result, {
          model: data[i++],
          speed: data[i++],
          times: {
            user: data[i++],
            nice: data[i++],
            sys: data[i++],
            idle: data[i++],
            irq: data[i++],
          },
        });
      }
      return result;
    }
    

### `os.uptime()`

在 Node.js 中，这个函数底层依赖的是 libuv 的 `uv_uptime()`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80416c9ee81343179c8c1bf91a3e1b78~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

这个函数里面也跟五花肉一样，[做了好几层兜底](https://github.com/nodejs/node/blob/v18.16.0/deps/uv/src/unix/linux-core.c#L214-L243 "https://github.com/nodejs/node/blob/v18.16.0/deps/uv/src/unix/linux-core.c#L214-L243")。

1.  读取 `/proc/uptime`；
2.  `clock_gettime()`，但是 `CLOCK_BOOTTIME`；
3.  `clock_gettime()`，但是 `CLOCK_MONOTONIC`。

`/proc/uptime` 文件是一个用于记录系统启动时间和运行时间的系统文件。在 Linux 系统中，每个进程都有一个内核级别的运行时间计数器，用于记录进程从启动到现在的时间。`/proc/uptime` 文件则是将系统所有进程的运行时间计数器累加后得到的结果，用于记录系统从启动到现在的时间。

`/proc/uptime` 文件的内容通常由两个数值组成，分别表示系统运行时间和空闲时间。例如：

    12345.67 23456.78
    

其中，第一个数值 `12345.67` 表示系统从启动到现在的时间（单位为秒），第二个数值 `23456.78` 表示系统空闲时间（单位为秒），即系统中当前没有运行任务的时间。

通过监测 `/proc/uptime` 文件，可以了解系统的运行时间和空闲时间，从而评估系统的稳定性和负载情况。这个信息可以被用于系统监控和性能优化，例如计算系统的平均负载、优化进程调度和资源分配等等。

所以 `uv_uptime` 里面第一步就是打开 `/proc/uptime`，读取第一段数值。

      if (0 == uv__slurp("/proc/uptime", buf, sizeof(buf)))
        if (1 == sscanf(buf, "%lf", uptime))  // 读取到 `uptime` 给上层
          return 0;  // 返回 `0`，表示成功
    

> 这里的 `uv__slurp()` 是打开文件并读取的意思。

然后如果这一步读取失败了，则使用 `clock_gettime()` 获取。`clock_gettime` 是一个 Linux 系统中的系统调用（syscall），用于获取指定时钟的精确时间。在 Linux 中，有多种不同类型的时钟，例如系统实时时钟（real-time clock）、进程CPU时钟（process CPU clock）、单调时钟（monotonic clock）等等。`clock_gettime` 系统调用可以用于获取任意指定类型的时钟的精确时间。

兜底一采用的是 `clock_gettime(CLOCK_BOOTTIME, ...)`，`CLOCK_BOOTTIME` 表示自系统启动以来经过的时间。需要注意的是，`CLOCK_BOOTTIME` 时钟需要在支持的 Linux 内核版本中才能使用，如果系统内核版本过低（2.6.39 版本内核开始支持），可能会导致该时钟类型无法识别或者返回错误的时间值。

一旦通过 `CLOCK_BOOTTIME` 获取时间失败（函数返回值为错误 `EINVAL`），则用 `clock_gettime(CLOCK_MONOTONIC, ...)` 重来一遍。`CLOCK_MONOTONIC` 与 `CLOCK_BOOTTIME` 类似，都是表示自系统启动以来经过的时间。但它们之间也存在区别，`CLOCK_MONOTONIC` 在系统挂起时会停止计时，而 `CLOCK_BOOTTIME` 则不会。`CLOCK_BOOTTIME` 更适合 libuv 和 Node.js 的 Uptime 场景。

    int uv_uptime(double* uptime) {
      // static 变量，之后再进这个函数的时候，用的都是同一个值
      static volatile int no_clock_boottime;
      
      // 读取 `/proc/uptime`
      if (0 == uv__slurp("/proc/uptime", buf, sizeof(buf)))
        if (1 == sscanf(buf, "%lf", uptime))
          return 0;
    
      if (no_clock_boottime) {
        retry_clock_gettime: r = clock_gettime(CLOCK_MONOTONIC, &now);
      }
      else if ((r = clock_gettime(CLOCK_BOOTTIME, &now)) && errno == EINVAL) {
        no_clock_boottime = 1;
        goto retry_clock_gettime;
      }
      
      ...
    }
    

从代码中我们可以看到，兜底的时候，`no_clock_boottime` 初始值为 `0`，这个时候走 `clock_gettime(CLOCK_BOOTTIME, &now)` 这段逻辑。如果走这段逻辑失败了，且 `errno` 的值为 `EINVAL`，那么进入下面的条件块，将 `no_clock_boottime` 设置为 `1`，并且通过 `goto` 语句跳转到上面的 `if (no_clock_boottime)` 条件中去，用 `CLOCK_MONOTONIC` 重新走一遍。

之后如果我们再进这个函数，鉴于 `no_clock_boottime` 是个静态变量，仍保持值为 `1`。再过来的时候直接就走到 `CLOCK_MONOTONIC` 分支了。

其实最开始 libuv 中也就是这俩逻辑，并没有 `/proc/uptime` 逻辑。OpenVZ 是一种虚拟化技术，它与宿主机共享内核，所以 `CLOCK_BOOTTIME` 得到的实际上是宿主机的 Uptime。这显然是不可接受的。所以后来 libuv 加上了从 `/proc/uptime` 中读的这个首发逻辑。

> 具体可以看[这个 Issue](https://github.com/libuv/libuv/issues/3068 "https://github.com/libuv/libuv/issues/3068")。

### `os.totalMem()` 与 `os.freeMem()`

Node.js 中这俩函数靠的是 libuv 的 `uv_get_free_memory()` 与 `uv_get_total_memory()`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/21b4a65dad4a487287937a120d1cac05~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

Linux 中有个文件，叫 `/proc/meminfo`。`/proc/meminfo` 是 Linux 系统中的一个虚拟文件，用于显示系统当前的内存使用情况和内存相关的统计信息。在该文件中，包含了多个键值对，每个键值对都表示了一种内存相关的统计信息。

下面是一些常见的内存统计信息及其含义：

*   `MemTotal`：系统中物理内存的总量；
*   `MemFree`：系统中可用的空闲内存量；
*   `Buffers`：被用来作为文件系统缓存的内存量；
*   `Cached`：被用来作为文件系统缓存的内存量；
*   `SwapTotal`：系统中交换空间的总量；
*   `SwapFree`：系统中可用的交换空间量。

一个可能的 `/proc/meminfo` 文件如下：

    $ cat /proc/meminfo
    MemTotal:        4097416 kB
    MemFree:         3283216 kB
    MemAvailable:    3992328 kB
    

你猜对了，libuv 就是通过读取这个文件达到目的的。

    static uint64_t uv__read_proc_meminfo(const char* what) {
      uint64_t rc;
      char* p;
      char buf[4096];  /* Large enough to hold all of /proc/meminfo. */
    
      if (uv__slurp("/proc/meminfo", buf, sizeof(buf)))
        return 0;
    
      p = strstr(buf, what);
    
      if (p == NULL)
        return 0;
    
      p += strlen(what);
    
      rc = 0;
      sscanf(p, "%" PRIu64 " kB", &rc);
    
      return rc * 1024;
    }
    
    uint64_t uv_get_free_memory(void) {
      struct sysinfo info;
      uint64_t rc;
    
      rc = uv__read_proc_meminfo("MemAvailable:");
    
      if (rc != 0)
        return rc;
    
      if (0 == sysinfo(&info))
        return (uint64_t) info.freeram * info.mem_unit;
    
      return 0;
    }
    

你看，通过 `uv__read_proc_meminfo` 来获取结果。`uv__read_proc_meminfo` 中，读取 `/proc/meminfo` 后，通过 `strstr` 来找到 `"MemAvailable:"` 字符串在文件内容的位置，然后跑到该文件内容加上这个键名之后，读取它的 `kB` 值，最终乘以 `1024` 了事。

如果读取失败了，再通过 `sysinfo()` 兜底。`sysinfo()` 是一个系统调用，它可以返回当前系统的一些基本信息，如内存使用情况、进程数、负载均衡等等。它在 Linux 和其他类 Unix 系统中都有支持。

通过调用 `sysinfo()` 函数，可以获取一个 `struct sysinfo` 类型的结构体，其中包含了系统的基本信息，如下所示：

    struct sysinfo {
      long uptime;             /* 系统启动时间 */
      unsigned long loads[3];  /* 1 分钟、5 分钟和 15 分钟的平均负载 */
      unsigned long totalram;  /* 总内存大小 */
      unsigned long freeram;   /* 空闲内存大小 */
      unsigned long sharedram; /* 共享内存大小 */
      unsigned long bufferram; /* 缓存大小 */
      unsigned long totalswap; /* 总交换空间大小 */
      unsigned long freeswap;  /* 空闲交换空间大小 */
      unsigned short procs;    /* 进程数量 */
      char _f[22];             /* 未使用 */
    };
    

所以兜底的时候，最终返回的是 `(uint64_t) info.freeram * info.mem_unit`。

`uv_get_total_memory()` 逻辑与 `uv_get_free_memory()` 一样，只不过传的字符串不再是 `"MemAvailable:"`，而是 `"MemTotal:"`。

### `os.release()`、`os.type()`、`os.version()` 与 `os.machine()`

这四个函数放在一起，是因为它们师出同门。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f433895f6cec4fffa9066f9bb2db8d81~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=480&h=284&s=136855&e=png&b=3c2a25)

它们都出自于 `uv_os_uname()`。出家人可以吃菌子，所以：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/79d4e89ee195476fa0611be81ce8d98a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

[uv\_os\_uname()](https://github.com/nodejs/node/blob/v18.16.0/deps/uv/src/unix/core.c#L1448-L1501 "https://github.com/nodejs/node/blob/v18.16.0/deps/uv/src/unix/core.c#L1448-L1501") 在 Linux 下，靠的是 `uname()`。`uname()` 是一个系统调用，用于获取当前系统的基本信息，例如系统名称、主机名、内核版本、处理器架构等等。在 Linux 和其他类 Unix 系统中，`uname()` 函数是一个常用的系统调用之一。

`uname()` 函数可以接受一个 `struct utsname` 类型的结构体作为参数，并将系统的基本信息存储在该结构体中，如下所示：

    struct utsname {
        char sysname[];    /* 操作系统名称 */
        char nodename[];   /* 主机名 */
        char release[];    /* 操作系统发行版号 */
        char version[];    /* 操作系统内核版本 */
        char machine[];    /* 处理器架构 */
    };
    

通过调用 `uname()` 函数，可以获取当前系统的基本信息，例如操作系统名称、主机名、内核版本、处理器架构等等。例如，以下代码可以获取当前系统的操作系统名称：

    #include <sys/utsname.h>
    #include <stdio.h>
    
    int main() {
        struct utsname info;
        if (uname(&info) == -1) {
            perror("uname");
            return 1;
        }
        printf("Operating system: %s\n", info.sysname);
        return 0;
    }
    

扫一眼上面的结构体，是不是覆盖子标题四个函数完全没问题？

    int uv_os_uname(uv_utsname_t* buffer) {
      ...
      
      if (uname(&buf) == -1) {
        错误处理;
      }
      
      r = uv__strscpy(buffer->sysname, buf.sysname, sizeof(buffer->sysname));
      ...
      r = uv__strscpy(buffer->release, buf.release, sizeof(buffer->release));
      ...
      r = uv__strscpy(buffer->version, buf.version, sizeof(buffer->version));
      ...
      r = uv__strscpy(buffer->machine, buf.machine, sizeof(buffer->machine));
      ...
    
      return 0;
    }
    

> `uv__strscpy()` 是复制字符串的意思。

这几个值统一被 Node.js 包装成 [GetOSInformation()](https://github.com/nodejs/node/blob/v18.16.0/src/node_os.cc#L77-L98 "https://github.com/nodejs/node/blob/v18.16.0/src/node_os.cc#L77-L98") 函数放到数组里给到 JavaScript 侧使用。

    static void GetOSInformation(const FunctionCallbackInfo<Value>& args) {
      ...
      uv_utsname_t info;
      int err = uv_os_uname(&info);
    
      ...
      // [sysname, version, release, machine]
      Local<Value> osInformation[] = {
          String::NewFromUtf8(env->isolate(), info.sysname).ToLocalChecked(),
          String::NewFromUtf8(env->isolate(), info.version).ToLocalChecked(),
          String::NewFromUtf8(env->isolate(), info.release).ToLocalChecked(),
          String::NewFromUtf8(env->isolate(), info.machine).ToLocalChecked()};
    
      ...
    }
    

所以，在 JavaScript 侧，就直接把它记录下来，[等待有心人来采撷](https://github.com/nodejs/node/blob/v18.16.0/lib/os.js#L86-L101 "https://github.com/nodejs/node/blob/v18.16.0/lib/os.js#L86-L101")。

    const {
      0: type,
      1: version,
      2: release,
      3: machine,
    } = _getOSInformation();
    
    const getOSRelease = () => release;
    const getOSType = () => type;
    const getOSVersion = () => version;
    const getMachine = () => machine;
    
    module.exports = {
      release: getOSRelease,
      type: getOSType,
      version: getOSVersion,
      machine: getMachine,
    };
    

### 其它函数

其它 `os` 函数在 Node.js 中也都大同小异，无非是通过 libuv 调底层的一些直接的接口，或者读取相关的文件来获取的。最多再多一些格式、换算等加工。有兴趣可自行去阅读 [Node.js 这一部分的源码](https://github.com/nodejs/node/blob/v18.16.0/src/node_os.cc "https://github.com/nodejs/node/blob/v18.16.0/src/node_os.cc")，以及其对应的 libuv 源码。

总之：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/81b4717a04804473bcbe7e7ba7675d32~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)

`os` 与 `process` 小结
-------------------

花了三章为大家铺开了 `os` 与 `process` 的一些原理。`process` 涉及的面比较广，从 Node.js 初始化流程开始，一路到它的初始化，各种黑魔法，各种注入。以及像 `env`、`uncaughtException` 这类典型内容的实现。要厘清这方面的信息，可以在阅读完前两章后，尝试自己去阅读一下 Node.js 源码试试看。

在过程中，还给大家揭露了 Node.js 中的一些性能小技巧，比如善用栈内存和堆内存的 `MaybeStackBuffer`。以及本章中提到的 `hideStackFrames()` 与 `userStackTraceLimit`。

相对来说，`os` 就简单多了。它就是用了最淳朴的方式去获取最官方的内容——读取各种文件，或者直接调用系统 API。啥也不多说了，用这张图 Callback 结束吧。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8a6e8311ef40498b93d68e2e8768c5fd~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=564&s=287198&e=png&b=121502)