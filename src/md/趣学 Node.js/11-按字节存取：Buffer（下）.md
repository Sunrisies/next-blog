上一章我们讲了 `Buffer` 的本质，以及 `FastBuffer` 与 `ArrayBuffer` 的关系。本章我们着重讲剩下几个池化的 API。

先来看 Node.js [官方文档](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize")：

> The `Buffer` module pre-allocates an internal `Buffer` instance of size [Buffer.poolSize](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize") that is used as a pool for the fast allocation of new `Buffer` instances created using [Buffer.allocUnsafe()](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize"), [Buffer.from(array)](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray"), [Buffer.concat()](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferconcatlist-totallength "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferconcatlist-totallength"), and the deprecated `new Buffer(size)` constructor only when `size` is less than or equal to `Buffer.poolSize >> 1` (floor of [Buffer.poolSize](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize") divided by two).

偷懒的我点一下飞书右上角的“…”→“翻译为”→“简体中文”，改吧改吧，就是：

> 该 `Buffer` 模块会预分配一个内部 `Buffer` 实例，大小为 [Buffer.poolSize](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#class-property-bufferpoolsize")，用于快速分配新 `Buffer` 实例创建：[Buffer.allocUnsafe()](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferallocunsafesize")、[Buffer.from(array)](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray") 与 [Buffer.concat()](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferconcatlist-totallength "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferconcatlist-totallength")，以及弃用的 `new Buffer(size)` 构造函数（且 `size` 小于等于 `Buffer.pollSize >> 1`，即对 2 整除）。

我们再回想一下上一章的 `Buffer.alloc()`，它并没有在文档的这段话中写着。这也从另一方面证实了它没有走 `ArrayBuffer` 的池化。

![12流程图1.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1cf08b608bf470180ba557663ff55ea~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1860&h=1012&s=357882&e=png&b=f7f4f2)

`ArrayBuffer` 与 `FastBuffer` 之池化的 API
-------------------------------------

### 为什么需要 `ArrayBuffer` 池化？

首先，我们需要知道，为什么 Node.js 里面的 `Buffer` 背后的 `ArrayBuffer` 需要池化。通常对于一个 `Buffer` 来说，在 Node.js 中很常见的场景就是碎片化的 `Buffer` 申请和释放（指 GC），比如一次 HTTP 请求中，我们的业务逻辑可能会反复操作各种 `Buffer`，那么一趟逻辑下来，就会出来很多的 `Buffer`，GC 过后，这些很多的 `Buffer` 又会被回收。而被回收的除了 `Buffer`、`ArrayBuffer` 自身之外，还有其背后的碎片内存块。在计算机中，无论是内存还是硬盘，这种频繁碎片化的分配和释放的开销都不小。

硬盘里面碎片文件多了，频繁读写小文件很慢。而如果把所有小文件合成一个大文件，根据下标去定位读取，则会快很多。因为打开关闭文件是有开销的。我之前做的 [RRC 优化](https://noslate.midwayjs.org/docs/node_js/rrc/ "https://noslate.midwayjs.org/docs/node_js/rrc/")，其中一部分就是将小文件合成一个大文件以减少系统调用。

而内存碎片同样如此。且不说 Node.js，C、C++ 在内存管理中，也通常有着“内存池”的概念，以降低频繁分配、释放内存带来的性能开销。

### 池化的规则

首先，根据前文提到的内容，Node.js 中会采取池化原则的 API 有三个，分别是：

1.  `Buffer.allocUnsafe()`；
2.  `Buffer.from()`；
3.  `Buffer.concat()`。

分别代表非安全分配（不初始化内存）、从字符串或数组等内容创建、拼接 `Buffer`。为什么说不初始化内存代表不安全呢？因为计算机中内存是复用的，你释放一块内存后，下一次申请还有可能被系统分配到这块内存。如果不做初始化操作，你之前遗留在里面的内存数据就可能被读出来——比如你的银行卡密码？但是不初始化内存有一个好处就是会快🤏🏻。

这里面，与 `Buffer.allocUnsafe()` 对应的非池化 API 就是 `Buffer.allocUnsafeSlow()` 了。我们前面提到了池化会提升性能，那么非池化的自然就是 slow 了。当大家就是想真金白银分配小块小块内存并正儿八经按小块内存回收时，就用得上 `Buffer.allocUnsafeSlow()` 了。

对于这三个池化的 API 来说，首先它们共用一个池子长度，即 `Buffer.poolSize`。该长度默认为 `8192`，开发者可自行按需修改该值。在 Node.js 目前的规则中，长度短于 `Buffer.poolSize` 的一半，才会使用池子，大于其一半则不会。也就是说，默认情况下 4KB 以下的 `Buffer` 才会使用 `ArrayBuffer` 池。另外，对于每个池子都会记录下当前已经用到哪过了，每次需要从池中探囊取物时，都先判断一下该池子还够不够用，不够的话得去申请新池子。就像下面这三种情况：

![12流程图2.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f36ef270679e43ca8e0300a8221528c1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1400&h=1250&s=335103&e=png&b=fefefe)

第一种情况，待申请 `4096` 字节，直接就超阈值了，不管池子满没满，都走非池化分支；第二种情况，没过阈值，池子也还有它的位置，则从 `3277` 字节取（因为下标从 `0` 开始）；第三种情况，池子已使用了 `6554` 字节，塞不下 `3277` 字节了，所以得申请一个新的 `ArrayBuffer`。我称之为**双叶校车逻辑**。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/aeb91a139d014e8cb7c95e4baefce34e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1080&h=759&s=624373&e=png&b=8f6c93)

这就像是通往幼稚园的校车。**不管车子还塞不塞得下你，你都不应该上去幼稚园的车；如果是小新，那么得看车子还塞得下塞不下，塞不下了，就去下一辆，虽然双叶幼稚园好像只有一辆校车。**

针对第三种情况，老的池子呢？有空洞就有空洞呗，管它呢，扔一边不管了。静静等待所有引用它的 `Buffer` 被 GC，然后悄悄消亡。就像下图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/93f45ad8a2af46f087135179e2d0e9ae~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=600&h=791&s=607941&e=png&b=e2dfd0)

