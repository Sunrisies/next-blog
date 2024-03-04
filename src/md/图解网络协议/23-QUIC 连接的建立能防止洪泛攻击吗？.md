在前文中，我们介绍了`HTTP/2`的`TCP 队头阻塞`问题，并引出了`QUIC`和`HTTP/3`。我们发现在`弱网络`下，`HTTP/3`表现出了强劲的性能，并初步探讨了`QUIC 包`。然而，这些引出了更多的好奇和问题，例如，`QUIC`是如何解决`队头阻塞`问题的？`QUIC`如何`握手`、如何保证数据传输的安全性，以及如何实现`不丢包`、`顺序交付`以及`流量和拥塞控制`等功能。

因此，本文将从`运行`一个 QUIC 例子开始，以期通过实践来观察并思考这些问题。

探究基于 QUIC 协议的软件实现
=================

网站 [interop.seemann.io/](https://interop.seemann.io/ "https://interop.seemann.io/") 提供测试`QUIC`协议功能、性能和软件互操作性的服务。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/86a1e94cc6794f7d90cbb32a3897474a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=3634&h=1366&s=485024&e=png&b=ffffff)

可以看到`QUIC 协议`目前有非常多的软件实现，但是都还处于初步阶段，比如这里的`nginx`、`quic-go`和`quiche`等。

引入 quiche 源码
------------

我选择了`quiche`作为源码研究对象。该项目的 GitHub 地址为 [github.com/cloudflare/…](https://github.com/cloudflare/quiche "https://github.com/cloudflare/quiche") ，最新版本为`0.18.0`的`release`版本。虽然仍未完全成熟，但基本功能已经具备，我们可以尝试使用。

     $ git clone --recursive https://github.com/cloudflare/quiche
     $ git checkout 0.18.0
     $ cargo test
    

> 由于`quiche`是用`Rust`编程语言实现的，因此在使用之前需要先了解一些`Rust`的知识，并安装`cargo`进行编译和运行。

可以使用`cargo test`来测试其支持哪些功能。如下图所示：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8ce5fec9456e48ab904780601b277be8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1974&h=440&s=169595&e=png&b=0e2b35)

我们可以先运行测试来确定`quiche`支持哪些功能点，然后再查看关心的某个测试对应的源代码。此外，`quiche`还提供了一些应用程序和示例，以及可供使用的现成库。我们可以使用这些示例服务来演示`quiche`的功能。

示例 HTTP3 服务
-----------

为了查看最详细的日志级别，可以使用`RUST_LOG=trace`（确认加上`let _ = env_logger::try_init();`）打开日志，然后分别运行服务器和客户端。在终端中，使用以下命令行运行 HTTP/3 服务器：

    RUST_LOG=trace cargo run --example http3-server
    

使用以下命令行运行 HTTP/3 客户端：

    RUST_LOG=trace cargo run --example http3-client https://127.0.0.1:4433/
    

在日志中，可以看到客户端发送的请求和收到的响应，例如：

    INFO http3_client] sending HTTP request [":method: GET", ":scheme: https", ":authority: 127.0.0.1", ":path: /", "user-agent: quiche"]
    

    [2023-08-28T13:57:22Z INFO http3_client] got response headers [(":status", "404"), ("server", "quiche"), ("content-length", "10")] on stream id 0
    

在客户端发起请求后，服务器端会建立连接并成功处理请求。同样，可以在 IDE 中运行程序并打开日志和调试选项，以查看客户端和服务器之间的交互过程。

通过打开`trace`级别的日志，我们可以查看大量详细的日志信息，包括发送的请求和收到的响应，以及构造的各种类型的数据包。结合日志，我们一起来看一下示例代码`http3-server.rs`和`http3-client.rs`，如下图所示：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99ba1038cc3544758ff47dec8da8a1eb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1112&h=532&s=89530&e=png&b=0e2b35)

