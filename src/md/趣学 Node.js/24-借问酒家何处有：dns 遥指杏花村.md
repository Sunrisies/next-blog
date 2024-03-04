**杜牧：** 酒家在哪？

**牧童：** 杏花村那边。

![25流程图1.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/36a741a1ad0944208b450585998ca4b1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=680&h=786&s=79621&e=png&b=fefefe)

“杜牧”代表的是一个客户端，比如你的电脑或者手机。当你想要访问一个网站（酒家）时，你的设备会发送一个请求到 DNS 服务器（牧童）。

DNS 服务器知道“酒家”（网站）实际上在哪里，也就是他们的 IP 地址（杏花村）。

当 DNS 服务器接收到请求后，他会查找他的记录，找到“酒家”实际上在“杏花村”，然后把这个信息返回给“杜牧”（你的设备）。这样，你的设备就知道了要访问的网站的实际 IP 地址，然后就可以直接和那个 IP 地址建立连接，访问网站了。

看看下面这张时序图，是不是跟上面那张一毛一样？

![25流程图2.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9fad30daca4a4ca58b55fa510ee72b0b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=846&h=778&s=91327&e=png&b=ffffff)

可以说 DNS 是计算机网络中很重要的一环。DNS 全称为“Domain Name System”，是互联网的一项核心服务，它作为一个分布式数据库，存储着互联网的域名和 IP 地址的映射关系。DNS 的主要功能是将人类可读的域名转换为机器可读的 IP 地址。

