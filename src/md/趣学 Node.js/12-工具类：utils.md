在 Node.js 官方文档中，是这么形容 utils 模块的：

> The `node:util` module supports the needs of Node.js internal APIs. Many of the utilities are useful for application and module developers as well.

简而言之，就是对应用和模块开发者很有用的工具类。跟前几章风格不同，本章会按流水账的样式来讲解几个比较常见的 API 的原理。

`util.callbackify(original)`
----------------------------

这个函数的作用是将 `async` 函数（或是返回 `Promise` 对象的函数）转换为 `callback` 的形式。如：

    const util = require('node:util');
    
    async function fn() {
      return 'hello world';
    }
    const callbackFunction = util.callbackify(fn);
    
    callbackFunction((err, ret) => {
      if (err) throw err;
      console.log(ret);
    });
    

仔细想来，这种工具函数很适合作为面试题。比如问你，如何实现这个 `util.callbackify()` 来使得上面这段代码正常运行。

> 好主意，我这把它作为我面试题库的备胎。🤪

所以，在你继续往下读之前，感觉甚至可以自己脑补一下它大概长什么样。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4890963cc6374fadacb8b55d722c925a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=828&h=823&s=230011&e=png&b=f9f9f9)

五……四……三……二……一……

好，我们继续。先不论 Node.js 怎么实现的，我们自己可以先写出一个骨架。

    function callbackify(fn) {
      // ...
    }
    

接下去，我们看到它的返回值是一个函数，这个函数的参数是一个 `callback`，继续往下补。

    function callbackify(fn) {
      return callback => {};
    }
    

如果用户调用返回的函数，那么会去调用 `fn`。

    function callbackify(fn) {
      return callback => {
        fn();
      };
    }
    

然后按函数原意，如果 `fn` 结果被 `resolve` 了，那么 `callback` 的时候，`err` 留空，返回结果；如果被 `reject` 了，那么 `callback` 的时候 `err` 为 `reject` 的错误。

    function callbackify(fn) {
      return callback => {
        fn().then(val => {
          callback(undefined, val);
        }, err => {
          callback(err);
        });
      };
    }
    

好了，雏形出来了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b49c4124e71b400299ac7b32f5d859ed~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=546&h=577&s=237205&e=png&b=e8e2de)

那么，如果代码是这样呢：

    async function fn(world) {
      return `hello ${world}`;
    }
    
    const callbackFunction = util.callbackify(fn);
    
    callbackFunction('world', (err, ret) => {
      if (err) throw err;
      console.log(ret);
    });
    

接下去把逻辑硬伤给修了。`callback` 是作为返回函数的最后一个参数，前面的所有参数都是透传给 `fn` 的。那么，再加个 `...args`：

    function callbackify(fn) {
      return (...args) => {
        const callback = args.pop();
        fn(args).then(val => {
          callback(undefined, val);
        }, err => {
          callback(err);
        });
      };
    }
    

看起来可以跑了！虽然没有边界判断什么的，但至少：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4cd2254e73d45b3bde9057fa7661427~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=640&h=487&s=168662&e=png&b=3362b3)