`UDP`协议是一种`无连接`的传输协议，不需要建立连接或维护连接状态，每个 UDP 数据报都是独立的。然而`QUIC`协议是需要维护连接状态的，`quiche`在编程中，需先通过`socket`监听`UDP`端口，然后在`UDP 四元组`上创建服务器和客户端的`QUIC 连接`来维护连接状态。

下面先一起来看下 `quiche 的 QUIC 编程范式`。

### 监听 UDP 端口的 Socket 套接字

为了使用`QUIC`协议，我们需要让服务器监听`UDP`端口，示例`HTTP3`服务使用了 `4433` 端口。和`TCP`类似，我们可以通过命令来检查`UDP`是否在监听某个端口。例如，使用`lsof`命令可以查看`UDP`端口：

    $ lsof -i udp:4433
    COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
    http3-ser 83306  ywz    4u  IPv4 0xd2b9ddc506fa2a65      0t0  UDP localhost:4433
    

在`http3-server.rs`中，也首先使用以下代码来监听 UDP 端口：

    let mut socket =mio::net::UdpSocket::bind("0.0.0.0:4433".parse().unwrap()).unwrap();
    

操作系统的网络协议栈会负责接收和处理网络数据包，包括`UDP 数据包`。当一个应用程序监听一个`UDP`端口时，操作系统会在协议栈中为该端口创建一个套接字（`socket`），并将该套接字与应用程序绑定。当该 UDP 端口收到数据包时，操作系统会将数据包传递给该套接字，应用程序就可以从套接字中读取数据包。

因此，操作系统知道哪些`UDP`端口正在被监听，以及与哪些应用程序相关联。`lsof`命令就是通过查询操作系统的网络状态信息来获取`UDP`端口的监听情况。

### 客户端发起 QUIC 连接请求

客户端`http3-client.rs`使用`UDP socket`创建自己的`QUIC`连接，并发送数据。代码如下：

    // 创建QUIC连接并进行握手
    let mut conn = quiche::connect(url.domain(), &scid, local_addr, peer_addr, &mut config)
        .unwrap();
    // 构造QUIC握手数据包
    let (write, send_info) = conn.send(&mut out).expect("initial send failed");
    // 使用UDP socket发送数据
    while let Err(e) = socket.send_to(&out[..write], send_info.to) {
        if e.kind() == std::io::ErrorKind::WouldBlock {
            debug!("send() would block");
            continue;
        }
        panic!("send() failed: {:?}", e);
    }
    

此段代码包含以下三个步骤：

1.  创建`QUIC 连接`。
2.  构造`write`长度的`QUIC 握手`数据包，将其保存到`缓冲区 out`中。
3.  使用`UDP socket`将`缓冲区 out`中 write 长度的内容（`QUIC 握手`数据包）发送出去。

通过这些步骤，客户端开始向服务器发起`QUIC` 连接初始化请求。

### 服务器响应 QUIC 连接请求

在服务器的`socket accept（）`监听 UDP 端口之后，我们需要执行以下步骤来处理`quic`连接的`accept`。

1.  通过 socket 接收`quic 包`，将其放入缓冲区`buf`中，并记录接收到的长度`len`和来源`from`。

    let (len, from) = socket.recv_from(&mut buf)
    let pkt_buf = &mut buf[..len]
    

2.  使用`quiche::Header::from_slice()`方法从`pkt_buf`中解析出 QUIC 包的头部信息`hdr`。该方法需要传入以下参数：
    *   `pkt_buf`：包含 QUIC 包数据的缓冲区。
    *   `max_conn_id_len`：QUIC 连接 ID 的最大长度。
    *   其他参数：根据需要传入。

    let hdr = match quiche::Header::from_slice(
        pkt_buf,
        quiche::MAX_CONN_ID_LEN,
    )
    