当你在浏览器中输入一个网址（例如 [www.google.com](http://www.google.com "http://www.google.com") ）时，你的计算机会向 DNS 服务器发送一个查询请求，询问这个域名对应的 IP 地址是什么。DNS 服务器会查找它的记录，找到对应的 IP 地址，然后返回给你的计算机。这样，你的计算机就可以通过这个 IP 地址来访问你想要的网站了。DNS 的工作原理可以简化为以下几个步骤：

1.  用户在浏览器中输入一个 URL，如 [www.google.com](http://www.google.com "http://www.google.com") ；
    
2.  浏览器会向 DNS 服务器发送一个查询请求，询问 [www.google.com](http://www.google.com "http://www.google.com") 对应的 IP 地址；
    
3.  DNS 服务器会查找它的记录，找到 [www.google.com](http://www.google.com "http://www.google.com") 对应的 IP 地址；
    
4.  DNS 服务器将找到的 IP 地址返回给浏览器。浏览器使用返回的 IP 地址来访问 [www.google.com](http://www.google.com "http://www.google.com") 。
    

DNS 不仅仅用于将域名转换为 IP 地址，它还可以用于邮件服务，通过将邮件服务器的域名转换为其对应的 IP 地址。

Node.js 中的 DNS
--------------

Node.js 的 `dns` 模块是一个内置模块，用于处理与域名服务器（DNS）相关的操作。这个模块提供了一系列的函数，可以用来解析域名，查找域名对应的 IP 地址，以及其他与 DNS 查询相关的操作。

以下是 `dns` 模块的一些主要函数：

1.  `dns.lookup(hostname[, options], callback)`：这个函数将一个域名（如 `'google.com'`）解析为第一条找到的 IPv4 或 IPv6 地址。它使用底层操作系统工具进行域名解析，可以使用 `options` 参数来指定 IP 地址的版本和其他选项。
    
2.  `dns.resolve4(hostname, callback)`：这个函数将一个域名解析为一个 IPv4 地址数组。它使用网络进行 DNS 解析，不受本地主机文件或者其他可能影响 `dns.lookup` 的因素的影响。
    
3.  `dns.resolve6(hostname, callback)`：这个函数将一个域名解析为一个 IPv6 地址数组。它的工作方式和 `dns.resolve4` 类似，只是返回的是 IPv6 地址。
    
4.  `dns.resolveMx(hostname, callback)`：这个函数用于解析一个域名的邮件交换（MX）记录。
    
5.  `dns.reverse(ip, callback)`：这个函数用于进行反向 DNS 查询，将一个 IP 地址解析为一个域名。
    

这些函数都是异步的，它们的结果会通过回调函数返回。回调函数的第一个参数是一个可能存在的错误对象，如果没有错误，那么这个参数就是 `null`。其余的参数是查询的结果。

使用 `dns` 模块需要先用 `require` 函数导入它，如下所示：

    const dns = require('dns');
    

然后你就可以使用 `dns` 模块的函数了。例如，下面的代码将 `google.com` 解析为一个 IP 地址：

    dns.lookup('google.com', (err, address) => {
      if (err) throw err;
      console.log(address);
    });
    

这段代码会在控制台打印出 `google.com` 的 IP 地址。如果在解析过程中发生了错误，那么这个错误会被抛出。

不同的实现
-----

在上面的几个 API 中，其实分了两类实现。

1.  `getaddrinfo()`；
    
2.  c-ares。
    

### `getaddrinfo()`

`getaddrinfo()` 是一个 POSIX 标准的函数，用于处理网络名称服务。无论你的程序是在 IPv4 还是 IPv6 网络中运行，或者是在其他任何类型的网络中运行，你都可以使用相同的 `getaddrinfo()` 调用来获取你需要的地址。然而，`getaddrinfo()` 的一个缺点是它通常是阻塞的，这意味着如果 DNS 查询需要花费一些时间，那么你的程序可能会被挂起，直到查询完成。

> 实际上，libuv 有封装 `uv_getaddrinfo()` 函数，在 Linux、macOS 等操作系统中最终调用的就是 `getaddrinfo()`，而在 Windows 系统下，调用的是 `GetAddrInfoW()` 这个系统 API。

### c-ares

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f129e833e3c44ee999c92b5db16b14d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=460&h=160&s=65574&e=png&b=ffffff)

c-ares（**C** **A**synchronous **Res**olver）是一个 C 语言库，用于异步处理 DNS 查询。c-ares 是对早期的 ARES（**A**synchronous **Res**olver）库的改进，它提供了一种非阻塞的方式来处理 DNS 查询。c-ares 支持多种类型的 DNS 查询，包括 A（IPv4 地址）查询，AAAA（IPv6 地址）查询，以及其他类型的查询。

c-ares 的主要优点是它的异步性。当你使用 c-ares 发送一个 DNS 查询时，你的程序不需要等待查询完成，你可以继续执行其他任务。当查询完成时，c-ares 会调用一个回调函数，将查询结果传递给这个函数。这使得 c-ares 非常适合用于需要处理大量 DNS 查询的程序，或者需要在查询完成之前执行其他任务的程序。

### `dns` 模块中不同的实现

在 Node.js 中， `dns.lookup()` 和各种 `dns.resolve*()`、`dns.reverse()` 都有冥冥中给 IP 地址与网络名称（域名）牵红线的作用，但底层用的是不同的实现。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/00009d6cad614a7d8369decb81064861~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=224&s=43293&e=png&b=fafafa)

为了知道这红线到底绑在了哪里，大家还是有必要了解一下各自到底怎么绑的。（废话文学）

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/94c305ed938c48eaac07284ad0ce23d6~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=34043&e=png&b=fbfbfb)

#### `dns.lookup()`

`dns.lookup()` 实际上底层调用的是 `getaddrinfo()`。大家可能觉得有点奇怪，你自己明明刚不还说 `getaddrinfo()` 是同步的吗？`dns.lookup()` 明明是异步的。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b76c46515e543b8850de807c152dc22~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=222&h=227&s=54371&e=png&b=f8f7f6)

这是忘了上一章中画的图了吗？

![25流程图（同24）.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f8bf855b9bf342d68f335c91533a4366~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3108&h=674&s=135626&e=png&b=fffdfd)

`dns.lookup()` 底层调用的是 `uv_getaddrinfo()`，而 `uv_getaddrinfo()` 则是在 libuv 的线程池中调用 `getaddrinfo()` 来获取结果，并在主事件循环中得到结果。它有可能是上图中任意的一段紫色任务，然后只有到下一次的 Poll for I/O 阶段才会在主事件循环中真正拿到结果，并执行接下去的黄色部分。

我们来看看 `uv_getaddrinfo()` 中最核心的几行代码吧：

    int uv_getaddrinfo(uv_loop_t* loop,
                       uv_getaddrinfo_t* req,
                       uv_getaddrinfo_cb cb,
                       const char* hostname,
                       const char* service,
                       const struct addrinfo* hints) {
      ...
      
      if (cb) {
        uv__work_submit(loop,
                        &req->work_req,
                        UV__WORK_SLOW_IO,
                        uv__getaddrinfo_work,
                        uv__getaddrinfo_done);
        return 0;
      } else {
        uv__getaddrinfo_work(&req->work_req);
        uv__getaddrinfo_done(&req->work_req, 0);
        return req->retcode;
      }
    }
    

上一段代码中，如果 `cb`（即回调函数）为空，则认为此次是同步调用，直接依次调用 `uv__getaddrinfo_work()`、`uv__getaddrinfo_done()` 并返回成功与否（`req->retcode`）；而如果 `cb` 不为空，则通过 `uv__work_submit()` 来在 libuv 的线程池中执行 `uv_getaddrinfo_work()` 等。

> 这里怎么又冒出个 `uv__work_submit()`？实际上我们在[第 21 章](https://juejin.cn/book/7196627546253819916/section/7197302115818176515 "https://juejin.cn/book/7196627546253819916/section/7197302115818176515")提到的 `uv_queue_work()` 底层用的就是 `uv__work_submit()`。这么一来是不是就好理解了。如果 `cb` 不为空，则通过 `uv_queue_work()` 的方式来在 libuv 的线程池中执行 `uv_getaddrinfo_work()` 并返回结果。所以这里我们只要把第 21 章里面的那张图改巴改巴就能用在这里了：

![25流程图3.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/28a0ca71550a4ba7a1633dbcc473e456~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=924&h=500&s=115400&e=png&b=edebe6)

> 我们再拿着这张图对比上一章的图，是不是感觉天下各种图一大抄 （我 cāo 我自己）。

![25流程图（同24）.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea6ed22037e74a57b371f1ffa2918a40~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3108&h=674&s=135626&e=png&b=fffdfd)

我们讲了 `uv_getaddrinfo()` 的同步、异步，讲了 `uv__work_submit()`，讲了 `uv_queue_work()`。那么 `uv__getaddrinfo_work()` 里面究竟是怎么查询结果的呢？

    static void uv__getaddrinfo_work(struct uv__work* w) {
      ...
      err = getaddrinfo(req->hostname, req->service, req->hints, &req->addrinfo);
      ...
    }
    

最核心就是这么一句话：`err = getaddrinfo(..., ..., ..., ...)`。调用 POXIS 的 `getaddrinfo()` 这个同步 API 来查询结果。

> POSIX，全称为 Portable Operating System Interface（便携式操作系统接口），是一个由 IEEE（Institute of Electrical and Electronics Engineers，电气和电子工程师协会）定义的一套操作系统 API 标准。这套标准的目的是提高各种不同操作系统之间的兼容性，使得软件开发者可以编写一次代码，然后在多种操作系统上运行。
> 
> POSIX 标准定义了许多操作系统的基本特性，包括文件系统、shell、线程、进程控制、定时器、内存管理等。这些特性在许多 Unix 和 Unix-like 系统（如 Linux、macOS）中都得到了实现。Windows 系统也提供了一些 POSIX 兼容性的支持，尽管这种支持并不完全。

`getaddrinfo()` 是一个在 POSIX 系统中用于网络地址解析的函数。在发送查询请求之前，它可能会受本地一些文件的影响，并返回本地的结果。

1.  `/etc/hosts`：这个文件是一个简单的文本文件，它将主机名映射到 IP 地址。当你调用 `getaddrinfo()` 时，它可能会首先查看这个文件，看看是否已经有了对应的映射。如果有，那么 `getaddrinfo()` 就会直接返回这个映射，而不需要进行 DNS 查询。
    
2.  `/etc/resolv.conf`：这个文件包含了 DNS 服务器的信息。当你调用 `getaddrinfo()` 时，如果 `/etc/hosts` 中没有对应的映射，那么 `getaddrinfo()` 就会使用 `/etc/resolv.conf` 中的 DNS 服务器来进行 DNS 查询。
    
3.  `/etc/nsswitch.conf`：这个文件定义了名字服务查找的顺序。例如，它可以指定 `getaddrinfo()` 应该先查看 `/etc/hosts`，然后再查看 DNS，或者反之。这个文件的设置会影响 `getaddrinfo()` 的行为。（macOS 下也无该文件，通过另外的机制 Directory Service 达到类似效果。）
    

在 Node.js 中，很多网络请求相关的 API 内部就是通过 `dns.lookup()` 来将主机名（不仅仅是网络上的域名）转换成 IP 后再请求出去，比如 HTTP 请求的底层就是通过 `dns.lookup()`，而不是 `dns.resolve*()`。这能保证它在请求的时候寻址逻辑与系统保持一致。

不过，通常这些 API 也都支持用户传入自己的 `lookup()` 逻辑，以接管寻址的逻辑。比如 `http` 模块中的 `request()` 函数就运行用户自行传入 `lookup` 函数以代替默认的 `dns.lookup()` 逻辑，从而做到一些劫持。

#### `dns.resolve()`、`dns.resolve*()` 和 `dns.reverse()`

本节标题中的三类函数底层用的都是 c-ares 提供的查询函数。c-ares 有一个 Channel 的概念，每个 Channel 都是一个独立的查询器。Node.js 中也为大家使用了这个概念，只不过在用户侧 API 中，它不再叫 Channel，而叫 [Resolver](https://nodejs.org/dist/latest-v18.x/docs/api/dns.html#class-dnsresolver "https://nodejs.org/dist/latest-v18.x/docs/api/dns.html#class-dnsresolver")。

Resolver 类中有若干方法，如 `resolve()`、`resolve4()`、`resolve6()` 等等。而 `dns` 这个模块中本身就挂载上了 `resolve()`、`resolve4()`、`resolve6()` 等方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/87b911e2ff5248de9fbe76e6dfaa0173~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=846&h=846&s=569521&e=png&b=aec7cd)

我们先看看 `dns` 下的 `resolve()` 这些函数怎么来的吧：

    function getDefaultResolver() {
      if (defaultResolver === undefined) {
        defaultResolver = new ResolverBase();
      }
      return defaultResolver;
    }
    
    function bindDefaultResolver(target, source) {
      const defaultResolver = getDefaultResolver();
      resolverKeys.forEach((key) => {
        target[key] = source[key].bind(defaultResolver);
      });
    }
    
    bindDefaultResolver(module.exports, Resolver.prototype);
    

简而言之，就是懒加载构造一个 `Reslver` 对象，这个 `ResolverBase` 虽然不是正儿八经的 `Resolver` 本体，但也大差不差，无需纠结。拿到 `ResolverBase` 之后，把 `Resolver` 原型链上的函数一个个绑定（`<func>.bind()`）上 `defaultResolver` 作为 `this` 后，挂在 `module.exports` 下。所以 `dns` 下默认挂的 `resolve()` 可以理解为是默认 `Resolver` 对象的 `resolve()` 方法，其它函数同理。

`resolve()` 这些函数实际上指向的是 `Resolver` 对象。而一个 `Resolver` 对象对应一个 c-ares 的 Channel。

![25流程图4.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/813521b5bfe749e39244eda2068b9425~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=642&h=1364&s=141721&e=png&b=ffffff)

在 c-ares 中，每新建一个 Channel，都会对其进行一次初始化。在 Node.js 中，初始化采用 c-ares 的默认选项。而该默认选项的行为是让其在初始化的时候从 `/etc/resolv.conf` 拿到 DNS 服务器的地址（针对 Linux 和 macOS 等）。

> `/etc/resolv.conf` 是 Unix 和 Unix-like 系统（包括 Linux 和 macOS）中的一个配置文件，它用于设置 DNS 客户端的行为。这个文件通常包含一些 `nameserver` 行，每行指定一个 DNS 服务器的 IP 地址。当系统需要进行 DNS 查询时，它会使用这些服务器。
> 
> 以下是一个 `/etc/resolv.conf` 文件的示例：
> 
>     nameserver 8.8.8.8
>     nameserver 8.8.4.4
>     
> 
> 在这个示例中，系统会首先使用 IP 地址为 8.8.8.8 的 DNS 服务器进行查询。如果这个服务器无法响应，或者响应的结果不满足查询的需求，那么系统会使用 IP 地址为 8.8.4.4 的 DNS 服务器。

我们通过 `dns.getServers()` 拿到的 DNS 服务器地址就是从这个文件读出来的，该地址可以通过 `dns.setServers()` 去设置，但仅针对单个 `Resolver` 生效，不会回写 `/etc/resolv.conf`。总之就是每次新建一个 `Resolver` 都会从 `/etc/resolv.conf` 拿到地址，此后就与该文件无关了。

所有的 `dns.resolve()`、`dns.resolve*()`、`dns.reverse()` 这类方法最终都会直接根据定义好的 DNS 服务器地址去发起查询请求。这就是其与 `dns.lookup()` 也就是 `getaddrinfo()` 不同的地方了。我们前面讲过，`getaddrinfo()` 会受 `/etc/hosts`、`/etc/nsswitch.conf` 等内容的影响。此外 `getaddrinfo()` 的结果被一些 Linux 服务进行缓存。例如，若我们开启了 `nscd` 服务，那么 `getaddrinfo()` 的网络查询逻辑就会被其拦截接管，实际上走的是 `nscd` 的查询，若里面有 DNS 缓存，则会直接返回。而 c-ares 则是实打实地去网络服务进行请求查询。

> 有兴趣可以阅读一下这篇文章：[nscd-dns缓存的实现原理与关键参数 | 鱼儿的博客](https://yuerblog.cc/2020/05/23/nscd-dns%E7%BC%93%E5%AD%98%E7%9A%84%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86%E4%B8%8E%E5%85%B3%E9%94%AE%E5%8F%82%E6%95%B0/ "https://yuerblog.cc/2020/05/23/nscd-dns%E7%BC%93%E5%AD%98%E7%9A%84%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86%E4%B8%8E%E5%85%B3%E9%94%AE%E5%8F%82%E6%95%B0/")。

这就是 `dns` 模块下，`lookup()` 和其它查询函数的区别，而这个区别实际上就是 POSIX 接口 `getaddrinfo()` 与 c-ares 库的区别。

本章小结
----

本章为大家介绍了 Node.js 中的 DNS 模块，以及不同函数在 DNS 模块中的两种实现。

1.  POSIX 接口 `getaddrinfo()`；
2.  c-ares。

其中 `getaddrinfo()` 与系统行为可以保持一致，而 c-ares 则每次都通过预先设置好的 DNS 服务器地址（默认情况下是 `/etc/resolv.conf` 中的地址）发起查询请求进行查询。

只有 `dns.lookup()` 才使用的 `getaddrinfo()`，而剩下的查询函数则都是使用了 c-ares 库。在 Node.js 中，基本上内置模块中的默认 DNS 查询都是通过 `dns.lookup()` 进行的，为的就是与系统行为保持一致。