你是否好奇 QUIC 是如何`解决队头阻塞`问题并确保消息的可靠性和有序性的呢？在上文末尾，我们已经深入了解了`QUIC Packet`包格式和`Frame`帧格式，还提到了`Stream Frame`的`Offset`字段。

现在，让我们进一步探究 QUIC 如何通过一系列的创新和努力，解决队头阻塞问题并确保消息传输的可靠和有序。

QUIC 同时解决队头阻塞并保证消息有序
====================

我在实验并`DEBUG`源码的过程中，意外地抓到了`QUIC`包的重传包。

发现重传的 QUIC Packet
-----------------

查看 `quiche` 处理头部和帧的关键路径的某些代码逻辑，其中 `handle_frame` 函数的部分处理如下：

    frame::Frame::Crypto { data } => {
        // Push the data to the stream so it can be re-ordered.
        
        //在这行代码插入断点，debug 运行server，会发现客户端的Initial packet 重传了。
        self.pkt_num_spaces[epoch].crypto_stream.recv.write(data)?;
    
        ...
    
        self.do_handshake(now)?;
    },
    

匹配到 `frame::Frame::Crypto` 类型的帧后，在该行代码处设置断点，通过调试运行服务器，可以发现客户端的初始数据包`Initial packet`被重传了，但是这些重传包的编号`Packet Num`并不相同。抓包如下图所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60ddd8e60d624deba3dc8141002ce692~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2920&h=1417&s=2542168&e=png&b=242424)

在服务器`Debug`卡顿期间，客户端未能收到服务器回复，导致客户端重传了 `Initial packet`。这些重传包的 `PacketNum` 递增，并在一定次数后结束。类似于 TCP 的握手过程，QUIC 握手包的重传也有最大次数和一些策略。

然而，这些重传包的 `PacketNum` 并不相同。这与 TCP 使用相同的序列号来重传数据包的方式不同。

在进一步观察中，我们发现握手包和应用数据包都存在重传的情况。以下是握手包`Handshake Packet`的抓包数据，可以看到它被多次重传。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/36af843b06af4122a494fc476494991b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2658&h=398&s=283412&e=png&b=d8ecfd)

同样地，下图是调试过程看到的应用数据包中`Short Packet`的重传情况。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/422526ba6fad4c5d822b99dc4092d660~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2862&h=1512&s=1220527&e=png&b=3c4143)

可以看到，`Packet Num 0、5、7`都重传了`stream_id 为 2`、`偏移量为 0`的帧（`Frame`）。

你可能会问，这些重传包的 `PacketNum` 并不相同，那`QUIC`要如何确保数据的有序性以及如何按顺序将数据交付给上层应用程序？

不要着急，我们先回顾一下`TCP 的重传`机制。

回顾 TCP 的重传机制
------------

我们之前讲过`TCP 的重传`机制，其中包括超时重传和快速重传等机制。如下图所示，当序号为`4`的包发生超时（例如在网络中丢失）时，TCP 机制会不断地重传它，但是重传的数据包序号始终保持为`4`。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5454f4d290ba410eb429c09b41e8c63f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1014&h=477&s=164055&e=png&b=fefbfb)

如上所述，如果接收窗口中的`Seq=4`的数据包在传输过程中丢失，将会导致后续的数据包被阻塞，无法传递给应用程序。只有当接收方收到这个`Seq=4`的数据包后，才能将数据包交付给应用程序。而后续接收到的其他`Seq=4`的数据包则会被丢弃。

这里使用了`窗口机制`，接收方告知发送方其接收窗口的大小，以此来控制发送数据的量，根据接收方的实际接收能力进行调整。接收窗口只有在按顺序收到数据后才能向前滑动，否则会停滞不前。发送窗口只有在收到已发送数据的顺序确认`ACK`后才能向前滑动，否则也会停滞不前。这种停滞不前的情况就会导致队头阻塞问题，因此重传相同序号的数据包是阻塞问题的起因。

