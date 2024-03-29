TIME\_WAIT 是 TCP 所有状态中最不好理解的一种状态。首先，我们需要明确，**只有主动断开的那一方才会进入 TIME\_WAIT 状态**，且会在那个状态持续 2 个 MSL（Max Segment Lifetime）。

为了讲清楚 TIME\_WAIT，需要先介绍一下 MSL 的概念。

MSL：Max Segment Lifetime
------------------------

MSL（报文最大生存时间）是 TCP 报文在网络中的最大生存时间。这个值与 IP 报文头的 TTL 字段有密切的关系。

IP 报文头中有一个 8 位的存活时间字段（Time to live, TTL）如下图。 这个存活时间存储的不是具体的时间，而是一个 IP 报文最大可经过的路由数，每经过一个路由器，TTL 减 1，当 TTL 减到 0 时这个 IP 报文会被丢弃。

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4b9038f7aa~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1924&h=532&s=183046&e=jpg&b=f5f5f5)

TTL 经过路由器不断减小的过程如下图所示，假设初始的 TTL 为 12，经过下一个路由器 R1 以后 TTL 变为 11，后面每经过一个路由器以后 TTL 减 1

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4b904314f8~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1459&h=271&s=67884&e=jpg&b=f4f3f3)

从上面可以看到 TTL 说的是「跳数」限制而不是「时间」限制，尽管如此我们依然假设**最大跳数的报文在网络中存活的时间不可能超过 MSL 秒**。Linux 的套接字实现假设 MSL 为 30 秒，因此在 Linux 机器上 TIME\_WAIT 状态将持续 60秒。

构造一个 TIME\_WAIT
---------------

要构造一个 TIME\_WAIT 非常简单，只需要建立一个 TCP 连接，然后断开某一方连接，主动断开的那一方就会进入 TIME\_WAIT 状态，我们用 Linux 上开箱即用的 nc 命令来构造一个。过程如下图： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4b90306b56~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1754&h=832&s=110700&e=jpg&b=f4f4f4)

*   在机器 c2 上用`nc -l 8888`启动一个 TCP 服务器
*   在机器 c1 上用 `nc c2 8888` 创建一条 TCP 连接
*   在机器 c1 上用 `Ctrl+C` 停止 nc 命令，随后在用`netstat -atnp | grep 8888`查看连接状态。

    netstat -atnp | grep 8888
    tcp        0      0 10.211.55.5:60494       10.211.55.10:8888       TIME_WAIT   -
    

TIME\_WAIT 存在的原因是什么
-------------------

第一个原因是：数据报文可能在发送途中延迟但最终会到达，因此要等老的“迷路”的重复报文段在网络中过期失效，这样可以避免用**相同**源端口和目标端口创建新连接时收到旧连接姗姗来迟的数据包，造成数据错乱。

比如下面的例子 ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/10/15/16dce163cb0bd1d8~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1722&h=1192&s=273648&e=jpg&b=ffffff)

假设客户端 10.211.55.2 的 61594 端口与服务端 10.211.55.10 的 8080 端口一开始建立了一个 TCP 连接。

假如客户端发送完 FIN 包以后不等待直接进入 CLOSED 状态，老连接 SEQ=3 的包因为网络的延迟。过了一段时间**相同**的 IP 和端口号又新建了另一条连接，这样 TCP 连接的四元组就完全一样了。恰好 SEQ 因为回绕等原因也正好相同，那么 SEQ=3 的包就无法知道到底是旧连接的包还是新连接的包了，造成新连接数据的混乱。

TIME\_WAIT 等待时间是 2 个 MSL，已经足够让一个方向上的包最多存活 MSL 秒就被丢弃，保证了在创建新的 TCP 连接以后，老连接姗姗来迟的包已经在网络中被丢弃消逝，不会干扰新的连接。

第二个原因是确保可靠实现 TCP 全双工终止连接。关闭连接的四次挥手中，最终的 ACK 由主动关闭方发出，如果这个 ACK 丢失，对端（被动关闭方）将重发 FIN，如果主动关闭方不维持 TIME\_WAIT 直接进入 CLOSED 状态，则无法重传 ACK，被动关闭方因此不能及时可靠释放。

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4bb50e0f93~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1486&h=1248&s=176319&e=jpg&b=ffffff)

如果四次挥手的第 4 步中客户端发送了给服务端的确认 ACK 报文以后不进入 TIME\_WAIT 状态，直接进入 `CLOSED`状态，然后重用端口建立新连接会发生什么呢？如下图所示

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4bdb2a32f6~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1528&h=1262&s=159934&e=jpg&b=ffffff)

