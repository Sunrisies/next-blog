> 之前老拖堂，我决定尝试一章内简单讲完它，不再拖堂。如果最终还是拆章了，我再把这段话划掉。（恼

`vm` 是 Node.js 中很重要的一个内置模块，除了给开发者自行使用之外，它还是 Node.js 中实现 CommonJS 的基础。

内置模块里的 `vm`
-----------

接下去，让我们打开[第六章](https://juejin.cn/book/7196627546253819916/section/7197301586174869537 "https://juejin.cn/book/7196627546253819916/section/7197301586174869537")，复习一下。

> 在用户模块代码加上前后缀后，早年间是通过 `vm` 中的 `Script` 类生成了脚本对象，然后通过执行它得到对应的函数。

因为早年间 Node.js 的机制，用户是可以 Hack 进去做一些事情的。我们再回到[第五章](https://juejin.cn/book/7196627546253819916/section/7198603743657459715 "https://juejin.cn/book/7196627546253819916/section/7198603743657459715")，复习一下。

> 这其中首先就是为得到的代码内容加上前后缀，[得到模块函数源码](https://github.com/nodejs/node/blob/v18.14.0/lib/internal/modules/cjs/loader.js#L1127 "https://github.com/nodejs/node/blob/v18.14.0/lib/internal/modules/cjs/loader.js#L1127")：
> 
>     let wrap = function(script) {
>       return Module.wrapper[0] + script + Module.wrapper[1];
>     };
>     
>     ...
>     const wrapper = [
>       '(function (exports, require, module, __filename, __dirname) { ',
>       '\n});',
>     ];
>     
>     ...
>     const wrapper = Module.wrap(content);
>     

当我们打开 Node.js REPL，可以看到我们可以通过 `module` 模块拿到这个 `wrapper` 和 `wrap` 的。既然能拿到 `wrapper`，我们就能去 Hack 它。举个最简单的例子，我们写两个文件，分别为 `index.js` 和 `mod.js`：

    // index.js
    require('module').wrapper[0] = '(function (exports, require, module, __filename, __dirname) { exports.hacked = true; ';
    console.log(require('./mod'));
    
    // mod.js
    exports.foo = 'bar';
    

这个时候我们通过 Node.js 执行 `index.js`，能看到如下输出：

    { hacked: true, foo: 'bar' }
    

而这种 Hack 是直接通过 `internalCompileFunction()`（下文中会提到该函数）无法注入进去的。回到第六章看，可以看到对于该函数来说，我们传的是用户模块代码本身，不会加上 `wrapper` 前后缀的。但是社区上不乏这类进行 Hack 的包，为了保证这类包在新版本的 Node.js 仍可以正常运行，Node.js 对这种用法做了一个向下兼容——一旦 `module` 模块中的 `wrap` 或者 `wrapper` 被修改，则最终编译用户模块的时候不通过 `internalCompileFunction()` 来，而是 Fallback 回古早的 `vm` 模式。

### 古早方案——`vm`

这种 Fallback 机制是通过指定 `setter` 和 `getter` 来的。一旦内容通过 `setter` 被修改，则将一个内部标识 `patched` 设置为 `true`。[就像这样](https://github.com/nodejs/node/blob/v18.16.0/lib/internal/modules/cjs/loader.js#L266-L314 "https://github.com/nodejs/node/blob/v18.16.0/lib/internal/modules/cjs/loader.js#L266-L314")：

    let patched = false;
    
    ObjectDefineProperty(Module, 'wrapper', {
      __proto__: null,
      get() {
        return wrapperProxy;
      },
    
      set(value) {
        patched = true;
        wrapperProxy = value;
      },
    });
    

所以我们 `require('module').wrapper = ...` 的时候，就会将 `patched` 变为 `true`。而在编译模块的时候，如果该值为 `true`，则 [Fallback 回古早方案](https://github.com/nodejs/node/blob/v18.16.0/lib/internal/modules/cjs/loader.js#L1152-L1202 "https://github.com/nodejs/node/blob/v18.16.0/lib/internal/modules/cjs/loader.js#L1152-L1202")。

    function wrapSafe(filename, content, cjsModuleInstance) {
      if (patched) {
        const wrapper = Module.wrap(content);
        const script = new Script(wrapper, {
          filename,
          lineOffset: 0,
          importModuleDynamically: async (specifier, _, importAssertions) => {
            const loader = asyncESM.esmLoader;
            return loader.import(specifier, normalizeReferrerURL(filename),
                                 importAssertions);
          },
        });
    
        // Cache the source map for the module if present.
        if (script.sourceMapURL) {
          maybeCacheSourceMap(filename, content, this, false, undefined, script.sourceMapURL);
        }
    
        return script.runInThisContext({
          displayErrors: true,
        });
      }
      
      // 新逻辑
    }
    

而这段 `patched` 条件内部的逻辑，就是 Node.js 以前的内置模块编译逻辑。步骤很简单：

1.  将用户代码加上前后缀；
2.  通过 `vm` 模块将拼接后的代码编译成 `Script` 对象；
3.  通过 `script.runInThisContext()` 执行该脚本，并获取脚本结果。

> 这里关于 `Script` 的用法若不了解，可先自行翻阅 Node.js 关于 [vm 模块的文档](https://nodejs.org/dist/latest-v18.x/docs/api/vm.html "https://nodejs.org/dist/latest-v18.x/docs/api/vm.html")。

### 新时代方案——与之同源的 `internalCompileFunction()`

第六章中，我们有说过，为什么新时代不使用 `Script` 来做了，而是再搞一个新的函数来进行编译。

> 拼接而成的 `Script` 类对应的脚本对象有个问题，会影响到错误堆栈，毕竟错误堆栈中展示的行号可能会多出一行，或者首行会变成前缀内容（详见[此 Issue](https://github.com/nodejs/node/issues/17396 "https://github.com/nodejs/node/issues/17396")）。聪明的人们学会了通过其它方式来编译这么个函数——不走 `Script`，而是用 C++ 侧的对应函数 `compileFunction()`。

我们在前文中提到的 `internalCompileFunction()` 最终就是去调用 C++ 侧的 `compileFunction()`。我们后文会继续深入。现在先来看看 `patched` 之外的逻辑：

    function wrapSafe(filename, content, cjsModuleInstance) {
      if (patched) {
        ...
      }
      
      try {
        const result = internalCompileFunction(content, [
          'exports',
          'require',
          'module',
          '__filename',
          '__dirname',
        ], {
          filename,
          importModuleDynamically(specifier, _, importAssertions) {
            const loader = asyncESM.esmLoader;
            return loader.import(specifier, normalizeReferrerURL(filename),
                                 importAssertions);
          },
        });
    
        // Cache the source map for the module if present.
        if (result.sourceMapURL) {
          maybeCacheSourceMap(filename, content, this, false, undefined, result.sourceMapURL);
        }
    
        return result.function;
      } catch (err) {
        if (process.mainModule === cjsModuleInstance)
          enrichCJSError(err, content);
        throw err;
      }
    }
    

可以看到，后面的代码基本一致，古早的方案中是通过 `Script` 及其 `.runInThisContext()` 搞定，而新版方案中则通过 `internalCompileFunction()` 一步到位。由于没有前后拼接的代码，错误堆栈问题得到了解决。

为了验证错误堆栈，我们可以做个尝试，将上一节中的 `mod.js` 改为抛错：

    // mod.js
    throw new Error('🤡');
    

执行一遍 `index.js` 看看：

    /foo/mod.js:1
    (function (exports, require, module, __filename, __dirname) { exports.hacked = true; throw new Error('🤡');
                                                                                         ^
    
    Error: 🤡
        at Object.<anonymous> (/foo/mod.js:1:92)
        ...
    

看吧，错误堆栈指向的位置藏不住了！

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60b0da075ba94d6591bc2b5a8a617914~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=815&h=763&s=409279&e=png&b=d5c5ae)

但我们如果把 `index.js` 中第一行的 Hack 去掉，让模块加载走新版逻辑，那么就不会有这个问题。

    // index.js
    console.log(require('./mod'));
    

再执行一遍 Node.js 看看：

    /foo/mod.js:1
    throw new Error('🤡');
    ^
    
    Error: 🤡
        at Object.<anonymous> (/foo/mod.js:1:7)
        ...
    

引子讲完，进入正题。

上下文——`ContextifyContext`
------------------------

在 Node.js 的 `vm` 模块中，有一个概念是 `ContextifyContext`。一个 `ContextifyContext` 对应一个沙箱上下文，即对应一个 `globalThis` 对象。随便怎么修改一个 `Context` 的 `globalThis` 下的字段是不会影响到其它 `ContextifyContext` 的——这是它的隔离性。

但是它的隔离性也仅限于此了。它不防递归。通常一个 `ContextifyContext` 上下文都是在另一个上下文中创建的，而最初的 `ContextifyContext` 是主上下文，即 Node.js 自身的上下文。所以这些上下文中 `globalThis` 字段也会是源自于其它上下文。也就是说，如果我们对 `globalThis` 中的某一个外部可能在用的对象进行了修改，一样会影响到外部的——所以说它的隔离性仅限于 `globalThis` 自身这一层。

举个例子，有这么一段代码：

    const vm = require('vm');
    
    const value = {
      hello: 'world',
    };
    
    const context = vm.createContext({
      foo: 'bar',
      value,
    });
    const script = new vm.Script('foo = "baz"; value.hacked = true;');
    script.runInContext(context);
    
    console.log(value);
    

我们可以看到 `Script` 中代码是这样的：

    foo = 'baz';
    value.hacked = true;
    

由于我们新的 `globalThis` 没有别的引用，而是直接写了个对象字面量传进 `vm.createContext()`，所以对于本级的修改 `foo = 'baz'` 并不会影响到代码的执行。而 `value` 则是一个对象，对于它内部的修改一样会影响到外部来的。最后一行 `console.log()` 中我们会看到这个 `value` 中被挂上了 `hacked` 这个字段为 `true`。

如果我们不是用对象字面量，而是直接用 `value` 作为 `ContextifyContext` 的 `globalThis`，那影响面就更大了。

    const vm = require('vm');
    
    const value = {
      hello: 'world',
    };
    
    const context = vm.createContext(value);
    const script = new vm.Script('foo = "baz";');
    script.runInContext(context);
    
    console.log(value);
    

这么一来，整个 `value` 一样被挂上了 `foo` 字段。

### 构造一个 `ContextifyContext`

在 Node.js 的 JavaScript 侧中，构造一个 `ContextifyContext` 实际上就是做一堆的参数校验，然后把最终参数传给 C++ 侧的 `makeContext` 进行内部创造。下面把各种校验的逻辑删除，只留主干，方便大家阅读。

    function createContext(contextObject = {}, options = kEmptyObject) {
      if (isContext(contextObject)) {
        return contextObject;
      }
    
      const {
        name = `VM Context ${defaultContextNameIndex++}`,
        origin,
        codeGeneration,
        microtaskMode,
      } = options;
    
      let strings = true;
      let wasm = true;
      if (codeGeneration !== undefined) {
        ({ strings = true, wasm = true } = codeGeneration);
      }
    
      let microtaskQueue = null;
      if (microtaskMode !== undefined) {
        if (microtaskMode === 'afterEvaluate')
          microtaskQueue = new MicrotaskQueue();
      }
    
      makeContext(contextObject, name, origin, strings, wasm, microtaskQueue);
      return contextObject;
    }
    

第一步，如果传进来待创建的 `contextObject` 若已经是个被附魔实例了，则直接返回。接下去获取一堆参数。然后将这些参数传入 C++ 侧的 `makeContext` 进行附魔。最终将附完魔的 `contextObject` 返回。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7a35aa9060b04321a7695d26e8d7e18a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1439&h=917&s=451085&e=png&b=453f34)

这里面的源码就不细讲了，主要讲几个它做的事情。

1.  若未指定 `microtaskQueue`，则与主 `ContextifyContext` 一起搞微任务；
2.  创建一个 `ContextifyContext` 对象，在该对象中创建一个 V8 的 `Context` 实例，内含一个新的 `globalThis` 相关内容；
3.  将新构建 `ContextifyContext` 与 `contextObject` 联立起来，并为传进来的 `contextObject` 挂载上一个私有变量（具体为一个 `Symbol`）。

第一步不详细解释了，在不同 `Context` 中，不同的微任务模式下，在必要时刻需要自己维护一个微任务队列。

第二步中，构造一个 Node.js 的 `ContextifyContext` 对象，在该对象的构造函数中，再创建一个 V8 的 `Context`。V8 的这个 `Context` 才是上下文的核心，而 `ContextifyContext` 实际上只是 V8 的 `Context` 的一个 Wrapper。

> 在 Chrome V8 中，除了 `Isolate` 实例是各自独立的，`Context` 也是独立且允许存在多个的。在同一个 Isolate 中，不同的上下文也是不相干的，其可以执行各自的 JavaScript 代码。一个上下文为 JavaScript 的执行提供了内置的对象和方法（可简单粗暴理解为 `globalThis`）。
> 
> ——以上内容节选自《Node.js：来一打 C++ 扩展》

创建好 V8 的 `Context` 之后，通过映射型拦截器和索引型拦截器将新创建好的空的 `globalThis` 模板进行改造，将其的读写拦截至传进来的 `contextObject` 中。也正是这一步，让用户在新的 `ContextifyContext` 中操作 `globalThis` 时会最终影响到原来的 `contextObject`。

> 有关映射型拦截器和索引型拦截器的内容，我在[第十五章](https://juejin.cn/book/7196627546253819916/section/7215886987058741281 "https://juejin.cn/book/7196627546253819916/section/7215886987058741281")中有介绍。有兴趣可以复习一下。

第三步，给 `contextObject` 打个标，表示其已经被附魔过了，这样下次如果它再被传入 `createContext()`，就会被直接返回。

所以，过完 `makeContext()` 后，Node.js 就创建了一个 `ContextifyContext`，并将其与传进去的对象绑定起来，在新上下文中执行修改 `globalThis` 会影响到外面的这个对象。就像《宿命之环》里的卢米安，在梦境中死去，外面也会死去。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bcbec69cbe1f471a9b74b1058335b7c6~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1024&h=1024&s=1112170&e=png&b=19170e)

### 关于 `ContextifyContext` 中的微任务

先把目光放到 `createContext()` 中来。它的 `options` 参数中有个 `microtaskMode` 字段，若为 `afterEvaluate`，则微任务（`Promise` 等）会在于对应 [script.runInContext()](https://nodejs.org/dist/latest-v18.x/docs/api/vm.html#scriptrunincontextcontextifiedobject-options "https://nodejs.org/dist/latest-v18.x/docs/api/vm.html#scriptrunincontextcontextifiedobject-options") 执行完后马上被执行。

这是怎么做到的呢？我们回到上一节中，如果 `microtaskMode` 值为 `afterEvaluate`，则为其创建一个 `MicrotaskQueue`。这个 `MicrotaskQueue` 实际上是对于 V8 微任务队列类的一个封装，我们可以在任意时机对这个 `MicrotaskQueue` 进行执行操作，去逐一消耗微任务队列中的任务。

在[创建 V8 Context 时](https://github.com/nodejs/node/blob/v18.16.0/src/node_contextify.cc#L223-L228 "https://github.com/nodejs/node/blob/v18.16.0/src/node_contextify.cc#L223-L228")，会将该 `MicrotaskQueue` 绑定给新创建的 `Context`。一旦建立了绑定，则在该 `Context` 下执行的所有 JavaScript 脚本的微任务都会往对应的 `MicrotaskQueue` 推送。

    ctx = Context::New(isolate,
                       nullptr,
                       object_template,
                       {},
                       {},
                       queue);  // ← 这个就是传进来的微任务队列，在 `Context::New` 时进行绑定
    

而在该 `ContextifyContext` 作用域下执行对应 JavaScript 脚本时，在执行后，会在 C++ 侧通过手动执行这个 `queue` 的 `PerformCheckpoint()` 去消耗队列中的微任务。

还记得[第十章](https://juejin.cn/book/7196627546253819916/section/7197301896355250215 "https://juejin.cn/book/7196627546253819916/section/7197301896355250215")吗？五种微任务执行时机埋点中，有一种就是“`vm` 沙箱执行完一次之后，并且用的不是主 `Context`，而是通过 `vm.createContext()` 创建新的 `Context`”时。

回过头看，是不是就更明确了？那一章中我也贴了对应的代码：

    bool ContextifyScript::EvalMachine(...) {
      ...
      auto run = [&]() {
        MaybeLocal<Value> result = script->Run(context);
        if (!result.IsEmpty() && mtask_queue)
          mtask_queue->PerformCheckpoint(env->isolate());
        return result;
      };
      ...
    }
    

执行完代码（`script->Run()`）后，如果发现有绑定的微任务队列（`mtask_queue`），则执行消耗一次对应的微任务队列（`mtask_queue->PerformCheckpoint(env->isolate())`）。

我们来看看各种情况下的执行结果吧。

#### 无 `vm` 执行顺序

    new Promise(resolve => { console.log('hello1'); resolve('world1') }).then(console.log);
    new Promise(resolve => { console.log('hello2'); resolve('world2') }).then(console.log);
    

结果很明显， 先执行完同步代码，输出 `hello1`、`hello2`，然后再执行微任务队列，输出 `world1`、`world2`。分解下来就是：

1.  在主上下文中，创建并执行一个 `Promise`，输出 `hello1`；
2.  将 `Promise` 的结果 `world1` 添加到主上下文的微任务队列中；
3.  在主上下文中，创建并执行一个 `Promise`，输出 `hello2`；
4.  将 `Promise` 的结果 `world2` 添加到主上下文的微任务队列中；
5.  主上下文的微任务队列处理，将 `world1` 传递给 `console.log` 函数，并输出；
6.  主上下文的微任务队列处理，将 `world2` 传递给 `console.log` 函数，并输出。

#### 普通 `ContextifyContext` 执行顺序

然后是有 `vm`，但不是 `afterEvaluate`：

    const vm = require('vm');
    
    const ctx = { console };
    vm.createContext(ctx);
    
    new Promise(resolve => { console.log('hello1'); resolve('world1') }).then(console.log);
    vm.runInContext(
        'new Promise(resolve => { console.log('hello2'); resolve('world2') }).then(console.log);',
        ctx);
    

结果也很明显，先执行完同步代码，输出 `hello1`，然后是 `vm` 里面的同步代码，输出 `hello2`。同步代码结束后开始执行微任务队列，输出 `world1` 和 `world2`。分解下来就是：

1.  在主上下文中，创建并执行一个 `Promise`，输出 `hello1`；
2.  将 `Promise` 的结果 `world1` 添加到主上下文的微任务队列中；
3.  在 `vm` 上下文中，创建并执行一个 `Promise`，输出 `hello2`；
4.  将 `Promise` 的结果 `world2` 添加到主上下文的微任务队列中；
5.  主上下文的微任务队列处理，将 `world1` 传递给 `console.log` 函数，并输出；
6.  主上下文的微任务队列处理，将 `world2` 传递给 `console.log` 函数，并输出。

#### `afterEvaluate` 执行顺序

接下去，往上面那个 `ctx` 中设置微任务模式为 `afterEvaluate`。

    const vm = require('vm');
    
    const ctx = { console };
    vm.createContext(ctx, {
      microtaskMode: 'afterEvaluate',
    });
    
    new Promise(resolve => { console.log('hello1'); resolve('world1') }).then(console.log);
    vm.runInContext(
        'new Promise(resolve => { console.log('hello2'); resolve('world2') }).then(console.log);',
        ctx);
    

##### 咦？

跑一遍上面的代码试试看？应该是：

    hello1
    hello2
    world2
    world1
    

因为我们的……等一下！

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d6bef962a7c6430cb685095bedf1e10a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=344&h=258&s=1736011&e=gif&f=39&b=443c36)

结果不对？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66a420b76a0a4f6d9b464b3eeb52694b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=500&s=115518&e=png&a=1&b=020202)

好像跟之前的结果没变呀？说好的 `afterEvaluate` 执行顺序会变呢？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/62f5b4fbd9754b33b99c727030749871~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=600&h=343&s=355771&e=png&b=888379)

##### 我知道你很急，但是你先别急

虽然我们上一段代码跑出来的结果跟之前有无 `ContextifyContext` 并无差异，但并不是说 `afterEvaluate` 坏掉了。只是你的姿势不对，恭喜你触发了“feature”。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b00e009c0fd4b4dbca1876b93162887~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=375&s=238579&e=png&b=101516)

让我们来改一小段代码，真的只是一小段。把 `runInContext` 里面的 `.then(console.log)` 改成 `.then(c => console.log(c))` 再试试看吧：

    const vm = require('vm');
    
    const ctx = { console };
    vm.createContext(ctx, {
      microtaskMode: 'afterEvaluate',
    });
    
    new Promise(resolve => { console.log('hello1'); resolve('world1') }).then(console.log);
    vm.runInContext(
        'new Promise(resolve => { console.log('hello2'); resolve('world2') }).then(c => console.log(c));',
        ctx);
    

这会儿对咯，依次输出 `hello1`、`hello2`、`world2`、`world1`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e68f6263a84e4cacbc097cb05a7e0a79~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=430&h=382&s=223882&e=png&b=f2f8fa)

让我们看看两次代码唯一不同的地方：

1.  `.then(console.log)`
2.  `.then(c => console.log(c))`

区别就是一个是直接以 `console.log` 作为 `then` 的回调函数，而后者则是声明了一个箭头函数，并在箭头函数内部调用 `console.log`。那么是什么造成了裸 `console.log()` 与新箭头函数的顺序区别呢？——上下文。

`console.log()` 这个函数是外部上下文（主上下文）中传进来的函数，而箭头函数是新上下文中声明的函数。而 `.then()` 里面传的回调函数对应的上下文决定了它的微任务是给哪个微任务队列。对于第一种情况，微任务还是塞回给 `console.log()` 的上下文，即主上下文；第二种情况才会将微任务塞给新的上下文，因为箭头函数本身就是在新上下文中声明的。最后，我们再来捋一遍这次结果的过程吧：

1.  在主上下文中，创建并执行一个 `Promise`，输出 `hello1`；
2.  将 `Promise` 的结果 `world1` 添加到主上下文的微任务队列中；
3.  在 `vm` 上下文中，创建并执行一个 `Promise`，输出 `hello2`；
4.  将 `Promise` 的结果 `world2` 添加到 `vm` 上下文的微任务队列中；
5.  `vm.runInContext()` 结束执行，处理 `vm` 上下文的微任务队列，输出 `world2`；
6.  主上下文的微任务队列处理，将 `world1` 传递给 `console.log` 函数，并输出。

这回是真的走了 `vm` 上下文的微任务队列了。

脚本——`Script`
------------

`vm` 两个重要的概念，一个是上下文，另一个就是 `Script` 了。结果还是拆章了。（恼

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fc41d6eeae2f48f7acf1c05a87dec76f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=75731&e=png&b=270f03)

本章小结
----

本章为大家复习了一遍内置模块如何使用 `vm`，及其同源的 `internalCompileFunction()`。后为大家详细讲解了 `vm` 中的上下文概念。

Node.js 允许创建多个独立的执行环境，它们之间互不干扰。`vm` 中的上下文是 Node.js 的 `ContextifyContext` 对象，它实际上是 V8 的 `Context` 的一个封装，它提供了 JavaScript 执行所需的全局对象和方法（`globalThis`）。文章详细讲述了 Node.js 如何创建一个新的 `ContextifyContext`，并将其与传入的对象绑定，以便在新上下文中操作 `globalThis` 时影响到原来的对象。在关于上下文的内容中，我们

1.  首先了解了 vm 模块的 `createContext()` 方法，它主要用于创建一个新的 `ContextifyContext`；这个方法的作用是将一个 JavaScript 对象与一个 V8 的 `Context` 实例绑定，使其具有一个独立的全局作用域；
    
2.  分析了创建 `ContextifyContext` 的过程，涉及到微任务队列、V8 的 `Context` 和 `ContextifyContext` 对象之间的关系；在这个过程中，也解释了映射型拦截器和索引型拦截器的作用；
    
3.  探讨了不同情况下的微任务执行顺序，包括：
    
    *   无 `vm` 的执行顺序：先执行同步代码，然后执行微任务队列；
    *   普通 `ContextifyContext` 的执行顺序：同样先执行同步代码，然后执行微任务队列；
    *   `afterEvaluate` 执行顺序：`vm` 代码执行完之后会马上执行相关上下文的微任务队列；
4.  分析了不同情况下 `.then()` 回调函数上下文的影响，以及如何使用箭头函数确保微任务在正确的上下文中执行。
    

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c141caa0fb7d4a96b827510d7c8d6da0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=658&h=370&s=54312&e=png&b=faf8f8)