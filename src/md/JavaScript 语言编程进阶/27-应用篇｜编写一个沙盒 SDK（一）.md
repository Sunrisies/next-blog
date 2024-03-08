为了充分复习本小册的内容，我们花两节的时间用纯原生 JavaScript 编写一个基础软件——浏览器沙盒（_sandbox_）。沙盒的标准功能是**能够运行一段 JavaScript 代码，但能够使得其产生的副作用不污染真正的全局环境**。

事实上 100% 安全的沙盒在目前的技术条件下是不可能实现的，但是我们不必纠结这个，一是我们仅以此作为复杂编程的案例，二是即便在生产环境中使用，也是够用即可，能处理绝大多数副作用就好。

接下来我们就从需求定义出发吧。

沙盒的需求定义
-------

基础的沙盒模型 API 可以是这样的：

    class Sandbox {
        runScript(code) {}
        dispose() {}
    }
    

最终落实在代码上，我们就需要提前明确定义沙盒的功能要求。

**第一，至少能读取到 window 的真实属性值，在它们上定义操作属性不会影响到真实 window**。

这是沙盒的`基础要求`，要强调 3 点细节：

1.  属性重新定义或者赋值成功后，必须读取到这个最新值。
2.  如果 window 上有不可写或者不可配置的属性，在沙盒中如何表现取决于你的需求，可以强行实现为可写或者可配置的（这也是沙盒的一种优势），也可以遵循原来的配置。本文中我们取后者。
3.  写数据不能写到真实 window 的原型上，如果原型中的同名属性不可读/写，你同样可以选择两种方案，本文中我们还是遵循原始属性描述符的配置。

为了让沙盒更安全，同时也为了增加需求复杂度，我们还需要实现下列特性。

**第二，支持指定属性的“逃逸”，即读写都会作用在真实 window 上**。当不同的沙盒实例同时运行时，也许需要共享一些实时变化的全局数据。

**第三，支持预设虚拟数据**。比如一些环境变量，并不真实存在于 window 上，但希望能被沙盒内的代码读写到。

**第四，支持区域化事件**。即在沙盒内的 window 上派发事件，默认只有此沙盒内的相应事件监听器可捕获到。通过参数控制，也可以实现在真实 window 上派发。

**第五，支持事件、fetch、setTimeout 的自动清除**。沙盒一旦销毁（dispose），其内部创建的各种资源都应一并销毁或终止，包括事件监听器、网络请求、定时器等等。

**第六，支持 localStorage 的自动空间**。毕竟共享同一个浏览器页面，不同沙盒实例对浏览器资源的访问仍然是共享的，但有时可以隔离，比如 localStorage 通过 key 空间的方式可以相互隔离。

好了，看到这些需求，大家脑海中有没有实现的思路呢？没有也没有关系，接下来我们一步步解决。根据需求描述，我们重新整理一下 API 表述，增加一些参数：

    class Sandbox {
      #options = {};
      constructor(options) {
        Object.assign(
          this.#options,
          {
            // 逃逸属性
            escapeVariables: [],
            // 逃逸事件
            escapeWEvents: [],
            // 预设数据
            presetVariables: {},
            // 需要清理的资源
            patches: {
              setTimeout: false,
              localStorage: false,
              fetch: false,
            },
          },
          options
        );
      }
      
      runScript(code) {}
      
      dispose() {}
    }
    

这里我们用 Object.assign 在`私有属性` _#options_ 上生成完成的选项参数。由于 Object.assign 会在第一个参数上操作，因此我们无需再为 _this.#options_ 赋值。

由于 _#options_ 初始值是空对象，因此除非 `Object.prototype` 上有冲突的同名属性（不太可能），因此使用 Object.assign 或者 `Object Spread` 语法并无区别：

    class Sandbox {
      constructor(options) {
          this.#options = {
                escapeVariables: [],
                escapeWEvents: [],
                presetVariables: {},
                patches: {
                  setTimeout: false,
                  localStorage: false,
                  fetch: false,
                },
                ...options
          };
      }
      
      runScript(code) {}
      
      dispose() {}
    }
    