3.  根据接收到的信息构造服务器的响应请求，例如执行握手的下一步操作。

    loop {
        let (write, send_info) = match client.conn.send(&mut out) {
            Ok(v) => v,
    
            Err(quiche::Error::Done) => {
                debug!("{} done writing", client.conn.trace_id());
                break;
            },
    
           ...
        };
    
        if let Err(e) = socket.send_to(&out[..write], send_info.to) {
            ...  
    }
    

建立连接是一个有状态的过程，类似于 TCP 连接。服务器收到客户端的`Initial` Packet 后，使用循环发送接收数据包直到连接建立完成。抓包如下图所示：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8fd2fcc2192f45948461f13f2d37d700~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=4222&h=3591&s=2197204&e=png&b=fefefe)

发送过程中，根据当前的连接状态，会发送相应的数据包。如果收到有效的`Initiate` Packet 请求，服务器会响应`Initial` Packet（`ACK` Frame 和`Crypt` Frame）以及`Handshake` Packet（密钥）。客户端接收到服务器的`Handshake` Packet 后，会响应 ACK，并发送自己的`Handshake` Packet，如果有应用数据也可以携带应用数据。

`QUIC`协议相比 TCP 的一个特别大的改进就是引入了`连接 ID`。与 TCP 中唯一的四元组不同，QUIC 协议使用`SCID`（源连接 ID）和`DCID`（目标连接 ID）这两个标识符来唯一标识一个 QUIC 连接。通过连接 ID，即使网络发生变化，连接也可以保持，并且允许 QUIC 协议支持`连接迁移`。这一规范使得连接可以在不中断的情况下从一个网络接口切换到另一个网络接口，让连接始终保持畅通无阻，给用户带来更加稳定、流畅的网络体验。

当客户端初次连接服务器时，它会发送一个带有随机生成的`SCID`的初始握手数据包。一旦服务器接收到数据包，它会立即生成一个`新的随机 DCID`，并将其作为响应发送回客户端。随后，客户端将`使用新的 DCID 作为源连接 ID`，继续发送后续数据包。同时，服务器会将客户端发送的 SCID 作为目标连接 ID，以确保响应数据包被正确路由。

安全握手中的加密套件
----------

与 TCP 使用 Sync 包的握手过程相比，`Initiate` Packet 和`Sync`包含的信息不同。`Initiate`包含`Packet Num`和`CRYPT 帧`，其中包含加密套件等信息，而`Sync`不包含。

在 QUIC 握手期间，客户端和服务器之间交换`版本号`、`连接 ID`、`加密套件`等信息。

`TLS_AES_128_GCM_SHA256`是一种 TLS 1.3 中的加密套件，使用`AES-128-GCM`加密算法和`SHA-256`哈希算法，同时使用`ECDHE`密钥交换算法和 P-256 曲线来协商加密密钥。

> TLS\_AES\_128\_GCM\_SHA256 的加密过程如下：
> 
> 1.  首先，客户端向服务器发送 ClientHello 消息，其中包括支持的加密套件列表，其中就包括了 TLS\_AES\_128\_GCM\_SHA256。
> 2.  服务器从客户端发来的加密套件列表中选取 TLS\_AES\_128\_GCM\_SHA256 作为加密套件，并向客户端发送 ServerHello 消息，其中包括选定的加密套件。
> 3.  客户端和服务器使用`ECDHE`（基于椭圆曲线的密钥交换算法）协商出一个对称加密密钥。（这里需要再次强调一下 ECDHE。）
> 4.  客户端使用该对称加密密钥和 AES-128-GCM 加密算法对数据进行加密，并使用 SHA-256 哈希算法计算出一个认证标签。
> 5.  服务器接收到加密后的数据后，使用相同的对称加密密钥和 AES-128-GCM 加密算法进行解密，并使用 SHA-256 哈希算法计算出一个认证标签，验证数据的完整性。
> 6.  如果认证标签与客户端发送的认证标签一致，则说明数据没有被篡改，服务器可以正确地处理数据。

QUIC 防止洪范攻击
-----------