好了，五步画马，最后一步——丰富细节，边界处理，更精准的参数处理。这就是 [Node.js 的源码](https://github.com/nodejs/node/blob/v18.15.0/lib/util.js#L303-L337 "https://github.com/nodejs/node/blob/v18.15.0/lib/util.js#L303-L337")：

    const validateFunction = hideStackFrames((value, name) => {
      if (typeof value !== 'function')
        throw new ERR_INVALID_ARG_TYPE(name, 'Function', value);
    });
    
    const callbackifyOnRejected = hideStackFrames((reason, cb) => {
      // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
      // Because `null` is a special error value in callbacks which means "no error
      // occurred", we error-wrap so the callback consumer can distinguish between
      // "the promise rejected with null" or "the promise fulfilled with undefined".
      if (!reason) {
        reason = new ERR_FALSY_VALUE_REJECTION(reason);
      }
      return cb(reason);
    });
    
    ...
    
    function callbackify(original) {
      validateFunction(original, 'original');
    
      // We DO NOT return the promise as it gives the user a false sense that
      // the promise is actually somehow related to the callback's execution
      // and that the callback throwing will reject the promise.
      function callbackified(...args) {
        const maybeCb = Array.prototype.pop(args);
        validateFunction(maybeCb, 'last argument');
        const cb = Function.prototype.bind(maybeCb, this);
        // In true node style we process the callback on `nextTick` with all the
        // implications (stack, `uncaughtException`, `async_hooks`)
        Reflect.apply(original, this, args)
          .then((ret) => process.nextTick(cb, null, ret),
                (rej) => process.nextTick(callbackifyOnRejected, rej, cb));
      }
    
      const descriptors = Object.getOwnPropertyDescriptors(original);
      // It is possible to manipulate a functions `length` or `name` property. This
      // guards against the manipulation.
      if (typeof descriptors.length.value === 'number') {
        descriptors.length.value++;
      }
      if (typeof descriptors.name.value === 'string') {
        descriptors.name.value += 'Callbackified';
      }
      const propertiesValues = Object.values(descriptors);
      for (let i = 0; i < propertiesValues.length; i++) {
      // We want to use null-prototype objects to not rely on globally mutable
      // %Object.prototype%.
        Object.setPrototypeOf(propertiesValues[i], null);
      }
      Object.defineProperties(callbackified, descriptors);
      return callbackified;
    }
    

在上面的代码中，首先判断 `original` 是不是一个函数。我们忽略包在 `validateFunction` 外面的 `hideStackFrames`，它是通过改变里面箭头函数的函数名（为其加上某个特定前缀），来让万一生成错误堆栈的时候忽略掉本级的堆栈。

然后就是类似我们刚才 `(...args) => {}` 的一块代码——`callbackified()`。原理也是一样，将 `args` 的最后一位作为 `maybeCb`。不过这里多了一个判断这个 `maybeCb` 是不是一个合法函数。接下去，把 `this` 绑定到 `maybeCb` 上，得到最终的 `cb`。最后，通过 `Reflect` 调用 `original` 函数，并在 `then` 中处理 `resolve` 与 `reject`。此处它并没有跟我们之前画马一样直接调用 `cb`，而是采用了 `process.nextTick()` 再在里面调用。为什么呢？注释里也说了，为了让这个 `callback` 看起来更 Node.js 风——比如错误堆栈（如果有的话），比如里面抛错触发 `uncaughtException` 等。

在 JavaScript 中，函数是一等公民，同时一切皆“对象”。所以传进来的 `original` 函数同时也是个“函数对象”，它上面能挂载属于自己的一些事物。在将 `original` 进行 callback 化的时候，我们还要把 `original` 上挂载的内容也给挪过去。先获取 `original` 的 `ownPropertyDescriptors`。这里面有该函数的 `length`，即参数数量，`callbackify` 之后，参数最后多了个 `callback`，所以 `length` 加了一。然后就是逐个属性一一设置给新的 `callbackified` 即可。

`util.promisify(original)`
--------------------------

有 `callbackify`，自然就要有成对出现的 `promisify`，不然 No 生不完整。

    const util = require('node:util');
    const fs = require('node:fs');
    
    const stat = util.promisify(fs.stat);
    stat('.').then((stats) => {
      // Do something with `stats`
    }).catch((error) => {
      // Handle the error.
    });
    

继续五步画马吧。第一步，先写个骨架：

    function promisify(fn) {
      // ...
    }
    

它自然也是返回一个函数，该函数是个返回 `Promise` 对象的函数。

    function promisify(fn) {
      return (...args) => {
        return new Promise((resolve, reject) => {
          // ...
        });
      };
    }
    

在箭头函数里面调用 `fn`，透传 `...args`，并自己写一个 `callback` 函数，处理 `Promise` 的 `resolve` 和 `reject`。

    function promisify(fn) {
      return (...args) => {
        return new Promise((resolve, reject) => {
          fn(...args, (err, ...values) => {
            if (err) return rej(err);
            resolve(values[0]);
          });
        });
      };
    }
    

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b21afcba24e0404d8c84710a3037392f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=640&h=487&s=168662&e=png&b=3362b3)