关于这个“空洞”，依然让我想到[云风大大的博客](https://blog.codingnow.com/2010/08/resource_pack.html "https://blog.codingnow.com/2010/08/resource_pack.html")。

> 和许多其它游戏 Client （比如暴雪的 MPQ 文件）不同。我们的包格式里文件与文件之间是允许有空洞的。这是考虑到资源包文件都比较大。如果用传统的打包软件运作的方式：从包内删除一个文件，就重新打包或移动内部数据。在玩家更新资源的时候，就会有大量的文件 IO 操作。比如 WOW 或 SC2 在更新的时候，下载更新包的时间往往只占整个更新时间的一小部分，大部分时间花在把补丁打在已有的资源包上。
> 
> 如果频繁更新客户端，对于用户，这会有很讨厌的等待。
> 
> 所以当初考虑到这个因素，我们在删除包内文件时，并不移动资源包内的数据，而是把空间留下来。如果新增加的文件较之小，就重复利用这个空间。如果利用不上，就浪费在那里。这有点像内存管理算法，时间久了，资源包内会有一些空洞，但也是可以接受的。

毕竟这一个是离线打补丁功能，频率低，所以还是会寻找复用的机会。Node.js 是运行时实时计算的，所以它做得更彻底。一旦发现空洞不满足后续这个分配请求了，就直接放弃它，以后再也不继续用了，直接找个新的。虽然在空间上有些浪费，但反正后续会 GC，不一定会长时间占着茅坑不拉屎。像极了倒蚝油，既然倒不干净就新开一瓶，老的直接扔掉了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e6ec2dedc1ab4caa8fd6a093d5ae872f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=560&h=315&s=1353325&e=gif&f=18&b=c9ccbe)

其实关于池化，看到这里就够了。有兴趣的同学可以继续跟下来看后面更深入的环节。

