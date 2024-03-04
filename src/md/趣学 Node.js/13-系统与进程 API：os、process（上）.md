在 Node.js 中，`process` 对象提供有关当前 Node.js 进程的信息和控制。而 `os` 模块提供了与操作系统相关的实用方法和属性。一个是当前进程相关内容，一个是一些系统操作级的 API。这俩货一个比较依赖 V8，一个比较依赖 libuv，本章给大家剖析一下其中一些 API 的原理吧。

`process`
---------

### `process` 的初始化时机

`process` 是 `globalThis` 下的一个对象，在 Node.js 初始化阶段就被搞定。在最近的一些版本中，这一块初始化的时机有经过一系列重构，将该对象的初始化引入了一个叫 `Realm` 的类中。该类是 Node.js 踏向 [ShadowRealm](https://www.zhihu.com/question/507404363/answer/2282856031 "https://www.zhihu.com/question/507404363/answer/2282856031") 支持的其中一步。

> #### `Environment` 与 `Realm`
> 
> 在 Node.js 中，`ShadowRealm` 的支持是由 Node.js TSC 之一[吞吞大佬](https://github.com/legendecas "https://github.com/legendecas")主导的。有关 `ShadowRealm` 的设计文档，可以参阅 [docs.google.com/document/d/…](https://docs.google.com/document/d/12_CkX6KbM9kt_lj1pdEgLB8-HQaozkJb7_nwQnHfTTg "https://docs.google.com/document/d/12_CkX6KbM9kt_lj1pdEgLB8-HQaozkJb7_nwQnHfTTg") 。
> 
> 如果要深入到这一段来，建议大家先都去了解什么是 `ShadowRealm`。无论是去看 Spec，还是网上找类似的资料。这里如果要讲，就太长了。
> 
> 设计中，有提到 `Realm` 类。`Realm` 分如下两种。
> 
> 1.  **主域** **`Realm`**：自带宿主实现的一系列全局 API，可简单粗暴理解为 Node.js 自带的全局内容；
> 2.  **附属** **`Realm`**：由 `ShadowRealm` API 创建的、仅包含少量全局对象的 `Realm`。
> 
> 吞吞在设计文档中这两个英文原文为 principal realm 和 synthetic realm，我并未找他求证他对其的中文翻译是什么，仅凭自己语感乱翻译的。
> 
> 至少在 Node.js v18.15.0 中，还只实现了主域 `Realm`，为未来完整实现 `ShadowRealm` 迈出设计文档中的一步。而就是在主域 `Realm` 的实现中，`process` 对象的初始化被挪到了主域 `Realm` 的初始化中。

首先，我们之前提到过 Node.js 的 `Environment` 类，存储一些 Node.js 自身全局环境相关的信息。主域 `Realm` 就被存储在 `Environment` 中，在 Node.js 创建 `Environment` 对象阶段，在其初始化 V8 主 `Context` 的时候会初始化 `Realm`：

    class Environment : public MemoryRetainer {
      ...
      
      std::unique_ptr<Realm> principal_realm_ = nullptr;
    };
    
    void Environment::InitializeMainContext(...) {
      ...
      principal_realm_ = std::make_unique<Realm>(
          this, context, MAYBE_FIELD_PTR(env_info, principal_realm));
      ...
    }
    

Node.js v18.15.0 中，在 `Realm` 的[构造函数](https://github.com/nodejs/node/blob/v18.15.0/src/node_realm.cc#L24 "https://github.com/nodejs/node/blob/v18.15.0/src/node_realm.cc#L24")中，会通过 `CreateProperties()` 初始化 Node.js 的 `process` 对象：

    Realm::Realm(...) ... {
      context_.Reset(isolate_, context);
    
      // Create properties if not deserializing from snapshot.
      // Or the properties are deserialized with DeserializeProperties() when the
      // env drained the deserialize requests.
      if (realm_info == nullptr) {
        CreateProperties();
      }
    }
    

而刚才也说了，实现主域 `Realm` 只是第一步，吞吞在[后续提交](https://github.com/nodejs/node/commit/e6b4d30a2f8ff0b43bbfd98e0e9f3a15438a4952 "https://github.com/nodejs/node/commit/e6b4d30a2f8ff0b43bbfd98e0e9f3a15438a4952")（截止写文这会儿尚未落地到任何版本的 Node.js 中）中又显式拆出了主域 `Realm` 的相关逻辑。在那个提交中，这个 `CreateProperties()` 被挪到了 `Realm` 类的子类 `PrincipleRealm` 的构造函数中：

    PrincipalRealm::PrincipalRealm(...) ... {
      // Create properties if not deserializing from snapshot.
      // Or the properties are deserialized with DeserializeProperties() when the
      // env drained the deserialize requests.
      if (realm_info == nullptr) {
        CreateProperties();
      }
    }
    

在 `CreateProperties()` 中，Node.js 初始化了 `process` 对象，并将其持久化到 `Environment` 中。

    void Realm::CreateProperties() {
      ...
      Local<Object> process_object =
          node::CreateProcessObject(this).FromMaybe(Local<Object>());
      set_process_object(process_object);
    }
    

前后追溯一下，我们可以得到这么一张简化的阶段的图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa0707ef1e4a4d7998deeb3c4ae29f4d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2526&h=2874&s=328322&e=png&b=fffefe)

上图是不使用 Snapshot 的步骤，我做了一些剪枝，仅保留一些值得一提的步骤。其实里面还蕴含了各种被我略过的其它一些步骤。我们从图中可以看到，`process` 创建的路径是在一个叫 `NodeMainInstance` 的对象构造完毕，要开始 `Run` 的时候创建的。这个 `NodeMainInstance` 可以理解为 Node.js 实例在代码中的抽象。`Run` 的目的是进入事件循环，然后按第二章、第三章讲的内容那样开始正式执行。在进入事件循环之前，经过一系列构造 Environment 对象的操作之后，通过 `Environment::InitializeMainContext()` 去构造主域 `Realm`，并在该阶段创建好 `process` 对象。然后再执行 Node.js 中的内置 `bootstrap.js`，拉起 Node.js 的内部脚本初始化。前面做了这么多幕后准备工作，接下去事件循环阶段才是 Node.js 拉开帷幕表演的时候。

### `process` 的初始化

通过前文，我们知道了 `process` 对象初始化的时机。那么 `process` 的初始化又究竟做了些什么呢？首先是简单粗暴理解为有一个**空的`process`类**，并[实例化一个对象](https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#LL86-L93C4 "https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#LL86-L93C4")：

      Local<FunctionTemplate> process_template = FunctionTemplate::New(isolate);
      process_template->SetClassName(realm->env()->process_string());  // env()->process_string() 的值为 `"process"`
      Local<Function> process_ctor;
      Local<Object> process;
      if (!process_template->GetFunction(context).ToLocal(&process_ctor) ||
          !process_ctor->NewInstance(context).ToLocal(&process)) {
        return MaybeLocal<Object>();
      }
    

这段代码可以糙糙地认为等同于：

    class process {}
    const process = new process();
    
    // 忽略这里的 class 和 process 同名的语法错误，只是代码逻辑平移。
    //   1. 类名的确是 `process`；
    //   2. C++ 里面那个实例化对象的变量名也的确是 `process`。
    

如果不想理解上面的代码，仅验证正确性，可以通过下面一段 JavaScript 代码来查看结果：

    console.log(process.constructor.name);  // process
    console.log(new process.constructor());  // process {}
    

接下去，为这个空的实例化对象手动补足各种成员变量和成员函数。

#### `process.version` 与 `process.versions`

Node.js 的 C++ 头文件中，有一个 `node_version.h`（[github.com/nodejs/node…](https://github.com/nodejs/node/blob/v18.15.0/src/node_version.h "https://github.com/nodejs/node/blob/v18.15.0/src/node_version.h") ）。该文件针对不同版本都用宏定义了版本号。比如 v18.15.0，就像这样：

    #define NODE_MAJOR_VERSION 18
    #define NODE_MINOR_VERSION 15
    #define NODE_PATCH_VERSION 0
    
    ...
    
    # define NODE_VERSION_STRING  NODE_STRINGIFY(NODE_MAJOR_VERSION) "." \
                                  NODE_STRINGIFY(NODE_MINOR_VERSION) "." \
                                  NODE_STRINGIFY(NODE_PATCH_VERSION)     \
                                  NODE_TAG
                                  
    ...
    
    #define NODE_VERSION "v" NODE_VERSION_STRING
    

最终，这个 `NODE_VERSION` 宏所代表的字符串就是 `"v18.15.0"`。为什么我要提这货呢？`process.version` 就是从这儿来的。我们之前说了，在实例化 `process` 对象后，Node.js 会手动往里面填充对应的成员，`process.version` 的填充如下：

      // process.version
      READONLY_PROPERTY(
          process, "version", FIXED_ONE_BYTE_STRING(isolate, NODE_VERSION));
    

这段代码翻译成 JavaScript 相当于：

    Object.defineProperty(process,
                          'version',
                          {
                            value: 'v15.8.0',
                            writable: false,
                            configurable: true,
                            enumerable: true,
                          });
    

现在，大家知道 `process.version` 哪来，以及什么时候来了吧？`process.versions` 类似，不过稍微复杂一些。既然 Node.js 有这么个版本相关的宏，其实大部分其它的三方依赖也都有类似的东西，比如 V8 用的 `v8::V8::GetVersion()`；libuv 用的 `uv_version_string()`；zlib 用的则是 `ZLIB_VERSION` 等。Node.js 中有一个 [Metadata 的对象](https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.cc#L38 "https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.cc#L38")，构造的时候会初始化一个 [Version 对象](https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.h#L121 "https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.h#L121")，而在 `Version` 对象构造的时候，会把[相关内容的版本号一一记录下来](https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.cc#L74-L118 "https://github.com/nodejs/node/blob/v18.15.0/src/node_metadata.cc#L74-L118")。由于 `Metadata` 是一个全局变量，所以它的初始化时间是在 C++ `main` 函数之前。所以在 Node.js 进程一启动的时候，`Metadata` 里面的各版本信息都已经格式化在案了。然后紧跟着刚才 `process.version` 初始化之后，就是 [process.versions 的初始化](https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#L108-L118 "https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#L108-L118")：

      // process.versions
      Local<Object> versions = Object::New(isolate);
      READONLY_PROPERTY(process, "versions", versions);
    
    #define V(key)                                                                 \
      if (!per_process::metadata.versions.key.empty()) {                           \
        READONLY_STRING_PROPERTY(                                                  \
            versions, #key, per_process::metadata.versions.key);                   \
      }
      NODE_VERSIONS_KEYS(V)
    #undef V
    

翻译成 JavaScript 伪代码就是：

    const versions = {};
    Object.defineProperty(process,
                          'versions',
                          {
                            value: versions,
                            writable: false,
                            configurable: true,
                            enumerable: true,
                          });
    
    for (const key of <Metadata.version 中的 key>) {
      Object.defineProperty(versions,
                            key,
                            {
                              value: <Metadata.version 对应 key 的值>,
                              writable: false,
                              configurable: true,
                              enumerable: true,
                            });
    }
    

#### `process.arch`、`process.platform` 与 `process.release`

这仨成员原理与 `process.versions` 类似。`Metadata` 在初始化的时候，同样会初始化它的 `arch`、`platform` 与 `release` 信息，然后在 `process` 初始化阶段给[赋值过去](https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#L120-L143 "https://github.com/nodejs/node/blob/v18.15.0/src/node_process_object.cc#L120-L143")。

在 `Metadata` 中的这几个变量都是由对应的宏而来。这几个宏在 Node.js 项目构建编译阶段，根据不同的系统、架构等，通过脚本传进去。如 `arch` 对应的是 `NODE_ARCH` 宏，就是在 [node.gyp 中定义好的](https://github.com/nodejs/node/blob/v18.15.0/node.gyp#L144-L148 "https://github.com/nodejs/node/blob/v18.15.0/node.gyp#L144-L148")，GYP 会根据构建目标的系统和架构等给予不同的值：

    ...
    'defines': [
      'NODE_ARCH="<(target_arch)"',
      'NODE_PLATFORM="<(OS)"',
      'NODE_WANT_INTERNALS=1',
    ],
    ..
    

> 关于 GYP 的一些知识，可查看 [GYP 官网](https://gyp.gsrc.io/ "https://gyp.gsrc.io/")，或者翻阅《Node.js：来一打 C++ 扩展》。不过在本章中并不重要，只需要知道这是在构建阶段就写死的就好了。

至此，`process` 对象就初始化完成了。咦？怎么就那么点东西？因为 `process` 对象里的内容是一块块搞定的，初始化阶段只搞定上面的这些内容。其它那些方法、变量等内容则是在其它阶段给注入的。

### `Realm::RunBootstrapping()`

我们在 `process` 初始化时机中提到，一系列准备后，道具组会给出 `Environment` 及其附带的主域 `Realm`，`process` 就是在这段期间被初始化的。`process` 初始化完毕之后，主域 `Realm` 会执行 `RunBootstraping()` 拉起 Node.js 内部准备脚本，热了场子后，才会拉开帷幕登上舞台。

`RunBootstrapping()` 本质上就是执行 `internal/bootstrap/node.js`、`internal/bootstrap/switches/is_main_thread.js`、`internal/bootstrap/switches/does_own_process_state.js` 几个文件，以及设置 `process.env`。在执行这几个 JavaScript 文件的时候，传了 `process`、`require`、`internalBinding` 以及 `primordial` 四个参数进去。这个 `process` 就是刚才初始化好的 `process` 对象了，而 `require` 是 bootstrap 阶段的 `require`，虽然行为相似，但它与我们日常所使用的 `require` 不是一回事，不过这不重要。

#### `setupProcessObject()`

在 `node.js` 这个文件中，执行了一个 [setupProcessObject() 函数](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L82 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L82")，这里面做了几件事：

1.  将 `process` 改为继承自 [EventEmitter](https://nodejs.org/dist/latest-v18.x/docs/api/events.html "https://nodejs.org/dist/latest-v18.x/docs/api/events.html")；
    
2.  将 `process` 挂在 `globalThis` 下。
    

这里可以出一个面试题，怎么将某个已实例化的对象改个继承？敲黑板：`Object.setPrototypeOf()`（[developer.mozilla.org/en-US/docs/…](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf") ）。不过这种做法是会产生副作用的，就是对应对象的原型也会受影响。不过由于 `process` 的原型只在 `Realm` 相应地方临时拿出来实例化 `process` 一下，所以副作用也无伤大雅。

关于改继承，Node.js 是这么做的：

      const EventEmitter = require('events');
      const origProcProto = Object.getPrototypeOf(process);
      Object.setPrototypeOf(origProcProto, EventEmitter.prototype);
      Function.prototype.call(EventEmitter, process);
    

前三行是改原型链继承关系，第四行代码是以 `process` 为 `this` 去调用 `EventEmitter` 构造函数——相当于 `process` 执行一下 `super()`。这种做法大家在 Node.js 中的 `util.inherits()` 也能看到类似的。

至于为什么要让 `process` 继承自 `EventEmitter`，这个问题其实看看 `process` 有哪些能力就知道了：`process.on('uncaughtException', ...)`。

关于挂载 `globalThis`，Node.js 则是这么做的：

    let _process = process;
    Object.defineProperty(globalThis, 'process', {
      __proto__: null,
      get() {
        return _process;
      },
      set(value) {
        _process = value;
      },
      enumerable: false,
      configurable: true,
    });
    

没什么过多要解释的。

#### `process` 中的方法们

##### `process_methods` 与 `node_credentials`

Node.js 中，在 C++ 侧实现了 `process` 中的各种进程操作的方法们，如 `process.cpuUsage()`。实现了之后，在 JavaScript 侧将其一一挂载到 `process` 对象上，下面这段挂载的操作同样是在 `node.js` 这个文件中进行的。这些方法[包括](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L184-L223 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L184-L223")：

    // Set up methods on the process object for all threads
    {
      process.dlopen = rawMethods.dlopen;
      process.uptime = rawMethods.uptime;
    
      // TODO(joyeecheung): either remove them or make them public
      process._getActiveRequests = rawMethods._getActiveRequests;
      process._getActiveHandles = rawMethods._getActiveHandles;
      process.getActiveResourcesInfo = rawMethods.getActiveResourcesInfo;
    
      // TODO(joyeecheung): remove these
      process.reallyExit = rawMethods.reallyExit;
      process._kill = rawMethods._kill;
    
      const wrapped = perThreadSetup.wrapProcessMethods(rawMethods);
      process._rawDebug = wrapped._rawDebug;
      process.cpuUsage = wrapped.cpuUsage;
      process.resourceUsage = wrapped.resourceUsage;
      process.memoryUsage = wrapped.memoryUsage;
      process.constrainedMemory = rawMethods.constrainedMemory;
      process.kill = wrapped.kill;
      process.exit = wrapped.exit;
    
      process.hrtime = perThreadSetup.hrtime;
      process.hrtime.bigint = perThreadSetup.hrtimeBigInt;
    
      process.openStdin = function() {
        process.stdin.resume();
        return process.stdin;
      };
    }
    
    const credentials = internalBinding('credentials');
    if (credentials.implementsPosixCredentials) {
      process.getuid = credentials.getuid;
      process.geteuid = credentials.geteuid;
      process.getgid = credentials.getgid;
      process.getegid = credentials.getegid;
      process.getgroups = credentials.getgroups;
    }
    

比如 `process.kill()`，底层用的是 `uv_kill()`；比如 `process.cpuUsage()`、`process.emoryUsage()` 以及 `process.resourceUsage()`，底层就是通过 libuv 的 `uv_getrusage()` 来获取的。关于 `uv_getruage()` 的 [libuv 文档](http://docs.libuv.org/en/v1.x/misc.html#c.uv_getrusage "http://docs.libuv.org/en/v1.x/misc.html#c.uv_getrusage")内容如下：

> ###### int **`uv_getrusage`**([uv\_rusage\_t](http://docs.libuv.org/en/v1.x/misc.html#c.uv_rusage_t "http://docs.libuv.org/en/v1.x/misc.html#c.uv_rusage_t") \*_rusage_)
> 
> Gets the resource usage measures for the current process.
> 
> **Note**
> 
> On Windows not all fields are set, the unsupported fields are filled with zeroes. See [uv\_rusage\_t](http://docs.libuv.org/en/v1.x/misc.html#c.uv_rusage_t "http://docs.libuv.org/en/v1.x/misc.html#c.uv_rusage_t") for more details.

文档中说了，Windows 下，不是所有字段都能获取的，不能获取的则留 `0`。我们再回过头来看 [resourceUsage() 文档](https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processresourceusage "https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processresourceusage")：

*   ……
    
*   `majorPageFault` [`<integer>`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type") maps to `ru_majflt` which is the number of major page faults for the process, see [this article for more details](https://en.wikipedia.org/wiki/Page_fault#Major "https://en.wikipedia.org/wiki/Page_fault#Major"). **This field is not supported on Windows**.
    
*   `voluntaryContextSwitches` [`<integer>`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type") maps to `ru_nvcsw` which is the number of times a CPU context switch resulted due to a process voluntarily giving up the processor before its time slice was completed (usually to await availability of a resource). **This field is not supported on Windows**.
    
*   `involuntaryContextSwitches` [`<integer>`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type") maps to `ru_nivcsw` which is the number of times a CPU context switch resulted due to a higher priority process becoming runnable or because the current process exceeded its time slice. **This field is not supported on Windows**.
    
*   ……
    

是不是好像明白了什么？

再看看 `get*id()` 系列的 API，里面有个分支判断：`credentials.implementsPosixCredentials`。说明是 POSIX 系列的才有这堆 API。这也印证了 [Node.js 文档](https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processgetuid "https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processgetuid")：

> This function is only available on POSIX platforms (i.e. not Windows or Android).

而像 `process.getuid()` 这个 API，底层用的就是 POSIX 的 [getuid()](https://man7.org/linux/man-pages/man2/getuid.2.html "https://man7.org/linux/man-pages/man2/getuid.2.html")。

    static void GetUid(const FunctionCallbackInfo<Value>& args) {
      Environment* env = Environment::GetCurrent(args);
      CHECK(env->has_run_bootstrapping_code());
      // uid_t is an uint32_t on all supported platforms.
      args.GetReturnValue().Set(static_cast<uint32_t>(getuid()));
    }
    

这一节中的方法们分别位于 [src/node\_credentials.cc](https://github.com/nodejs/node/blob/v18.15.0/src/node_credentials.cc "https://github.com/nodejs/node/blob/v18.15.0/src/node_credentials.cc") 和 [src/node\_process\_methods.cc](https://github.com/nodejs/node/blob/v18.15.0/src/node_process_methods.cc "https://github.com/nodejs/node/blob/v18.15.0/src/node_process_methods.cc") 中。有兴趣的同学可自行前往翻阅源码。大多都是直接调用系统 API 或者 libuv 的相关 API 来实现的。

##### 其它一些方法

在 `Realm::RunBootstrapping()` 阶段，还有一些方法会被挂载到 `process` 上——但不是全部。饭要一口一口吃。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8583566b687a4178bbddcb8f8918e242~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=440&h=440&s=317229&e=png&b=895e3e)

*   `process.allowedNodeEnvironmentFlags`（[L259-L280](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L259-L280 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L259-L280")）；
    
*   `process.assert()`（[L282-L286](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L282-L286 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L282-L286")）；
    
*   `process.emitWarning()`（[L335-L336](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L335-L336 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L335-L336")）；
    
*   `process.nextTick()`（[L338-L361](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L338-L361 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L338-L361")）；
    
*   `process.setUncaughtExceptionCaptureCallback()` 等（[L315-L333](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L315-L333 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/node.js#L315-L333")）。
    

要是换做网上的文章，或者谁书里写了上面这么段话，我估摸着网上的尿性，有面试题会出：**`process`** **上的哪些方法、变量是在** **Node.js** **的 Bootstrapping 阶段挂载的？请列举出来。** 毕竟八股不就是这么来的？

但我觉得这种问题真没什么用。其实要不是为了严谨，我完全可以这么写：**有部分方法会在 Bootstrapping 阶段挂载，具体是哪些方法不重要，大家心里有个概念就好，具体事项具体分析，真要到追溯的时候，可以自己去看** **`internal/bootstrap/node.js`** **源码，** **`process.`** **前缀啪一搜就搜到了**。事实上我就是这么做的，写这段的时候我也不知道有哪些方法，我就是直接打开搜一下，然后复制过来。复制完之后我就忘了🤪。

#### 主线程 Bootstrap 阶段

以前的 Node.js 在面上是单线程的，直到出现了 `worker_threads`。Node.js 为 `worker_threads` 的出现做了很多改造，其中就有 Bootstrap 阶段。

我们先前讲的 `internal/bootstrap/node.js` 是所有情况下都要执行的 Bootstrap 脚本。如果是最开始的初始化，紧跟着是执行主线程 Bootstrap 脚本（`internal/bootstrap/switches/is_main_thread.js`）；若是类似 `worker_threads` 这种执行，Node.js 会为其重新创建一套 V8 的 `Context` 以及 Node.js 的 `Environment`，然后又是一套新的 `process`，这个时候后续走的就是 Worker 线程的 Bootstrap 脚本了（`internal/bootstrap/switches/is_worker_thread.js`）。所以**对于 Node.js 来说，主线程与每个 Worker 现成的执行上下文都不同，** **`process`** **也是不同的实例，需要重新走一遍上面的流程进行初始化**。

在 `is_main_thread` 这个 Bootstrap 阶段，对于 `process` 主要是为一些事件做上一些默认的监听，如：

    // Worker threads don't receive signals.
    const {
      startListeningIfSignal,
      stopListeningIfSignal
    } = require('internal/process/signal');
    process.on('newListener', startListeningIfSignal);
    process.on('removeListener', stopListeningIfSignal);
    

Worker 线程的我们就不讨论了。根据上面代码的注释，我们也能看到一些端倪，主线程的 `process` 会接收 `SIGNAL` 的变更事件，而 Worker 线程则不，这是他们的区别。

> ##### 冷知识——玩坏 `process.on('<SIGNAL>')`
> 
> 从上面我们能看出来，Node.js 在接收到各种 signal 的时候，是通过 `process` 的 [newListener 事件](https://nodejs.org/dist/latest-v18.x/docs/api/events.html#event-newlistener "https://nodejs.org/dist/latest-v18.x/docs/api/events.html#event-newlistener")来做的。当我们在 `process` 上监听任意 signal 事件（如 `SIGALRM`）时，根据 `EventEmitter` 的特性会自动触发 `newListener` 事件。Node.js 在这里面判断监听的事件名是否是某一个 signal，如果是，则通过内部的 `Signal` 逻辑来监听事件。而子线程的逻辑中则不开启这个事件监听，所以子线程的 `process` 中不会对 signal 进行响应。
> 
>     function startListeningIfSignal(type) {
>       if (isSignal(type) && !signalWraps.has(type)) {
>         if (Signal === undefined)
>           Signal = internalBinding('signal_wrap').Signal;
>         const wrap = new Signal();
>     
>         wrap.unref();
>     
>         wrap.onsignal = FunctionPrototypeBind(process.emit, process, type, type);
>     
>         const signum = signals[type];
>         const err = wrap.start(signum);
>         if (err) {
>           wrap.close();
>           throw errnoException(err, 'uv_signal_start');
>         }
>     
>         signalWraps.set(type, wrap);
>       }
>     }
>     
> 
> 当我们 `process.on('SIGALRM', () => {})` 时，`EventEmitter` 是会触发 `newListener` 事件，并且第一个参数是 `'SIGALRM'`。可以看到，在这个监听回调中，首先判断事件监听的值是否是 signal 的名字（如 `SIGALRM`）。如果是，则通过 C++ 侧的 `Signal` 监听器 `wrap` 开始监听信号，如果信号触发了，`Signal` 监听器是会最终触发 `wrap.onsignal` 回调的，而这个 `wrap.onsignal` 即是 `process.emit('SIGALRM', ...)`。

![14飞书图片1.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6172f128ad0f453d89078173d550ce0f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1850&h=310&s=119808&e=png&b=d6e1f3)

> 既然 `process` 的这块内容是通过 `newListener` 事件搞定的，那么只要我们把这个事件对应的 `startListeningIfSignal` 移除，我们后续再监听 `SIGALRM` 就不会生效了。如：
> 
>     process.shift(process._events.newListener);
>     process.on('SIGALRM', () => console.log('alarm'));
>     
> 
> 这相当于：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d63c88218cad4fb098fb5473cc23faf3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=500&s=126435&e=png&b=fdfdfd)

> 在上面那张图上做修改，就是：

![14飞书图片2.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d344ab5bbe44dbebbcf482b68c78f62~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1846&h=404&s=131136&e=png&b=fdfdfd)

> 我们如果给这个 Node.js 发送 SIGALRM 信号的话，Node.js 的 JavaScript 侧是没有触发对真实 signal 信号的监听的函数，即 `startListeningIfSignal`，这个时候是没有 C++ 侧的 `Signal` 为其进行信号监听的，所以直接就是默认的接收信号逻辑——直接退出。
> 
>     [1]    <PID> alarm      node
>     

在 `internal/bootstrap/switches/is_main_thread.js` 之后，就是 `internal/bootstrap/switches/does_own_process_state.js` 了。这里面是挂载更多的 `process` 成员。在 Worker 线程中，`process.initgroups` 这类 Setter 是不开放的，所以一系列函数都是[设置成 unavailable](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/switches/does_not_own_process_state.js#L6-L20 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/bootstrap/switches/does_not_own_process_state.js#L6-L20")。而在主线程中，我们要把这类 Setter 个设置上去。

    process.abort = rawMethods.abort;
    process.umask = wrappedUmask;
    process.chdir = wrappedChdir;
    process.cwd = wrappedCwd;
    
    if (credentials.implementsPosixCredentials) {
      const wrapped = wrapPosixCredentialSetters(credentials);
    
      process.initgroups = wrapped.initgroups;
      process.setgroups = wrapped.setgroups;
      process.setegid = wrapped.setegid;
      process.seteuid = wrapped.seteuid;
      process.setgid = wrapped.setgid;
      process.setuid = wrapped.setuid;
    }
    

这就是我们在 `internal/bootstrap/node.js` 中光看到了 `process.get*id()`，而没有 `process.set*id()` 的原因——要根据主子线程分别对待。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/de31d467a5d34b55a3ed3ccdb516d787~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=600&h=556&s=139958&e=png&b=fefdfd)

本章小结
----

本章为大家介绍了 `process` 是怎么来的。它是一个 C++ 层面创建的 `process` 类的空对象，并在创建后强行继承自 `EventEmitter`。

`process` 的初始化被追溯到 Node.js 的 Bootstrap 阶段，至于各种阶段都是怎么推导出来的，基本上看源码能看明白，此处就为大家直接把结果梳理成一张树形图。在该阶段，会往 `process` 上挂载一些成员变量和成员方法。有些是直接在 C++ 侧包了一层 libuv 的实现，而有些则是 JavaScript 侧深度封装的内容，如 `process.nextTick()`，这个我们在之前已经详细讲述过了。

所以 `process` 对象并不是类似这样的方式：

    class process {
      constructor() {
        this.version = ...;
      }
    
      nextTick() { ... }
      uptime() { ... }
    }
    
    globalThis.process = new process();
    

它实际上是类似这样的：

    class process {}
    ...
    
    const process = new process();  // 忽略类、变量同名的语法错误
    
    ...
    <强行改 process 继承关系自 EventEmitter>;
    globalThis.process = process;
    ...
    
    process.<xxx> = xxx;
    process.<yyy> = yyy;
    
    process.on(...);
    

> **思考题：** 为什么这里要 `process = new process()`，而不是 `process = {}`？

之后的章节中，会为大家详细讲讲 `process` 的 `env`、`uncaughtException` 等内容。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8f91654696b1488492d0275feaa6f6d4~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=658&h=370&s=54312&e=png&b=faf8f8)