在建立连接时，TCP 半连接队列和 SYN 洪范攻击是常见的安全问题。为了避免这些问题，QUIC 引入了`TOKEN`机制，以抵御`DDoS 攻击`和内存泄漏。当客户端初次连接时，服务器会发送一个`TOKEN`给客户端。客户端在后续的连接请求中携带此 TOKEN，服务器会验证 TOKEN 并建立连接。这种类似于 TCP 的`Sync Cookie`机制，可以有效保护服务器的内存，并为用户提供更加安全和可靠的连接。

支持`TOKEN`功能的服务器会在收到`没有 TOKEN`的连接`Initial Packet`请求时，回复一个带有`TOKEN`的`Retry`包，如下图所示：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/764dcff699064e029b5203138353b615~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2824&h=1896&s=961192&e=png&b=1a1a1a)

在代码实现中，服务端精心构造了一个长度为`len`的`retry`包，并将其存储在`out`缓存中。接着，我们通过 UDP socket 将其传送到对方，下面是代码的具体实现：

    let token = hdr.token.as_ref().unwrap();
    if token.is_empty() {
        let new_token = mint_token(&hdr, &from);//生成一个token
        let len = quiche::retry(
            &hdr.scid,
            &hdr.dcid,
            &scid,
            &new_token,
            hdr.version,
            &mut out,
        ).unwrap();
        let out = &out[..len];
        socket.send_to(out, from)
    }
    

这里需要讲生成的`token`中包含了`UDP 四元组`信息的编码，从而实现类似于 TCP 的“`SYN Cookie`”机制。

至此我们看到，QUIC 的连接建立过程不仅像 TCP 连接一样使用`序列号`（Packet Num）和`ACK`机制，还支持 TLS 信息协商。此外，`Retry 包`的引入还有助于防止`DDoS`攻击。

尽管我们已经分析了`QUIC 连接建立`的基本过程，但是我们还需要更全面地了解 QUIC 的`包格式`和`Frame 机制`，才能更好地理解此连接过程和后续的数据传输等机制。

Packet 与 Frame：理解 QUIC 协议的层次
============================

让我们先来了解一下 `QUIC` 的包和帧格式，并对其有一个基本的理解。如下图所示，从上面例子里抓到的应用数据包可以看到，在 `UDP` 报文头部和 `HTTP3` 之间，共有 2 层头部：`Packet Header`和`QUIC Header`。

> 注意：使用 `Wireshark` 查看 `QUIC` 数据包时，`QUIC HEADER` 和负载都会加密，因此无法直观地观察到其内容。后面探讨到`AEAD`的加密解密时，可以尝试将其解密。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8cf3d02e76b84d0db39c15358dfb2a30~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2400&h=650&s=300135&e=png&b=191919)

其中 `Packet Header` 实现了可靠的连接和连接迁移，`QUIC Frame Header` 实现了无序的 Packet 报文中的有序字节流，而 `HTTP3` 包含了 `HEADER` 和 `payload`。`HTTP3 Frame Header` 则定义了 `HTTP Header`、`Body` 的格式，以及服务器推送、`QPACK` 编解码流等功能。

本文重点探讨 `Packet` 和 `Frame`，而另外一个层次的 `HTTP3`，也是一个全新的协议，但我们之前已经讨论了 `HTTP2`。虽然 `HTTP3` 和 `HTTP2` 不完全相同，但它们的主要区别在于 `HTTP3` 是基于 `QUIC` 构建的，旨在提供更好的性能。

Packet 层
--------

一个 `UDP` 包可以合并多个 `QUIC Packet`。本文已经出现了几种 `Packet` 类型，其中 `Packet Header` 有两种格式：`Long Packet Header` 和 `Short Packet Header`，分别用于首次建立连接和日常传输数据。 在 `Long Packet Header` 中，包括了不同类型的 `Header`，例如 `Initial`、`Handshake`、`0-RTT` 和 `Retry`。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6e8efad0cb294517848e147748375f88~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=5800&h=2600&s=1417979&e=png&b=fdfdfd)

QUIC 使用 `Packet Header` 是为了实现以下主要目的：