接下去就是边界处理，丰富细节了。直接看 Node.js 的实现吧：

    function promisify(original) {
      // Lazy-load to avoid a circular dependency.
      if (validateFunction === undefined)
        ({ validateFunction } = require('internal/validators'));
    
      validateFunction(original, 'original');
    
      if (original[kCustomPromisifiedSymbol]) {
        const fn = original[kCustomPromisifiedSymbol];
    
        validateFunction(fn, 'util.promisify.custom');
    
        return ObjectDefineProperty(fn, kCustomPromisifiedSymbol, {
          __proto__: null,
          value: fn, enumerable: false, writable: false, configurable: true
        });
      }
    
      // Names to create an object from in case the callback receives multiple
      // arguments, e.g. ['bytesRead', 'buffer'] for fs.read.
      const argumentNames = original[kCustomPromisifyArgsSymbol];
    
      function fn(...args) {
        return new Promise((resolve, reject) => {
          ArrayPrototypePush(args, (err, ...values) => {
            if (err) {
              return reject(err);
            }
            if (argumentNames !== undefined && values.length > 1) {
              const obj = {};
              for (let i = 0; i < argumentNames.length; i++)
                obj[argumentNames[i]] = values[i];
              resolve(obj);
            } else {
              resolve(values[0]);
            }
          });
          ReflectApply(original, this, args);
        });
      }
    
      ObjectSetPrototypeOf(fn, ObjectGetPrototypeOf(original));
    
      ObjectDefineProperty(fn, kCustomPromisifiedSymbol, {
        __proto__: null,
        value: fn, enumerable: false, writable: false, configurable: true
      });
    
      const descriptors = ObjectGetOwnPropertyDescriptors(original);
      const propertiesValues = ObjectValues(descriptors);
      for (let i = 0; i < propertiesValues.length; i++) {
        // We want to use null-prototype objects to not rely on globally mutable
        // %Object.prototype%.
        ObjectSetPrototypeOf(propertiesValues[i], null);
      }
      return ObjectDefineProperties(fn, descriptors);
    }
    

同样，先对函数进行合法性校验。

然后是判断该函数上面是否挂载了 `util.promisify.custom` 这个 `Symbol`，若有，则直接返回自定义的 promisify 函数。该特性在 Node.js 官方文档中有描述，可[自行参阅](https://nodejs.org/dist/latest-v18.x/docs/api/util.html#custom-promisified-functions "https://nodejs.org/dist/latest-v18.x/docs/api/util.html#custom-promisified-functions")。

`const argumentNames = original[kCustomPromisifyArgsSymbol]` 这个是多值 `callback` 时，各参数名的自定义数组，后面会用到，等下再讲。

实际上与我们上面箭头函数对标的，在 Node.js 中是下面这个函数：

      function fn(...args) {
        return new Promise((resolve, reject) => {
          Array.prototype.push(args, (err, ...values) => {
            if (err) {
              return reject(err);
            }
            if (argumentNames !== undefined && values.length > 1) {
              const obj = {};
              for (let i = 0; i < argumentNames.length; i++)
                obj[argumentNames[i]] = values[i];
              resolve(obj);
            } else {
              resolve(values[0]);
            }
          });
          Reflect.apply(original, this, args);
        });
      }
    

先将自行实现的 `callback` 通过 `Array.prototype.push()` 推入 `args` 数组中，然后通过 `Reflect.apply()` 调用 `original` 函数，传入被撑大的 `args`。

在自行实现的 `callback` 中，首先跟我们的实现一样，先判断是否有错误，如果有，则直接 `reject()`。

    if (err) {
      return reject(err);
    }
    

然后，判断 `callback` 中剩余参数个数。若只有一个参数，则说明该值可被直接 `resolve`。你看我们自己实现的那个版本中，就是直接 `resolve` 了 `values[0]`。所以 Node.js 这里也一样：

    if (argumentNames !== undefined && values.length > 1) {
      // ...
    } else {
      resolve(values[0]);
    }
    

Node.js 版本中，更成熟的点在于上面那个判断。如果 `callback` 参数不止一个，那么将所有参数按参数名合成一个大对象 `resolve`。比如这段代码：

    function foo(callback) {
      process.nextTick(() => {
        callback(undefined, 'hello', 'world');
      });
    }
    
    foo[kCustomPromisifyArgsSymbol] = [ 'a', 'b' ];
    

那么对 `foo` 进行 `.promisify()` 之后，该 `Promise` 所 `resolve()` 的值就是一个 `{ a: 'hello', b: 'world' }` 对象。所以在 `if` 中的代码是这样的：

    if (argumentNames !== undefined && values.length > 1) {
      const obj = {};
      for (let i = 0; i < argumentNames.length; i++)
        obj[argumentNames[i]] = values[i];
      resolve(obj);
    }
    

怎么样，看起来是不是很美好？不过你没法这么用。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4dc762d7e3024a77a82e012a20c2a9d6~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=273&h=273&s=130311&e=png&b=866e44)