主动关闭方如果马上进入 `CLOSED` 状态，被动关闭方这个时候还处于`LAST-ACK`状态，主动关闭方认为连接已经释放，端口可以重用了，如果使用相同的端口三次握手发送 SYN 包，会被处于 `LAST-ACK`状态状态的被动关闭方返回一个 `RST`，三次握手失败。

为什么时间是两个 MSL
------------

*   1 个 MSL 确保四次挥手中主动关闭方最后的 ACK 报文最终能达到对端
*   1 个 MSL 确保对端没有收到 ACK 重传的 FIN 报文可以到达

2MS = 去向 ACK 消息最大存活时间（MSL) + 来向 FIN 消息的最大存活时间（MSL）

TIME\_WAIT 的问题
--------------

在一个非常繁忙的服务器上，如果有大量 TIME\_WAIT 状态的连接会怎么样呢？

*   连接表无法复用
*   socket 结构体内存占用

**连接表无法复用** 因为处于 TIME\_WAIT 的连接会存活 2MSL（60s），意味着相同的TCP 连接四元组（源端口、源 ip、目标端口、目标 ip）在一分钟之内都没有办法复用，通俗一点来讲就是“占着茅坑不拉屎”。

假设主动断开的一方是客户端，对于 web 服务器而言，目标地址、目标端口都是固定值（比如本机 ip + 80 端口），客户端的 IP 也是固定的，那么能变化的就只有端口了，在一台 Linux 机器上，端口最多是 65535 个（ 2 个字节）。如果客户端与服务器通信全部使用短连接，不停的创建连接，接着关闭连接，客户端机器会造成大量的 TCP 连接进入 TIME\_WAIT 状态。

可以来写一个简单的 shell 脚本来测试一下，使用 nc 命令连接 redis 发送 ping 命令以后断开连接。

    for i in {1..10000}; do
        echo ping | nc localhost 6379
    done
    

查看一下处于 TIME\_WAIT 状态的连接的个数，短短的几秒钟内，TIME\_WAIT 状态的连接已经有了 8000 多个。

    netstat -tnpa | grep -i 6379 | grep  TIME_WAIT| wc -l
    8192
    

如果在 60s 内有超过 65535 次 redis 短连接操作，就会出现端口不够用的情况，这也是使用连接池的一个重要原因。

应对 TIME\_WAIT 的各种操作
-------------------

针对 TIME\_WAIT 持续时间过长的问题，Linux 新增了几个相关的选项，net.ipv4.tcp\_tw\_reuse 和 net.ipv4.tcp\_tw\_recycle。下面我们来说明一下这两个参数的用意。 这两个参数都依赖于 TCP 头部的扩展选项：timestamp

TCP 头部时间戳选项（TCP Timestamps Option，TSopt）
----------------------------------------

除了我们之前介绍的 MSS、Window Scale 还有以一个非常重要的选项：时间戳（TCP Timestamps Option，TSopt） ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4c5c635f86~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=2026&h=616&s=185566&e=jpg&b=f6f6f6) 它由四部分构成：类别（kind）、长度（Length）、发送方时间戳（TS value）、回显时间戳（TS Echo Reply）。时间戳选项类别（kind）的值等于 8，用来与其它类型的选项区分。长度（length）等于 10。两个时间戳相关的选项都是 4 字节。

如下图所示： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4be8611658~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1870&h=406&s=95261&e=jpg&b=fffaf9)

是否使用时间戳选项是在三次握手里面的 SYN 报文里面确定的。下面的包是`curl github.com`抓包得到的结果。

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4be8843d80~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=2682&h=1298&s=1049836&e=jpg&b=fcf3ec)

*   发送方发送数据时，将一个发送时间戳 1734581141 放在发送方时间戳`TSval`中
*   接收方收到数据包以后，将收到的时间戳 1734581141 原封不动的返回给发送方，放在`TSecr`字段中，同时把自己的时间戳 3303928779 放在`TSval`中
*   后面的包以此类推

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4c5c7ae349~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1426&h=1254&s=189046&e=jpg&b=ffffff) 有几个需要说明的点

*   时间戳是一个单调递增的值，与我们所知的 epoch 时间戳不是一回事。这个选项不要求两台主机进行时钟同步
    