*   约定`QUIC`的版本，约定`QUIC`的版本是为了确保通信双方使用相同的协议版本，以避免由于协议版本不兼容导致的通信失败或安全漏洞。
*   `Packet Num` 可以实现报文重传，这意味着如果一个 `Packet` 丢失，它可以被重新发送而不会影响其他 `Packet` 的传输。`ACK` 分为三种类型的空间，分别是：`Initial`、`handshake` 和 `Application`。不同空间的包`序列号`和 `ACK` 互不影响。
*   `Connection ID` 字段在 `Packet Header` 中也起到重要作用，它定义了连接，这意味着即使 IP 地址或端口号发生变化，连接仍然可以保持。
*   当然一些包还有特殊的一些字段，比如我们看到`Initial` 可能含有 `Token` 字段。
*   对于`Short Packet Header` 头部的格式，就不再需要传输 `Source Connection ID` 字段了。

通过抓包观察 `Packet Header`，会发现有些`Packet Number` 像`QUIC Payload`一样被 `TLS` 层加密保护了，这是为了防范各类网络攻击的一种设计。

此外，一个 `Packet` 报文中可以存放多个 `QUIC Frame`，如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/09a63cfb57a746ca822df331206f6bb4~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=837&h=277&s=12799&e=png&b=ffffff)

QUIC Frame 层：关心一下 Stream Frame
------------------------------

`QUIC Frame` 有许多类型，部分类型如下所示：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b037700eeffe44b5b0e975617c99f389~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=4360&h=1763&s=1304220&e=png&b=ffffff)

常用的 QUIC Frame 类型包括：

*   `Ack Frame`：用于确认接收到的数据。
*   `Stream Frame`：用于传递 QUIC 应用层的消息。

其他主要包括两类：

*   参数设置和交互的 Frame：
    *   `Reset Stream Frame`：用于重置某个 Stream。
    *   `Max Data Frame`：用于通知对端允许发送的最大数据量。
    *   `Max Stream Data Frame`：用于通知对端允许发送的某个 Stream 的最大数据量。
    *   `Max Streams Frame`：用于通知对端允许发送的最大 Stream 数量。
*   连接控制的 Frame：
    *   `PING Frame`：用于测试连接的活性并监测延迟。
    *   `Padding Frame`：用于填充空闲数据。
    *   `Connection Close Frame`：用于表示连接关闭。
    *   `Blocked Frame`：用于通知对端 Stream 或连接已被阻塞。
    *   `Stop Sending Frame`：用于指示停止发送某个 Stream 上的数据。

`Stream Frame`用于传递`QUIC 应用层`的数据，值得我们特别注意，它的格式如下所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a65c762b88c9479db5e9bd16f870e8b3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=835&h=271&s=14700&e=png&b=ffffff)

`Stream Frame`头部包含三个字段。其中，`Stream ID`字段用于标识一个有序字节流。当 HTTP Body 需要跨越多个 Packet 传输时，只要在每个 Stream Frame 中含有同样的`Stream ID`，就可以传输任意长度的消息。多个并发传输的 HTTP 消息可以通过不同的`Stream ID`加以区别。另外，`Offset`字段类似于 TCP 协议中的`Sequence`序号，用于实现 Stream 内多个 Frame 间的累计确认功能，从而保证了消息序列化后的“有序”特性。最后，`Length`字段指明了 Frame 数据的长度。这些字段的设计实现了多路复用、有序字节流和报文段层面的二进制分隔功能。

小结
==

本文通过实践基本的`QUIC`服务，首先介绍了基于`quiche`的编程模式，分析了`QUIC`握手过程，然后探讨了 QUIC 使用`Token`防止洪泛攻击，这可以和 TCP 的`Sync Cookie`做比对， 最后分析了`QUIC`包格式和一些`Frame`格式，说到了`Stream Frame`的`Offset`字段，但你知道`QUIC 是怎么解决队头阻塞`的问题，而同时保证消息的可靠和有序的呢？由于篇幅有限，我们将在下文探讨这个主题。