`HTTP2`采用多路复用技术，可以使用更少的`TCP`连接数量来减少建立连接的开销。然而，队头阻塞问题变得更加严重。多个`Frame`之间相互影响，如下图所示。如果队列前面发送的`stream 2`中的某个`TCP 包`未被接收，将会影响后续发送的`stream3`和`stream4`的交付。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/63c96424243943d7a2a3b1bfb341d6be~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1053&h=499&s=59878&e=png&b=fcf8f7)

在`QUIC`中，当发生超时重传时，重传的`Packet`的`Packet Num`与之前不同。因为，在同一个连接上，同一个`Packet Number Space`下`Packet Num`是单调递增的。因此，`QUIC`接收数据包时并不关心是否已收到所有的`Packet Num`，也不考虑它们的顺序。

> 在 QUIC 协议中，Packet Number Space 分为以下几个：
> 
> 1.  Initial Packet Number Space：用于建立连接时的握手过程中的第一个 Packet Number Space。
> 2.  Handshake Packet Number Space：用于进行握手过程中的后续通信。
> 3.  1-RTT Packet Number Space：在握手完成后，用于双方之间的正常数据传输。
> 
> 每个 Packet Number Space 都有自己的 Packet Number 编号空间和加密密钥，以确保数据传输的安全性和完整性。

只是，`QUIC`是怎么保证有序的呢？

QUIC Stream 让应用层数据流精细管理
-----------------------

QUIC 不像 TCP 一样利用数据包的编号来保证数据的有序性。然而，QUIC 借鉴并引入了 HTTP2 `Stream`的概念，将相关的数据组织在同一个`Stream`中传输。但这里的`Stream`和 HTTP2 的并不一样，它指的是 `QUIC Frame`包中的 `Stream Frame`。在每个 `Stream` 上，必须保证数据的有序性。

前文我们已经介绍了`Stream`的格式：除了类型和`Stream ID`之外，`Stream`的格式还包括`Offset`和`Length`字段。同一个`Stream`的数据可以按照`Offset 顺序`交付。举个例子，假设这三个数据包在同一个`Stream`上传输，如下图所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/672fecf8159843d5a265598b685de4ae~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1809&h=972&s=148268&e=png&b=ffffff)

如图所示，当数据包 `Packet N` 丢失并重传时，重传的数据包编号为 `Packet N+2`。这些数据包的 `Stream ID` 和 `Offset` 相同，表示它们的内容相同。因此，接收端可以根据这些字段将它们按顺序组织成 `Stream x` 和 `Stream x+y`，并将它们交给应用程序处理。而且`Packet N`的超时重传完全不会影响其他的 `Stream`的顺序。

一个 QUIC 应用只需要使用`一个 QUIC 连接`即可，所以`建立安全可靠连接`的成本开销很小，但要让 QUIC 应用将要保证顺序的数据放在`同一个 stream`中，而将无关的数据放在`不同的 stream`中。举个例子，如果我们需要同时并发传输 400 张图片，可以使用 400 个不同的`stream ID`，这样它们之间就不会相互阻塞。

虽然 TCP 可以使用多个连接来避免队头阻塞问题，但是建立多个连接的成本很高。相比之下，虽然 QUIC 建立连接的成本小不了太多，但是通过设计`多个 Stream`，一个连接就可以避免队头阻塞问题。不过，QUIC 的成功还需要应用程序的支持。例如对于`HTTP`的请求响应模式，可以使用`多个 stream`来达到没有队头阻塞的多路复用。如果应用程序虽然使用 QUIC，而是将所有数据都放在`同一个 Stream`上传输，则仍然会存在队头阻塞问题。

正确理解 Packet Num 的作用
-------------------

你可能会问，既然同一条`Stream`中的数据可以按照`Offset`的顺序进行交付，那么为什么不直接利用`Stream Offset`来实现数据包的重传呢？

因为并不是所有的`Frame`都像`Stream Frame`那样具有`Offset`和顺序处理机制。事实上，一些`Frame`的设计并不需要保证数据的顺序性。因此，为了维护协议的一致性，`QUIC`将所有`Frame`的重传都交给了`Packet`来处理。这种做法还可以提高数据传输的效率和可靠性。