> 💡 类属性（Class Properties）语法就是在对象本身而不是原型链上定义属性。

使用私有属性的好处是它不会被外部访问（或篡改）到，但是类的内部修改它还是有可能的。我们可以用 `Object.freeze` 冻结它：

    class Sandbox {
      constructor(options) {
          this.#options = Object.freeze({
                escapeVariables: [],
                escapeWEvents: [],
                presetVariables: {},
                patches: {
                  setTimeout: false,
                  localStorage: false,
                  fetch: false,
                },
                ...options
          });
      }
      
      runScript(code) {}
      
      dispose() {}
    }
    

不过这样也只能冻结第一层，修改 _this.#options.patches.fetch_ 仍然是能成功的，需要根据具体结构来递归冻结，但不建议使用任何通用递归方法，避免冻结到敏感对象，比如 window。

接下来篇幅的目标，就是为了实现上面这个 API。

window 代理
---------

沙盒的核心逻辑必然是个 Proxy 对象。下意识里，我们应该用真实 window 作为 _target_ 来创建 Proxy 对象：

    new Proxy(window, {});
    

但不要忘记不变量（`invariants`）的存在，它限制了你不能为所欲为地“伪造” target 的代理行为。比如说你想在代理对象上定义一个不可配置的属性，那必须在 target 上也有一个这样的不可配置属性，显然违背了我们不影响原始对象的初衷。

因此，只能用一个新对象来当作 Proxy 的 target，在访问任意属性的时候，只要把 window 的属性复制过来再行操作，就能达到类似在 window 上操作的结果。

为避免原型的影响，我们用空原型的对象：

    new Proxy(Object.create(null), {});
    

考虑到 `presetVariables` 的存在，我们可以先把预设变量注入到 target 中：

    const target = Object.assign(Object.create(null), presetVariables);
    new Proxy(target, {});
    

接下来，我们就来实现 Proxy 的各种 handler 函数，受限于篇幅，我选几个关键的重点解释。

### defineProperty

在代理上定义属性，要转换为在 target 上定义而不是 window。如果我们不定义 defineProperty 这个 handler，那么默认就是在 target 上定义。但是，考虑到要定义的属性并不一定是新属性，会受到现存属性的干扰，即有不变量（`invariants`）的限制，所以在定义之前，我们应该把 window 上的属性（如果存在的话）拷贝到 target 上：

    const winProxy = new Proxy(target, {
        defineProperty(target, p, attributes) {
            if (Object.hasOwn(window, p) && !Object.hasOwn(target, p)) {
                target[p] = window[p];
            }
            
            return Reflect.defineProperty(target, p, attributes);
        }
    });
    

其中，`Object.hasOwn(obj, p)` 等价于 `Object.prototype.hasOwnProperty.call(obj, p)`，但更简洁，支持浏览器也更新一些。你可以用很多替代方法，比如：

1.  _**Reflect.getOwnPropertyDescriptor(obj, p) !== null**_
2.  _**Reflect.ownKeys(obj).includes(p)**_

> 💡 你还能想到什么方法？

defineProperty 最后需要返回一个布尔值，因此正好用 Reflect.defineProperty，这也是 Reflect API 的真正用武之地。

现在我们看上面代码的第 4 行，用赋值的方式给 target 拷贝属性有副作用：

1.  理论上有可能写入到原型链上，但是我们的 target 是个原型为 null 的对象，所以还好不存在这个问题；
2.  会失去属性描述符的特征，无论 window 上的属性为几何，赋值只能定义一个可枚举、可配置、可写的数据属性；
3.  如果 window 上的这个属性不可读取（不存在 get 或者 get 报错），那么此语句也会报错。

所以我们应该改进这行代码，比较简单的是直接搬移属性描述符：

    const desc = Refect.getOwnPropertyDescriptor(window, p);
    Reflect.defineProperty(target, p, desc);
    