在 Node.js 中，刚初始化的时候，会默认[分配](https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L154-L167 "https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L154-L167")一个 8KB 的 `ArrayBuffer` 内存池。

    Buffer.poolSize = 8 * 1024;
    let poolSize, poolOffset, allocPool;
    
    function createPool() {
      poolSize = Buffer.poolSize;
      allocPool = createUnsafeBuffer(poolSize).buffer;
      markAsUntransferable(allocPool);
      poolOffset = 0;
    }
    createPool();
    

注意看上面代码，在创建池子的时候，Node.js 是通过 `createUnsafeBuffer()` 来创建一个 `8192` 字节的 `Buffer`，再取它的 `buffer` 属性。鉴于 `Buffer` 就是一个 `Uint8Array`，它的 `buffer` 就是背靠的 `ArrayBuffer` 了，以此来作为第一个池子。创建完了后，把 `poolOffset` 置为 `0`，表示下次拿内存的时候从 `0` 开始拿。

想想，这里为什么不直接 `new ArrayBuffer(8192)` 呢？留个思考，我就不回答了。

### `Buffer.allocUnsafe()`

请大家在阅读本小节的时候谨记上一节中“池化的规则”。然后来看看 `Buffer.allocUnsafe()` [究竟如何](https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L384-L387 "https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L384-L387")吧。

    Buffer.allocUnsafe = function allocUnsafe(size) {
      assertSize(size);
      return allocate(size);
    };
    

#### `allocate()`

在 `allocate()` 中就是池化逻辑了：

    function allocate(size) {
      if (size <= 0) {
        return new FastBuffer();
      }
      if (size < (Buffer.poolSize >>> 1)) {
        if (size > (poolSize - poolOffset))
          createPool();
        const b = new FastBuffer(allocPool, poolOffset, size);
        poolOffset += size;
        alignPool();
        return b;
      }
      return createUnsafeBuffer(size);
    }
    

先看长度，若小于等于 `0`，直接构建一个 `FastBuffer`；然后看是不是成人票，在 JavaScript 中，`>>>` 位运算代表无符号右移，你可以简单粗暴理解为整除 `2`，这就是“池化规则”中讲的阈值逻辑了，若超过阈值，则直接返回 `createUnsafeBuffer()`。