至少目前版本（Node.js v18.15.0）为止，你没法这么用。这个所谓的 `kCustomPromisifyArgsSymbol` 并没有导出给用户侧，你拿不到这个 `Symbol`，自然就没法自定义了。实际上，这个 `Symbol` 是给 Node.js 的一些内部方法在用的。比如 `fs.read()` 里面就设置了 `kCustomPromisifyArgsSymbol` 为 `[ 'bytesRead', 'buffer' ]`，也就说你如果对 `fs.read()` 进行 `util.promisify()`，那么对应 `Promise` 所 `resolve` 的是一个 `{ bytesRead: ..., buffer: ... }` 的对象。

    Object.defineProperty(read, kCustomPromisifyArgsSymbol,
                         { __proto__: null, value: ['bytesRead', 'buffer'], enumerable: false });
    

事实上 Node.js 官网也是这么说的：

> If this method is invoked as its [util.promisify()](https://nodejs.org/dist/latest-v18.x/docs/api/util.html#utilpromisifyoriginal "https://nodejs.org/dist/latest-v18.x/docs/api/util.html#utilpromisifyoriginal")ed version, it returns a promise for an `Object` with `bytesRead` and `buffer` properties.

它的原理就是 Node.js 为 `fs.read()` 开了个后门，后门就是 `kCustomPromisifyArgsSymbol`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02bc4a2d6b3342a790982ebfc0a9524a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=440&h=440&s=101352&e=png&b=f7f7f7)

你自己在用户侧没法去使用 `kCustomPromisifyArgsSymbol` 自定义返回值，是因为 Node.js 把这个后门在用户侧关了，压根就没把这个值暴露给用户。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c1ead926bd8240249a2c4143061b56bf~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=440&h=440&s=98429&e=png&b=f5f5f5)

如果你非要用，那就在 Node.js 启动时候开启 `internal`，然后从里面强抢吧。

    const { customPromisifyArgs } = require('internal/util');
    
    function foo(callback) {
      process.nextTick(() => {
        callback(undefined, 'hello', 'world');
      });
    }
    
    foo[customPromisifyArgs] = [ 'a', 'b' ];
    

启动的时候这么启动：

    $ node --expose-internals ./main.js
    

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/535e75ea64cd405ba65fa944fdb5498c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=298&h=300&s=62754&e=png&b=f3f3f3)

当然，我强烈不推荐你在生产环境开启 `--expose-internals`。即使不是生产环境，我也强烈不建议你开启 `--expose-internals`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60bd9ad140eb4d1c898e3c8aa4f6f85f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=200&h=200&s=34041&e=png&b=fcfcfc)

> `util.promisify()` 同样已加入死月面试套餐。

`util.types.*`
--------------

`util.types.*` 下面的各种方法都是用于判断某个变量或常量是否某种类型。这里面大概分三类：

1.  `util.types.isArrayBufferView()`；
2.  Is 各种 `TypedArray`，如 `isTypedArray()`、`isUint8Array()`……
3.  其他剩余的方法。

### `isArrayBufferView()`