`Packet`在连接中负责管理整个连接的状态和生命周期（区分不同类型的`Packet`），并且承载`Frame`以确保数据完整性，避免数据丢失。而且为了提高传输效率，我们可以将多个`Frame`聚合在一起传输。因此，`QUIC`在`Packet`层面实现重传，而不是使用`Stream Frame`的`offset`来进行重传。

通过这些探讨我们看到，与`TCP`不同，`QUIC 重传`机制和`保证有序`的机制相互独立，才避免了`队头阻塞`问题。

每个`Stream Frame`都有自己的`offset`，通过将数据按照`offset`的顺序放在窗口里对应的位置，保证了数据的有序性，这种实现方式参考了 TCP 的`滑动窗口`设计。在`QUIC`中，流量控制也采用了`Stream`的滑动窗口，以确保不同`Stream`之间的数据传输不会相互影响。

接下来，我们一起来了解一下`QUIC`流量控制的实现方式。

QUIC 协议中的 Stream Frame 的流量控制
----------------------------

`QUIC Stream`参考了 TCP 的`滑动窗口`设计，动态窗口的最大值由服务器和客户端共同协商，这种设计同时实现了顺序交付和流量控制的目的。

每个`Stream`流都有自己的滑动窗口，不同的 Stream 互相独立，因此阻塞其中一个流（如`Stream 1`）不会影响其他流（如`Stream 2、3`）的读取。一个连接上的多个流的滑动窗口的演示如下图所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa54844ce37042328333ae8ba9524678~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=1616&h=886&s=138727&e=png&b=e9ecef)

这个图中，`Stream1`前 300（图中用 3 表示）的数据已经被应用层处理，当前接收到的最大偏移是 900。`stream2`的最大偏移是 800，`Stream3`的最大偏移是 700。每个`Stream`的滑动窗口从已收到但应用未读取的数据开始。

但剩余的接收窗口大小不仅取决于各自的最大窗口大小参数，还不能超过`Connection`级流量窗口大小。下图展示了`Connection`总`可用窗口`大小为`Connection 级别的最大窗口大小`减去`所有 Stream 上已收到但是未读取的数据大小`。

虽然`Stream`级流量控制采用独立的滑动窗口，不同`Stream`之间的数据传输不会相互影响，但是`QUIC`流量控制还包括`Connection 级`流量控制。`Connection`级流量控制限制了所有`Stream`的总滑动窗口总字节数，以防止发送方超过缓冲容量。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2dec2225e57f421b83dabf001c5acd7f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=2158&h=365&s=74564&e=png&b=fcf9f9)

QUIC 的参数交互和流量控制也是通过特定的帧进行的。

探讨 QUIC 协议中的 AEAD
=================

要更好地理解 QUIC，最好的方法是通过调试代码来了解各种内容。因为与处理其他网络协议包不同，QUIC 天生加密，因此无法像其他协议那样直观地查看数据包的结构。

为确保数据加密和包完整性验证，QUIC 采用了`TLS 1.3`中更为完善的加密方案`AEAD`。我们应该先了解`AEAD`的基本原理，然后如果想要进一步深入了解，可以查看代码中处理加解密的部分，更进一步了解 QUIC 的各种数据结构和工作机制。

什么是 AEAD？
---------

`AEAD`（`Authenticated Encryption with Associated Data`）算法是一种同时提供数据`加密`和`完整性`保护的加密算法。它们是对称加密算法，通常在加密和解密数据时使用相同的密钥。

`AEAD`算法的输入包括`明文数据`、`密钥`、`附加数据`和`随机数`。

`密钥`的协商和`HTTPS` `TLS 1.3`的协商过程相同，例如使用椭圆曲线加密算法来协商密钥。

`附加数据`是一些与明文数据相关的数据，如数据包 Packet Header 等。

`随机数`用于确保每次加密操作生成的密文都是唯一的。如果 QUIC 协议使用的 AEAD 算法是`AES-GCM`，则随机数是 12 个字节。