看上去能够做到完整信息的拷贝，似乎万无一失，但是却也隐藏着致命缺陷：**如果这个属性描述符是存取器的，那么无法预测 getter/setter 的行为**。具体来说就是它有可能和 window 的其他属性有关联，从而导致污染 window 内部状态或者压根在 target 上无法工作。

这个问题基本无解。有同学会想到大不了把 window 所有属性都先拷贝到 target 上，但是有些内部数据（比如私有属性）是无法拷贝的，仍然可能存在着无法工作的可能。

所以说只要涉及到函数，那么对象就很难称得上是 _plain_ 的，即无法序列化也无法复制。我们只能“赌一把”：**将 window 的属性转换为数据属性，保留描述符的相关参数**。

    const desc = Refect.getOwnPropertyDescriptor(window, p);
    Reflect.defineProperty(target, p, {
        value: 'get' in desc ? Reflect.get(window, p) : undefined,
        writable: 'set' in desc,
        enumerable: desc.enumerable,
        configurable: desc.configurable,
    });
    

这种写法当然也不能完全复刻 window 上这个属性的行为，大家发现是什么原因吗？

1.  如果没有 get，访问 _window\[p\]_ 会抛出异常，但是 _target\[p\]_ 只会返回 undefined；
2.  由于属性描述符的结构已经发生变化，原本在 window 上会失败的 defineProperty 操作，在 target 上很可能会成功，或者相反。

无论如何，这里没有完美的办法。

现在我们来实现 `escapeVariables`，允许指定的变量“逃逸”出沙箱。

虽然直接作用于 window 上非常简单，但 Proxy 仍然受到`不变量`的限制，所以最好是仍然同步 window 的属性到 target 上：

    const winProxy = new Proxy(target, {
        defineProperty(target, p, attributes) {
            if (Object.hasOwn(window, p) && !Object.hasOwn(target, p)) {
                const desc = Refect.getOwnPropertyDescriptor(window, p);
                Reflect.defineProperty(target, p, {
                    value: 'get' in desc ? Reflect.get(window, p) : undefined,
                    writable: 'set' in desc,
                    enumerable: desc.enumerable,
                    configurable: desc.configurable,
                });
            }
            
            // 变量逃逸
            if (escapeVariables.includes(p)) {
               Reflect.defineProperty(target, p, attributes);
               return Reflect.defineProperty(window, p, attributes);
            }
            
            return Reflect.defineProperty(target, p, attributes);
        }
    });
    

由于属性名 _p_ 只可能是 String 或 Symbol，因此在数组中判断有无用 indexOf 和 includes 都是可以的。

大家需要知道由于前面拷贝属性带来的差异性，以上代码第 15、16 行的结果也可能相左，这无法避免，为了不与`不变量`冲突，似乎忽略对 window 操作的结果更好：

    // 变量逃逸
    if (escapeVariables.includes(p)) {
        Reflect.defineProperty(window, p, attributes);
    }
    

### deleteProperty

删除一个属性并不是直接在 target 上删除就完了，因为下次访问的时候还会从 window 上拷贝过来。我们需要一个容器来记录被删除的属性名：

    const deletedPropertiesSet = new Set();
    

使用 `Set` 结构可以防止重复，并且比数组在查询上要更快，甚至快于 `Map`。

首先依然需要拷贝属性，我们把这段抽象一下：

    function prepareProperty(target, p) {
        if (Object.hasOwn(window, p) && !Object.hasOwn(target, p)) {
            const desc = Refect.getOwnPropertyDescriptor(window, p);
            Reflect.defineProperty(target, p, {
                value: 'get' in desc ? Reflect.get(window, p) : undefined,
                writable: 'set' in desc,
                enumerable: desc.enumerable,
                configurable: desc.configurable,
            });
        }
    }
    

接着实现 deleteProperty：

    const winProxy = new Proxy(target, {
        // 省略 defineProperty
        deleteProperty(target, p) {
            prepareProperty(target, p);
            
            // 变量逃逸
            if (escapeVariables.includes(p)) {
                Reflect.deleteProperty(window, p, attributes);
            }
            
            const result = Reflect.deleteProperty(target, p, attributes);
            
            if (result) {
                deletedPropertiesSet.add(p);
            }
    
            return result;
        }
    });
    