然后在阈值中的逻辑，先判断还能塞得下待分配内存大小不，池子的剩余空间即池子大小减去偏移量，若塞不下了，那么再调用一次之前提到的 `createPool()` 新建一个池子，老的引用直接被覆盖掉没人管了，只会被之前的一些 `Buffer` 所吊着，所以一旦之前的 `Buffer` 全 GC 了，那么被覆盖掉的这个 `ArrayBuffer` 也就嗝屁了。但若池子剩余空间还塞得下新分配请求，就直接利用剩下的空间来创建新的 `FastBuffer`。这里我们可以暂时把 `FastBuffer` 想象成 [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/Uint8Array#syntax "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/Uint8Array#syntax")，那么 `new Uint8Array(allocPool, poolOffset, size)` 的意思就是说把 `allocPool` 的第 `poolOffset` 下标开始到 `poolOffset + size` 过分配给新的 `Uint8Array` 用。

创建完 `FastBuffer` 后，更新 `poolOffset` 这个偏移量，将其加上 `size`，以表示下次分配从新的偏移量开始。不过别急，后面还有操作呢——[alignPool()](https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L169 "https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L169")。

#### 🎱 字节对齐

    function alignPool() {
      // Ensure aligned slices
      if (poolOffset & 0x7) {
        poolOffset |= 0x7;
        poolOffset++;
      }
    }
    

这是一个偏移量 8 字节对齐操作。CPU 访问内存以一个字（Word）为单位，在 32 位处理器上，每次访存获得 4 字节，在 64 位处理器上为 8 字节。假设机器字长为 4 字节，同样访问 4 字节，如图所示，左侧为对齐的内存访问，仅需要访存 1 次；右侧为未对其的内存访问，需要访存 2 次，然后进行拼接。

![12流程图3.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/30b02ececc2245e0a992698c474d0898~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1296&h=424&s=76724&e=png&b=fefefe)

所以，为了减少额外的 CPU 开销，内存地址需要对齐。V8 本身的 `ArrayBuffer` 内存块初始地址是对齐的，那么 Node.js 只需要保证使用池子的时候，每次偏移量都对齐即可。然后 8 字节对齐同样可以覆盖到 32 位处理器，所以就不用再根据位宽不同而做分别对待了。8 字节对齐最简单粗暴的判断就是起始下标是否能被 `8` 整除。

`0x07` 的二进制是 `0111`，那么 `poolOffset & 0x07` 的意思就是，看看偏移量最末尾 `3` 位（二进制）是否有至少一个 `1`，若有则说明无法被 `8` 整除，代表没有做到 8 字节对齐。比如 `13` 的二进制是 `1101`，末三位 `0111`，与一下的结果是 `0101`，满足 `if` 分支，进入后续逻辑。

这种情况下，我们需要做两步：

1.  **将末 3 位变为全** **`1`** **，即对其“或”** **`0111`**。`13` 二进制是 `1101`，或 `0111` 结果为 `1111`，即 `15`。
2.  **对值自增使其对齐**。`15` 二进制是 `1111`，加 `1` 为 `10000`，即 `16`。

这就是上面那三行代码了。

所以上一节 `allocate()` 中最后提到的，偏移量加上 `size` 即下次分配的新偏移量，其实是不严谨的，加上 `size` 后，Node.js 对新偏移量还做了一次 8 字节对齐操作，这才是真的新偏移量。做完了对齐操作后，把刚构建好的 `FastBuffer` 返回，外面就得到了分配好指定大小的 `Buffer` 了。

针对之前的那张图，为了在讲字节对齐之前让大家好理解，给出的是没有空洞的示例。在有了字节对齐的概念后，实际上一个 `ArrayBuffer` 池的占用大概如下：

![12流程图4.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/04ae288face94e4994347a334619cf9c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1300&h=350&s=104102&e=png&b=ffffff)

### `Buffer.from()`

`Buffer.from()` 的来源参数支持多种类型：

1.  **数组**：其中各值需在 `0`~`255` 范围，若不，则强制转换；
2.  **类** **`ArrayBuffer`**；
3.  **`Buffer`** **或** **`Uint8Array`**；
4.  **有原始值的对象**：如支持 `.valueOf()` 或 `Symbol.toPrimitive`；
5.  **字符串**。

其实究其本质，无非就是 `ArrayBuffer` 和字符串。虽然在[文档](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromarray")中，分了好几段落来介绍不同的参数，搞得跟重载一样，但其实实现就一个函数。TypeScript 的重载不也这样，声明多次，但只实现一次。

    Buffer.from = function from(value, encodingOrOffset, length) {
      if (typeof value === 'string')
        return fromString(value, encodingOrOffset);
    
      if (typeof value === 'object' && value !== null) {
        if (isAnyArrayBuffer(value))
          return fromArrayBuffer(value, encodingOrOffset, length);
    
        const valueOf = value.valueOf && value.valueOf();
        if (valueOf != null &&
            valueOf !== value &&
            (typeof valueOf === 'string' || typeof valueOf === 'object')) {
          return from(valueOf, encodingOrOffset, length);
        }
    
        const b = fromObject(value);
        if (b)
          return b;
    
        if (typeof value[SymbolToPrimitive] === 'function') {
          const primitive = value[SymbolToPrimitive]('string');
          if (typeof primitive === 'string') {
            return fromString(primitive, encodingOrOffset);
          }
        }
      }
    
      throw new ERR_INVALID_ARG_TYPE(
        'first argument',
        ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
        value
      );
    };
    

看吧，在同一个函数里，根据 `value` 不同数据类型，走不同分支。我们先看三个最基本的函数 `fromString()`、`fromArrayBuffer()` 与 `fromArrayLike()`。

#### `fromString(value, encoding)`

如果 `value` 是个字符串，自然就走到了这个分支。第二个参数如[文档](https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromstring-encoding "https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#static-method-bufferfromstring-encoding")所述，是编码。

    function fromString(string, encoding) {
      let ops;
      if (typeof encoding !== 'string' || encoding.length === 0) {
        if (string.length === 0)
          return new FastBuffer();
        ops = encodingOps.utf8;
        encoding = undefined;
      } else {
        ops = getEncodingOps(encoding);
        if (ops === undefined)
          throw new ERR_UNKNOWN_ENCODING(encoding);
        if (string.length === 0)
          return new FastBuffer();
      }
      return fromStringFast(string, ops);
    }
    

这里面经过一系列判断，若字符串长度为 `0`，直接构建一个空的 `FastBuffer` 返回。否则，调用池化的 `fromStringFast()`。

    function fromStringFast(string, ops) {
      const length = ops.byteLength(string);
    
      if (length >= (Buffer.poolSize >>> 1))
        return createFromString(string, ops.encodingVal);
    
      if (length > (poolSize - poolOffset))
        createPool();
      let b = new FastBuffer(allocPool, poolOffset, length);
      const actual = ops.write(b, string, 0, length);
      if (actual !== length) {
        // byteLength() may overestimate. That's a rare case, though.
        b = new FastBuffer(allocPool, poolOffset, actual);
      }
      poolOffset += actual;
      alignPool();
      return b;
    }
    

这段代码看起来可眼熟了，回想一下 `Buffer.allocUnsafe()` 中的 `allocate()`，里面也充斥着 `poolSize`、`createPool()`、`alignPool` 等关键字。

首先，我们获取字符串的字节长度。我们知道，由于默认 UTF8 的原因，JavaScript 中的字符串长度并不一定等于字节长度。如 `foo` 长度与字节长度都为 `3`，而`你好世界！`的字符串长度为 `5`，字节长度则为 `15`，每个汉字和标点符号都占 `3` 个字节。所以函数一开始先通过 `ops.byteLength()` 获取字符串对应的字节长度。这个 `ops` 根据不同编码从外面被传入，里面具体实现不重要，知道用途即可。

有了占用的字节长度后，我们就能看看是否达非池化阈值了。若超了，则走非池化逻辑。逻辑不重要，就不详说了。然后就是熟悉的判断是否要换下一辆校车的环节，判断余量以 `createPool()`。

下一步，将池子、偏移量及分配的字节长度传给 `FastBuffer` 构造函数，得到一个长度对应的目标。接下去就往该目标 `FastBuffer` 中写入字符串对应的内存内容——`ops.write()`。该函数也根据编码不同而不同。比如，如果是 UTF8 编码，则该 `write()` 为 C++ 侧的 [`StringWrite<UTF8>()`](https://github.com/nodejs/node/blob/v18.14.2/src/node_buffer.cc#L756-L787 "https://github.com/nodejs/node/blob/v18.14.2/src/node_buffer.cc#L756-L787")：

    template <encoding encoding>
    StringWrite
    void StringWrite(const FunctionCallbackInfo<Value>& args) {
      Environment* env = Environment::GetCurrent(args);
    
      THROW_AND_RETURN_UNLESS_BUFFER(env, args.This());
      SPREAD_BUFFER_ARG(args.This(), ts_obj);
    
      THROW_AND_RETURN_IF_NOT_STRING(env, args[0], "argument");
    
      Local<String> str = args[0]->ToString(env->context()).ToLocalChecked();
    
      size_t offset = 0;
      size_t max_length = 0;
    
      THROW_AND_RETURN_IF_OOB(ParseArrayIndex(env, args[1], 0, &offset));
      if (offset > ts_obj_length) {
        return node::THROW_ERR_BUFFER_OUT_OF_BOUNDS(
            env, ""offset" is outside of buffer bounds");
      }
    
      THROW_AND_RETURN_IF_OOB(ParseArrayIndex(env, args[2], ts_obj_length - offset,
                                              &max_length));
    
      max_length = std::min(ts_obj_length - offset, max_length);
    
      if (max_length == 0)
        return args.GetReturnValue().Set(0);
    
      uint32_t written = StringBytes::Write(
          env->isolate(), ts_obj_data + offset, max_length, str, encoding);
      args.GetReturnValue().Set(written);
    }
    

**代码扫一眼就好了，没必要细究，不然一时半会儿写不完。** 无非就是通过 [StringBytes::Write()](https://github.com/nodejs/node/blob/v18.14.2/src/string_bytes.cc#L301-L375 "https://github.com/nodejs/node/blob/v18.14.2/src/string_bytes.cc#L301-L375") 将字符串按 UTF8 编码解码为内存块中的数据，然后逐一写入目标 `Buffer`。其最底层是通过调用 V8 中 `String` 类型的 [`WriteUtf8() 方法`](https://v8docs.nodesource.com/node-18.2/d2/db3/classv8_1_1_string.html#a886178c6cd84f44ff4b96b53c0575eb7 "https://v8docs.nodesource.com/node-18.2/d2/db3/classv8_1_1_string.html#a886178c6cd84f44ff4b96b53c0575eb7")来写入内存的。

往 `Buffer` 中写完数据后，C++ 侧会返回真实写入长度。Node.js 会判断该写入长度是否等同于原先计算出来的字节长度。若二者并不相等，则以真实长度为准，重新创建一个原偏移量和新长度的 `FastBuffer`。不过注释中也写了，这是非常罕见的场景。

> byteLength() may overestimate. That's a rare case, though.

最后，更新偏移量，并进行 8 字节对齐，返回构建完成并写入数据的 `FastBuffer`。

一圈看下来，`fromString()` 在池化过程中，比 `allocate()` 多了**计算字符串字节长度**、**填充字符串内容**、**确定长度准确**性三步。

#### `fromArrayBuffer(arrayBuffer[, byteOffset[, length]])`

这个函数没有所谓池化不池化的概念，因为它的语义就是直接为 `Buffer` 指定底层的 `ArrayBuffer` 对象、偏移量和长度。它不会开辟新的内存块，而是直接把它当作自己的 `.buffer` 来用。

    function fromArrayBuffer(obj, byteOffset, length) {
      // Convert byteOffset to integer
      if (byteOffset === undefined) {
        byteOffset = 0;
      } else {
        byteOffset = +byteOffset;
        if (NumberIsNaN(byteOffset))
          byteOffset = 0;
      }
    
      const maxLength = obj.byteLength - byteOffset;
    
      if (maxLength < 0)
        throw new ERR_BUFFER_OUT_OF_BOUNDS('offset');
    
      if (length === undefined) {
        length = maxLength;
      } else {
        // Convert length to non-negative integer.
        length = +length;
        if (length > 0) {
          if (length > maxLength)
            throw new ERR_BUFFER_OUT_OF_BOUNDS('length');
        } else {
          length = 0;
        }
      }
    
      return new FastBuffer(obj, byteOffset, length);
    }
    

最开始先做各种参数的判断和兼容。做完之后，将经过调校（如类型、默认值）后的三个参数直接传给 `FastBuffer` 构造函数进行构造。

#### `fromArrayLike(obj)`

这个函数是通过类数组的对象来创建池化的 `Buffer`，将其内容逐一填充进去。

    function fromArrayLike(obj) {
      if (obj.length <= 0)
        return new FastBuffer();
      if (obj.length < (Buffer.poolSize >>> 1)) {
        if (obj.length > (poolSize - poolOffset))
          createPool();
        const b = new FastBuffer(allocPool, poolOffset, obj.length);
        TypedArrayPrototypeSet(b, obj, 0);
        poolOffset += obj.length;
        alignPool();
        return b;
      }
      return new FastBuffer(obj);
    }
    

代码也很简单，既然是“类数组”，那么默认其有 `.length` 属性，该属性就自然作为需要分配的内存块大小了。接下去又是熟悉的判断阈值、创建新校车的逻辑。然后通过池子、偏移量和长度构建一个 `FastBuffer`。

还记得 `fromString()` 里面多出来的步骤吗？构建 `FastBuffer` 之后一步就是填充数据了。`fromArrayLike()` 也不例外。`fromString()` 是通过 `ops.write()` 填充数据；而 `fromArrayLike()` 则通过 `TypedArray.prototype.bind(b, obj, 0)` 来填充，这代码等同于 `b.set(obj, 0)`，`b` 为构建好的 `FastBuffer`，也是 `Uint8Array`，调用它的 [`set()`方法](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set")。

#### `Buffer.from()` 各分支

让我们回到 `Buffer.from()` 的逻辑中来，逐个分支来解说。

首先就是字符串：

      if (typeof value === 'string')
        return fromString(value, encodingOrOffset);
    

不用多说，`fromString()` 我们在前文就讲完了。

如果不是字符串，那剩下的就是数组、类 `ArrayBuffer`、`Buffer` 或 `Uint8Array` 和有原始值的对象了。它们的一个共同点就是都是对象。所以自然有这条分支：

    if (typeof value === 'object' && value !== null) {
      ...
    }
    
    throw new ERR_INVALID_ARG_TYPE(
      'first argument',
      ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
      value
    );
    

在 `object` 分支里面，又再进一步细化。先是 `ArrayBuffer`：

    if (isAnyArrayBuffer(value))
      return fromArrayBuffer(value, encodingOrOffset, length);
    

`fromArrayBuffer()` 前面也讲过了，不再赘述。紧接着是判断它是否支持 `.valueOf()` 来取原始值，若支持，则获取原始值之后重新 `from()` 一遍：

    const valueOf = value.valueOf && value.valueOf();
    if (valueOf != null &&
        valueOf !== value &&
        (typeof valueOf === 'string' || typeof valueOf === 'object')) {
      return from(valueOf, encodingOrOffset, length);
    }
    

如果一切正常，那么进入 `fromObject()`。

    const b = fromObject(value);
    if (b)
      return b;
    

在 `fromObject()` 中，主要的逻辑就是尝试去调用 `fromArrayLike()`。

    function fromObject(obj) {
      if (obj.length !== undefined || isAnyArrayBuffer(obj.buffer)) {
        if (typeof obj.length !== 'number') {
          return new FastBuffer();
        }
        return fromArrayLike(obj);
      }
    
      if (obj.type === 'Buffer' && ArrayIsArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    

可以看到，先判断它的合法性。边界条件我们就不解释了，主要看它的 `.buffer` 属性是不是 `ArrayBuffer`，或者有没有 `.length`，若是，则“认为”它是一个 `TypedArray` 或是 `Array` 数组，进入 `fromArrayLike()` 逻辑；除去 `TypedArray` 和 `Array` 数组外，就是判断它的 `.type` 是不是一个 `Buffer` 且 `.data` 是不是一个数组了，若是则也是进入 `fromArrayLike()` 逻辑；其余情况，不做任何操作，返回上层函数，`b` 为空，跳过 `return`。

若 `return` 被跳过了，说明该 `object` 不被上面的任何逻辑认可，只能再尝试下一个方案了，即看看是否支持 `Symbol.toPrimitive`，如果支持，则判断是否为字符串，若是则通过 `fromString()` 来分配。

    if (typeof value[SymbolToPrimitive] === 'function') {
      const primitive = value[SymbolToPrimitive]('string');
      if (typeof primitive === 'string') {
        return fromString(primitive, encodingOrOffset);
      }
    }
    

如果到现在还无法正常创建 `FastBuffer` 的话，那只能走到最后抛错了。所以这块逻辑的顺序大概是：

![12流程图5.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/23db78b88a514d0580ba4d4157fb1227~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1262&h=626&s=241858&e=png&b=fdf9f8)

### `Buffer.concat()`

上一节中，基本上已经把池化都讲完了。`Buffer.concat()` 的作用是将含若干 `Buffer` 或 `Uint8Array` 的数组中元素拼接起来，形成一个大的 `Buffer`。不用解析源码，我们也能想象出来它的逻辑：

1.  累加所有元素的长度，形成总长度；
2.  申请一个“总长度”长的 `Buffer`，走池化 `Buffer.allocUnsafe()`；
3.  遍历数组，将各元素的内容逐一复制进新的 `Buffer` 中；
4.  复制结束，返回。

不细讲了，看[源码](https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L547-L586 "https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js#L547-L586")应该直接可以看懂。看不懂的话，理解上面四个步骤即可。

    Buffer.concat = function concat(list, length) {
      validateArray(list, 'list');
    
      if (list.length === 0)
        return new FastBuffer();
    
      if (length === undefined) {
        length = 0;
        for (let i = 0; i < list.length; i++) {
          if (list[i].length) {
            length += list[i].length;
          }
        }
      } else {
        validateOffset(length, 'length');
      }
    
      const buffer = Buffer.allocUnsafe(length);
      let pos = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        if (!isUint8Array(buf)) {
          // TODO(BridgeAR): This should not be of type ERR_INVALID_ARG_TYPE.
          // Instead, find the proper error code for this.
          throw new ERR_INVALID_ARG_TYPE(
            `list[${i}]`, ['Buffer', 'Uint8Array'], list[i]);
        }
        pos += _copyActual(buf, buffer, pos, 0, buf.length);
      }
    
      // Note: `length` is always equal to `buffer.length` at this point
      if (pos < length) {
        // Zero-fill the remaining bytes if the specified `length` was more than
        // the actual total length, i.e. if we have some remaining allocated bytes
        // there were not initialized.
        TypedArrayPrototypeFill(buffer, 0, pos, length);
      }
    
      return buffer;
    };
    

`Buffer` 小结
-----------

本章为大家讲解了 `Buffer` 在 Node.js 中的本质，就是个加了一堆工具方法的 `Uint8Array`。而且它的构造在特定场景下（`Buffer.allocUnsafe()`、`Buffer.from()` 与 `Buffer.concat()`）会走池化逻辑，即多个 `Buffer` 共享同一个大体积的 `ArrayBuffer`，通过不同的 `offset` 和 `length` 来占有其不同的内存块。

池化的时候，走的是双叶幼稚园校车的逻辑，**不管车子还塞不塞得下你，你都不应该上去幼稚园的车；如果是小新，那么得看车子还塞得下塞不下，塞不下了，就去下一辆，虽然双叶幼稚园好像只有一辆校车。** 这种做法存在一定程度上的内存浪费，但问题不大。蚝油倒不干净换一瓶就好了嘛，又不差那么点，做饭火急火燎，哪等得了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f0a293347494bd9bc69e7932e233d84~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=600&h=518&s=190858&e=png&b=d3c9d6)

内存分配未初始化的时候，可能会读取到之前未被清除的内容，这是一个安全隐患。而池化的 `Buffer` 一样也有该隐患。比如我是一个恶意包，我随机申请一小块 `Buffer`，这样我就能通过 `.buffer` 拿到整个大体积的 `ArrayBuffer` 了。如果碰运气，可能会得到一些意想不到的内容，比如用户密码加密后的值（通常这会是一个 `Buffer`）。所以，供应链安全是一个非常大的课题，npm 历史上也不乏一些供应链投毒的案例存在，这块就不在本小册讨论范畴中了。

至于 `Buffer` 中一些有用的工具方法，这里就不介绍了。它们都是些按部就班实现的逻辑，往某个下标写入什么数据、读取什么数据，哪怕没有这些方法，大家自己也能想到各种方式操作，把这些方式的源码规整一下，基本上就是 Node.js 内部这些工具方法的实现了。真要有兴趣，大家也可以自行去阅读 Node.js 相关源码：

*   [github.com/nodejs/node…](https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js "https://github.com/nodejs/node/blob/v18.14.2/lib/buffer.js")
*   [github.com/nodejs/node…](https://github.com/nodejs/node/blob/v18.14.2/lib/internal/buffer.js "https://github.com/nodejs/node/blob/v18.14.2/lib/internal/buffer.js")