在 QUIC 握手过程中，客户端和服务器会交换`Initial Packet`和`Handshake Packet`，其中包含了 QUIC 连接`双方协商的加密算法`、`密钥`、`随机数`等信息。在 QUIC 协议中，`Packet Number`是单调递增的，因此通过`Packet Number`和`发送方的 ID`等信息即可确保随机数的唯一性。

以下是一个例子，它使用 Rust 语言，采用 `ChaCha20Poly1305` 算法进行 AEAD 加密，并附带额外数据，帮助更好地理解 AEAD。

    use chacha20poly1305::{aead::{Aead, AeadCore, KeyInit, OsRng, AeadInPlace}, ChaCha20Poly1305, Nonce, Tag};
    use rand::thread_rng;
    
    fn main() {
        let key = ChaCha20Poly1305::generate_key(&mut thread_rng());
        let cipher = ChaCha20Poly1305::new(&key);
        let nonce = ChaCha20Poly1305::generate_nonce(&mut  thread_rng()); unique per message
    
        let associated_data = b"metadata";
    
        let mut buffer = Vec::new(); 
         buffer.extend_from_slice(b"hello");
    
        let tag :Tag= cipher.encrypt_in_place_detached(&nonce, associated_data,   &mut buffer).unwrap();
        println!("Encrypted data: {:?}", buffer);
        println!("tag: {:?}", tag);//tag用于验证密文是否被篡改或损坏
        let _ = cipher.decrypt_in_place_detached(&nonce,associated_data, &mut buffer, &tag).unwrap();
    
        println!("Decrypted data: {:?}", buffer);
        assert_eq!(&buffer, b"hello");
    }
    

这段代码使用一个随机数作为密钥，另一个随机数作为 `nonce`，并使用 `encrypt_in_place_detached` 函数对明文 `"hello"` 进行加密，同时生成基于关联数据 `"metadata"` 的验证标签 `tag`，用于确保密文完整性。在解密时，同样使用相同的密钥和 `nonce`，首先使用 tag 验证关联数据和密文的完整性，然后再使用 `decrypt_in_place_detached` 函数解密密文并还原出明文。

QUIC 加解密处理
----------

那让我们具体看下`quiche`中`AEAD`是怎么工作的吧。

如下图左侧是加密过程，为了对 QUIC 数据负载进行加密，QUIC 使用了`encrypt_pkt`函数。该函数使用数据包的`packet num`生成随机数，将`packet header`的一部分作为附加数据`ad`，然后调用`seal_with_u64_counter`函数对数据进行加密。这个函数最终调用了`OpenSSL`库中的`EVP_AEAD_CTX_seal_scatter`函数。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7e3e2d2dc98f4758b93c8ea07e5b5e4c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.jpg#?w=4491&h=2893&s=1858140&e=png&b=2c2c2c)

如上图右侧，为了对 QUIC 数据负载进行解密，QUIC 使用了`decrypt_pkt`函数。同样，使用数据包的`packet num`生成随机数，将`header`的一部分作为附加数据`ad`，然后调用 `crypto`库中的一个函数`open_with_u64_counter`来解密 packet。

当然`AEAD`解密之前还会通过数字签名校验整体数据的完整性。

此外，可以对抓包数据和代码进行对比，以确定加密数据的具体内容。

小结
==

恭喜！现在你已经了解了 QUIC 的许多强大功能，包括`解决队头阻塞`和`保证消息有序`，`传输质量和流量控制`等方面所做的努力，以及了解`AEAD`算法对于数据保护的具体工作机制。但这还不是全部！QUIC 还具有许多其他功能，如`拥塞控制`、`0-RTT`、`连接迁移`等，QUIC 还具有许多应用，比如在`HTTP`领域，这些功能与`HTTP/3`的结合，将使`WEB`更加高效和安全。

所以，不要停止你的探索之旅，有实际使用需求的时候继续深入了解 QUIC 的各种功能和优势吧～