现在我们回忆到，在前面的 defineProperty 中，也需要更新 _deletedPropertiesSet_：

    const winProxy = new Proxy(target, {
        defineProperty(target, p, attributes) {
            prepareProperty(target, p);
            
            // 变量逃逸
            if (escapeVariables.includes(p)) {
               Reflect.defineProperty(window, p, attributes);
            }
            
            // 无论是否存在，直接尝试删除
            deletedPropertiesSet.delete(p);
            
            return Reflect.defineProperty(target, p, attributes);
        }
    });
    

整体上来说，以上两个 handler 还算比较简单，接下来我们实现 `get`。

### get

我猜大家都能想到 get 的以下实现代码：

    const winProxy = new Proxy(target, {
        get(target, p, receiver) {
            prepareProperty(target, p);
            
            // 变量逃逸
            if (escapeVariables.includes(p)) {
               return Reflect.get(window, p, receiver);
            }
            // 是否是已经删除的属性
            if (deletedPropertiesSet.has(p)) {
                return undefined;
            }
            
            return Reflect.get(target, p, receiver);
        }
    });
    

但是有问题，而且还是严重问题，我一个一个说。

不同于 `getOwnPropertyDescriptor` 只能读取自身属性，`get` 这种操作是可以读原型链的。因此，仅仅拷贝 window 自身属性是不足的，比如 window 原型中的 addEventListener（来自 `EventTarget`）。

另外，考虑到 get 操作的频繁性，以及拷贝属性带来的兼容性风险，所以在 get 中我们取消掉拷贝属性的操作，加上用 `Reflect.has` 判断 window 及其原型中是否有该属性的逻辑：

    const winProxy = new Proxy(target, {
        // 省略 defineProperty
        // 省略 deleteProperty
        get(target, p, receiver) {
            // 变量逃逸
            if (escapeVariables.includes(p)) {
               return Reflect.get(window, p, receiver);
            }
            // 是否是已经删除的属性
            if (deletedPropertiesSet.has(p)) {
                return undefined;
            }
            
            if (Reflect.has(target, p)) { // 由于没有原型，这里等价于 Object.hasOwn(target, p)
                return Reflect.get(target, p, receiver);
            }
            
            // target 没有的属性，从 window 上取
            return Reflect.get(window, p, receiver);
        }
    });
    

由于我们优先返回了 target 自有属性，因此可以规避掉所有`不变量`的限制。

还没完，大家可以试试在浏览器下运行如下代码：

    (new Proxy(window, {})).matchMedia('screen')
    

所有浏览器都会报错，Chrome 下比较隐晦：`Uncaught TypeError: Illegal invocation`。这是因为函数运行的上下文发生变化所致——**一些函数只能在特定上下文中运行**。

为了解决这个问题，我们只能对函数进行包装：

    // target 没有的属性，从 window 上取
    const valueInWin = Reflect.get(window, p, receiver);
    
    if ('function' === typeof valueInWin) {
        return function (...args) {
            return Reflect.apply(valueInWin, window, args);
        };
    }
    

之前我们了解过，函数有 _name_ 和 _length_ 两个属性，我们让这两个属性同步：

    if ('function' === typeof valueInWin) {
        const newFn = function (...args) {
            return Reflect.apply(valueInWin, window, args);
        };
        
        Object.defineProperties(newFn, {
            length: {
                // 覆写
                value: valueInWin.length,
                writable: false,
                enumerable: false,
                configurable: true
            },
            name: {
                // 覆写
                value: valueInWin.name,
                writable: false,
                enumerable: false,
                configurable: true
            },
        });
        
        return newFn;
    }
    

并不是所有函数都需要这样处理，ECMAScript 定义的那几个全局对象的属性，如 parseInt、parseFloat、isNaN、isFinite、encodeURIComponent、eval，它们并不依赖 window 上下文，因此可以加一个白名单，遇到它们可以直接从 window 上取。