这个函数非常简单，就是简单把 `ArrayBuffer.isView()` [包了一下](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/util/types.js#LL59C40-L59C40 "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/util/types.js#LL59C40-L59C40")。这就是“自研”的真谛：

    module.exports = {
      ...,
      isArrayBufferView: ArrayBuffer.isView,
      ...,
    };
    

### Is 各种 `TypedArray`

这个的原理就是看看它的 `Symbol.toStringTag` 是否等于某个值。如 `Uint8Array` 的该值就是 `Uint8Array`，即：

    const a = new Uint8Array();
    a[Symbol.toStringTag];  // Uint8Array
    

在 Node.js 中，我们通过 primordials 中的 `TypedArrayPrototypeGetSymbolToStringTag` 来获取这些内容。它等同于 `Object.getOwnPropertyDescriptors(Object.getPrototypeOf(Uint8Array).prototype)` 中 `Symbol.toStringTag` 这个 Getter 对应的函数，即 `TypedArray` 原型链中的对应 Getter，对不同的 `TypedArray` 子类有不同名字的返回。如果对于这个 Getter 没有太大的概念，可以自行在浏览器或 Node.js 中执行 `Object.getOwnPropertyDescriptors(Object.getPrototypeOf(Uint8Array).prototype)` 看看效果。用这个取值函数去调用传进来判断的参数，若它是一个正常的 `TypedArray`，就能得到对应的名字，就像上面的 `a[Symbol.toStringTag]`。得到名字后，直接判断就好了。

    function isTypedArray(value) {
      return TypedArrayPrototypeGetSymbolToStringTag(value) !== undefined;
    }
    
    function isUint8Array(value) {
      return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint8Array';
    }
    
    function isUint16Array(value) {
      return TypedArrayPrototypeGetSymbolToStringTag(value) === 'Uint16Array';
    }
    
    ...
    

那么，为什么不直接 `value[Symbol.toStringTag]` 呢？自行思考一下吧！ 🤪

> 把上面的函数复制出来，做成自己的库，在浏览器中也适用，可以判断各种 `TypedArray` 哦。只需要把 `TypedArrayPrototypeGetSymbolToStringTag` 替换成我上面讲解的内容即可。

### 其他剩余方法

除了上面两类判断外，`util.types` 中剩余的判断方法都是在 C++ 侧依靠 V8 提供的一些能力达成的。V8 中对于一个 JavaScript 侧的值来说，除去句柄的概念，其基类都是 `v8::Value`。包括 `v8::Number`、`v8::Object`、`v8::String` 等，皆继承自 `v8::Value`。下图就是 `v8::Value` 和各种 JavaScript 数据类型的继承关系图（[v8docs.nodesource.com/node-18.2/d…](https://v8docs.nodesource.com/node-18.2/dc/d0a/classv8_1_1_value.html "https://v8docs.nodesource.com/node-18.2/dc/d0a/classv8_1_1_value.html") ）：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e284ae5d911543048e80e458388a54ae~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=848&h=1304&s=147436&e=png&b=ffffff)

细节我们无需深究，我们至少可以在这其中看到一些眼熟的 JavaScript 类型。既然在 V8 的眼中，有那么多数据类型，那么在其基类中就有判断某个 `Value` 是否某种类型的值的方法。假设 `val` 目前是一个 `v8::Value`，那么它就有形如 `val->IsNumber()`、`val->IsObject()`、`val->IsFunction()` 等用于判断真实类型的方法。更多该类方法可直接阅读 V8 的 API 文档：[v8.github.io/api/head/cl…](https://v8.github.io/api/head/classv8_1_1Value.html "https://v8.github.io/api/head/classv8_1_1Value.html") 。

那么，显而易见，剩下的 `types` 判断方法，都是借助 V8 在 C++ 侧的这些方法达到目的的。如 `isAsyncFunction()`，在 C++ 侧就是这样的：

    static void IsAsyncFunction(const FunctionCallbackInfo<Value>& args) {
      args.GetReturnValue().Set(args[0]->IsAsyncFunction());
    }
    

在上面的代码中，声明一个可在 JavaScript 侧使用的函数，就得是 `void XXX(const FunctionCallbackInfo<Value>& args)` 形式的；如果要返回一个值，就通过 `args.GetReturnValue().Set()` 进行设置。不过这些都不重要。

重要的就是里面 `args[0]->IsAsyncFunction()`。`args` 为 JavaScript 调用该函数所传进来的参数数组，`args[0]` 代表第 `0` 个参数，这个参数是一个 `v8::Value` 类型的，所以直接调用其 `->IsAsyncFunction()` 方法就可知道它是不是一个 async 函数。这些方法没有在 ECMAScript 的规范中定义，只是 V8 为了自己做一些事情而在 C++ 侧封装的工具函数，这不就刚好被 Node.js 捡漏了吗？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/19732bba806c4c0495f557c8a0079b6a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=500&h=500&s=121043&e=png&b=f8f8f8)

其实，上面这段代码并不在 Node.js 源代码中，而是通过 C++ 宏生成的。

    #define VALUE_METHOD_MAP(V)                                                   \
      V(External)                                                                 \
      V(Date)                                                                     \
      V(ArgumentsObject)                                                          \
      V(BigIntObject)                                                             \
      V(BooleanObject)                                                            \
      V(NumberObject)                                                             \
      V(StringObject)                                                             \
      V(SymbolObject)                                                             \
      V(NativeError)                                                              \
      V(RegExp)                                                                   \
      V(AsyncFunction)                                                            \
      V(GeneratorFunction)                                                        \
      V(GeneratorObject)                                                          \
      V(Promise)                                                                  \
      V(Map)                                                                      \
      V(Set)                                                                      \
      V(MapIterator)                                                              \
      V(SetIterator)                                                              \
      V(WeakMap)                                                                  \
      V(WeakSet)                                                                  \
      V(ArrayBuffer)                                                              \
      V(DataView)                                                                 \
      V(SharedArrayBuffer)                                                        \
      V(Proxy)                                                                    \
      V(ModuleNamespaceObject)                                                    \
    
    
    #define V(type) \
      static void Is##type(const FunctionCallbackInfo<Value>& args) {             \
        args.GetReturnValue().Set(args[0]->Is##type());                           \
      }
    
      VALUE_METHOD_MAP(V)
    #undef V
    

它通过上面这段宏，来将上面列举的所有这些类型都转化成类似刚才 `IsAsyncFunction()` 这种形式。对 C++ 宏略有研究的读者可自行脑补一下其结果，如果不想脑补也没什么问题，知道上面这些类型都是使用 `args[0]->Is<某种类型>` 达到效果就好了。

细心的读者会发现，上面的这个宏的列表里面还漏了两个函数：

1.  `util.types.isAnyArrayBuffer(value)`；
2.  `util.types.isBoxedPrimitive(value)`。

因为这俩都是复合判断，并不是单一的某种类型。

`isAnyArrayBuffer()` 可命中 `ArrayBuffer` 和 `SharedArrayBuffer`。那么，其实在函数体中复合判断一下就好了：

    static void IsAnyArrayBuffer(const FunctionCallbackInfo<Value>& args) {
      args.GetReturnValue().Set(
        args[0]->IsArrayBuffer() || args[0]->IsSharedArrayBuffer());
    }
    

至于 `isBoxedPrimitive()`，看官方文档，就是是否通过类似 `new` 的方式构造一些元类型，比如 `new Boolean()`。官方文档的例子中是这样的：

    util.types.isBoxedPrimitive(false); // Returns false
    util.types.isBoxedPrimitive(new Boolean(false)); // Returns true
    util.types.isBoxedPrimitive(Symbol('foo')); // Returns false
    util.types.isBoxedPrimitive(Object(Symbol('foo'))); // Returns true
    util.types.isBoxedPrimitive(Object(BigInt(5))); // Returns true
    

这也很简单，V8 爸爸帮你把这些事情都做了。它除了判断 `->Is<某种类型>()` 外，还能判断 `->Is<某种元类型>Object()`。比如 `->IsBooleanObject()`。那么 `isBoxePrimitive()` 的实现就呼之欲出了：

    static void IsBoxedPrimitive(const FunctionCallbackInfo<Value>& args) {
      args.GetReturnValue().Set(
        args[0]->IsNumberObject() ||
        args[0]->IsStringObject() ||
        args[0]->IsBooleanObject() ||
        args[0]->IsBigIntObject() ||
        args[0]->IsSymbolObject());
    }
    

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/56420adb50e24c01b0a711d7ac17fd9d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=600&h=328&s=224854&e=png&b=45646f)

这些方法真是满满的借鸡生蛋既视感。

`util.format()` / `util.inspect()`
----------------------------------

Node.js 真给我出难题。我摆烂了，代码太长了，讲不完。大多都是些类型的判断、字符串的处理等操作，都是一些纯逻辑。自己看代码吧。

> [github.com/nodejs/node…](https://github.com/nodejs/node/blob/v18.15.0/lib/internal/util/inspect.js "https://github.com/nodejs/node/blob/v18.15.0/lib/internal/util/inspect.js")

本章小结
----

本章讲的是 `util` 工具类里面的一些方法的实现。与前面章节有所不同，`util` 更多的是一些纯逻辑类的工具类。甚至连 `util.inherits()` 亦是如此，只不过在 `class` 大行其道的当下，这个方法日渐式微，我也就不讲了。不过还是建议有兴趣的读者自行去阅读一下 `util.inherits()` 源码（[github.com/nodejs/node…](https://github.com/nodejs/node/blob/v18.15.0/lib/util.js#L228-L262 "https://github.com/nodejs/node/blob/v18.15.0/lib/util.js#L228-L262") ），算是可以复习一下关于原型链的知识。

既然是纯逻辑的工具类，大家直接把这些代码照搬到 Node.js 以外的场景，自然都是可以作为自己的工具类使用的。比如浏览器中，比如别的运行时（如 CloudFlare Workers 等），比如一些小程序，只要是能跑标准 JavaScript 的环境都可以。

至少在我讲解的这几个函数中，除了 `util.types.*` 里面一些内容，都是可以直接照搬的。而且就算不能照搬，好多实现也都是有参考价值的。还有其他的一些 `util` 里面的方法，有兴趣也是建议大家去阅读阅读，这块内容的复杂度并不大，阅读门槛也并不高。