*   timestamps 是一个双向的选项，如果只要有一方不开启，双方都将停用 timestamps。比如下面是`curl www.baidu.com`得到的包 ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4c6e0a8f69~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=2306&h=286&s=239703&e=jpg&b=f8f5d7) 可以看到客户端发起 SYN 包时带上了自己的TSval，服务器回复的SYN+ACK 包没有TSval和TSecr，从此之后的包都没有带上时间戳选项了。
    

有了这个选项，我们来看一下 tcp\_tw\_reuse 选项

tcp\_tw\_reuse 选项
-----------------

缓解紧张的端口资源，一个可行的方法是重用“浪费”的处于 TIME\_WAIT 状态的连接，当开启 net.ipv4.tcp\_tw\_reuse 选项时，处于 TIME\_WAIT 状态的连接可以被重用。下面把主动关闭方记为 A， 被动关闭方记为 B，它的原理是：

*   如果主动关闭方 A 收到的包时间戳比当前存储的时间戳小，说明是一个迷路的旧连接的包，直接丢弃掉
*   如果因为 ACK 包丢失导致被动关闭方还处于`LAST-ACK`状态，并且会持续重传 FIN+ACK。这时 A 发送SYN 包想三次握手建立连接，此时 A 处于`SYN-SENT`阶段。当收到 B 的 FIN 包时会回以一个 RST 包给 B，B 这端的连接会进入 CLOSED 状态，A 因为没有收到 SYN 包的 ACK，会重传 SYN，后面就一切顺利了。

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4c6fa323bd~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1566&h=1296&s=200931&e=jpg&b=ffffff)

tcp\_tw\_recyle 选项
------------------

tcp\_tw\_recyle 是一个比 tcp\_tw\_reuse 更激进的方案， 系统会缓存每台主机（即 IP）连接过来的最新的时间戳。对于新来的连接，如果发现 SYN 包中带的时间戳与之前记录的来自同一主机的同一连接的分组所携带的时间戳相比更旧，则直接丢弃。如果更新则接受复用 TIME-WAIT 连接。

这种机制在客户端与服务端一对一的情况下没有问题，如果经过了 NAT 或者负载均衡，问题就很严重了。

什么是 NAT呢？ ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/6/14/16b54c4c703303df~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1478&h=1016&s=217001&e=jpg&b=fcfcfc)

NAT（Network Address Translator）的出现是为了缓解 IP 地址耗尽的临时方案，IPv4 的地址是 32 位，全部利用最 多只能提 42.9 亿个地址，去掉保留地址、组播地址等剩下的只有 30 多亿，互联网主机数量呈指数级的增长，如果给每个设备都分配一个唯一的 IP 地址，那根本不够。于是 1994 年推出的 NAT 规范，NAT 设备负责维护局域网私有 IP 地址和端口到外网 IP 和端口的映射规则。

它有两个明显的优点

*   出口 IP 共享：通过一个公网地址可以让许多机器连上网络，解决 IP 地址不够用的问题
*   安全隐私防护：实际的机器可以隐藏自己真实的 IP 地址 当然也有明显的弊端：NAT 会对包进行修改，有些协议无法通过 NAT。

当 tcp\_tw\_recycle 遇上 NAT 时，因为客户端出口 IP 都一样，会导致服务端看起来都在跟同一个 host 打交道。不同客户端携带的 timestamp 只跟自己相关，如果一个时间戳较大的客户端 A 通过 NAT 与服务器建连，时间戳较小的客户端 B 通过 NAT 发送的包服务器认为是过期重复的数据，直接丢弃，导致 B 无法正常建连和发数据。

小结
--

TIME\_WAIT 状态是最容易造成混淆的一个概念，这个状态存在的意义是

*   可靠的实现 TCP 全双工的连接终止（处理最后 ACK 丢失的情况）
*   避免当前关闭连接与后续连接混淆（让旧连接的包在网络中消逝）

习题
--

1、TCP 状态变迁中，存在 TIME\_WAIT 状态，请问以下正确的描述是？

*   A、TIME\_WAIT 状态可以帮助 TCP 的全双工连接可靠释放
*   B、TIME\_WAIT 状态是 TCP 是三次握手过程中的状态
*   C、TIME\_WAIT 状态是为了保证重新生成的 socket 不受之前延迟报文的影响
*   D、TIME\_WAIT 状态是为了让旧数据包消失在网络中

思考题
---

假设 MSL 是 60s，请问系统能够初始化一个新连接然后主动关闭的最大速率是多少？（忽略1~1024区间的端口）

欢迎你在留言区留言，和我一起讨论。