但是函数并非都允许直接调用，事实上 window 上存在最多是`构造函数`，如何区分一个函数被执行的时候是否是作为构造函数呢？当然是 `new.target`：

    const newFn = function (...args) {
        if (new.target) {
            return Reflect.construct(valueInWin, args)
        }
        return Reflect.apply(valueInWin, window, args);
    };
    

当 _newFn_ 作为构造函数调用时，`new.target` 会指向 _newFn_ 本身，所以我们用 `Reflect.construct` 来构造一个对象返回。这里利用了构造函数返回一个对象类型时的特殊逻辑，能保证得到的对象就是我们想要的类型，比如 _new winProxy.Map()_。

然而，这么做的弊端是，构造的对象和所谓构造函数之间就没有关系了：

    const Map = winProxy.Map;
    
    new Map() instanceof Map // false
    

根本原因在于封装函数 _newFn_ 的原型链和 Map 之间失去了关联。要处理这件事情，最佳的方案还是直接从 window 读取 Map，而不要二次封装。

无奈，我们不可能从几百个属性中分辨哪些是构造函数，哪些不是。一种投机的方法是：看函数名是否以大写字母开头，这种当作构造函数，于是：

    const winProxy = new Proxy(target, {
        // 省略 defineProperty
        // 省略 deleteProperty
        get(target, p, receiver) {
            // 变量逃逸
            if (escapeVariables.includes(p)) {
               return Reflect.get(window, p, receiver);
            }
            // 是否是已经删除的属性
            if (deletedPropertiesSet.has(p)) {
                return undefined;
            }
            
            if (Reflect.has(target, p)) { // 由于没有原型，这里等价于 Object.hasOwn(target, p)
                return Reflect.get(target, p, receiver);
            }
            
            // target 没有的属性，从 window 上取
            const valueInWin = Reflect.get(window, p, receiver);
            
            // 函数需要特殊处理
            if ('function' === typeof valueInWin) {
                // 大写字母开头的函数认为是构造函数，不必处理
                if ('string' === typeof p && /^[A-Z]/.test(p)) {
                    return valueInWin;
                }
                // 个别对上下文无感的函数也不必处理
                if ('string' === typeof p && ['parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'escape'].includes(p)) {
                    return valueInWin;
                }
    
                // 封装
                const newFn = function (...args) {
                    // 万一也当作构造函数
                    if (new.target) {
                        return Reflect.construct(valueInWin, args)
                    }
                    return Reflect.apply(valueInWin, window, args);
                };
                
                // 修正函数的name和length属性
                Object.defineProperties(newFn, {
                    length: {
                        // 覆写
                        value: valueInWin.length,
                        writable: false,
                        enumerable: false,
                        configurable: true
                    },
                    name: {
                        // 覆写
                        value: valueInWin.name,
                        writable: false,
                        enumerable: false,
                        configurable: true
                    },
                });
        
                return newFn;
            }
            
            return valueInWin;
        }
    });
    

这样仍然存在问题，就是每次访问这种函数属性，Proxy 都会构造出一个新函数实例来，造成 _winProxy.matchMedia !== winProxy.matchMedia_ 的问题来。怎么解决呢？我们可以把它们缓存下来，写到 target 上，留给大家试试吧！

可以看到，相比而言 get 要复杂一些，它是所有 handler 中最难的，主要就是由于函数的上下文问题。

小结
--

虽然上面没有将 Proxy 的所有 handler 全部实现，但也达到了目的，其他 handler 大多也用的同样的知识，就留给你了。回顾一下，本文涉及的知识点：

1.  Proxy 及其`不变量`；
2.  `class` 语法；
3.  对象构造、操作+原型链；
4.  `Reflect` API；
5.  属性描述符及其指令；
6.  函数上下文；
7.  构造函数与 `new.target`；
8.  数组与 `Set`；
9.  全局属性；
10.  ……

希望大家在实现剩余 handler 的时候能拓展出包括对象遍历在内的更多知识点。

下一篇我们继续实现沙盒的其他特性，并完成最后的组装。