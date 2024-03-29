重传示例
----

下面用 packetdrill 来演示丢包重传，模拟的场景如下图 ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8781a5d1b94~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=958&h=750&s=80393&e=jpg&b=ffffff)

packetdrill 脚本如下：

      1 0   socket(..., SOCK_STREAM, IPPROTO_TCP) = 3
      2 +0  setsockopt(3, SOL_SOCKET, SO_REUSEADDR, [1], 4) = 0
      3 +0  bind(3, ..., ...) = 0
      4 +0  listen(3, 1) = 0
      5
      6 // 三次握手
      7 +0  < S 0:0(0) win 4000 <mss 1000>
      8 +0  > S. 0:0(0) ack 1 <...>
      9 +.1 < . 1:1(0) ack 1 win 4000
     10 +0  accept(3, ..., ...) = 4
     11
     12 // 往 fd 为 4 的 socket 文件句柄写入 1000 个字节数据（也即向客户端发送数据）
     13 +0  write(4, ..., 1000) = 1000
     14
     15 // 注释掉 向协议栈注入 ACK 包的代码，模拟客户端不回 ACK 包的情况
     16 // +.1 < . 1:1(0) ack 1001 win 1000
     17
     18 +0 `sleep 1000000`
    

*   1 ~ 4 行：新建 socket + bind + listen
*   7 ~ 9 行：三次握手 + accept 新的连接
*   13 行：服务端往新的 socket 连接上写入 1000 个字节的文件
*   16 行：正常情况下，客户端应该回复 ACK 包表示此前的 1000 个字节包已经收到，这里注释掉模拟 ACK 包丢失的情况。

使用 tcpdump 抓包保存为 pcap 格式，后面 wireshark 可以直接查看

    sudo tcpdump -i any port 8080 -nn -A -w retrans.pcap
    

使用 wireshark 打开这个 pcap 文件，因为我们想看重传的时间间隔，可以在 wireshark 中设置时间的显示格式为显示包与包直接的实际间隔，更方便的查看重传间隔，步骤如下图

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f878200ad2d8~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1934&h=1278&s=765496&e=jpg&b=dfd9d5) 可以看到重传时间间隔是指数级退避，直到达到 120s 为止，总时间将近 15 分钟，重传次数是 15次 ，重传次数默认值由 /proc/sys/net/ipv4/tcp\_retries2 决定（等于 15），会根据 RTO 的不同来动态变化。 ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8781c8bd6d8~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=2306&h=822&s=707036&e=jpg&b=13272e)

整个过程如下： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8781adaf048~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1656&h=1096&s=230267&e=jpg&b=ffffff)

永远记住 ACK 是表示这之前的包都已经全部收到
------------------------

如果发送 5000 个字节的数据包，因为 MSS 的限制每次传输 1000 个字节，分 5 段传输，如下图： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8781978ccc9~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=557&h=90&s=14401&e=jpg&b=ffffff) 数据包 1 发送的数据正常到达接收端，接收端回复 ACK 1001，表示 seq 为1001之前的数据包都已经收到，下次从1001开始发。 数据包 2（10001：2001）因为某些原因未能到达服务端，其他包正常到达，这时接收端也不能 ack 3 4 5 数据包，因为数据包 2 还没收到，接收端只能回复 ack 1001。

第 2 个数据包重传成功以后服务器会回复5001，表示seq 为 5001 之前的数据包都已经收到了。 ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8782193ca90~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=532&h=843&s=73549&e=jpg&b=ffffff)

快速重传机制与 SACK
------------

文章一开始我们介绍了重传的时间间隔，要等几百毫秒才会进行第一次重传。聪明的网络协议设计者们想到了一种方法：**「快速重传」** 快速重传的含义是：当发送端收到 3 个或以上重复 ACK，就意识到之前发的包可能丢了，于是马上进行重传，不用傻傻的等到超时再重传。

这个有一个问题，发送 3、4、5 包收到的全部是 ACK=1001，快速重传解决了一个问题: 需要重传。因为除了 2 号包，3、4、5 包也有可能丢失，那到底是只重传数据包 2 还是重传 2、3、4、5 所有包呢？

聪明的网络协议设计者，想到了一个好办法

*   收到 3 号包的时候在 ACK 包中告诉发送端：喂，小老弟，我目前收到的最大连续的包序号是 **1000**（ACK=1001），\[1:1001\]、\[2001:3001\] 区间的包我也收到了
*   收到 4 号包的时候在 ACK 包中告诉发送端：喂，小老弟，我目前收到的最大连续的包序号是 **1000**（ACK=1001），\[1:1001\]、\[2001:4001\] 区间的包我也收到了
*   收到 5 号包的时候在 ACK 包中告诉发送端：喂，小老弟，我目前收到的最大连续的包序号是 **1000**（ACK=1001），\[1:1001\]、\[2001:5001\] 区间的包我也收到了

这样发送端就清楚知道只用重传 2 号数据包就可以了，数据包 3、4、5已经确认无误被对端收到。这种方式被称为 SACK（Selective Acknowledgment）。

如下图所示： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f8785971515d~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1428&h=1272&s=228215&e=jpg&b=ffffff)

使用 packetdrill 演示快速重传
---------------------

      1 --tolerance_usecs=100000
      // 常规操作：初始化
      2 0  socket(..., SOCK_STREAM, IPPROTO_TCP) = 3
      3 +0 setsockopt(3, SOL_SOCKET, SO_REUSEADDR, [1], 4) = 0
      4 +0 bind(3, ..., ...) = 0
      5 +0 listen(3, 1) = 0
      6
      7 +0  < S 0:0(0) win 32792 <mss 1000,sackOK,nop,nop,nop,wscale 7>
      8 +0  > S. 0:0(0) ack 1 <...>
      9 +.1 < . 1:1(0) ack 1 win 257
     10
     11 +0 accept(3, ... , ...) = 4
     12 // 往客户端写 5000 字节数据
     13 +0.1 write(4, ..., 5000) = 5000
     14
     15 +.1 < . 1:1(0) ack 1001 win 257 <sack 1:1001,nop,nop>
     // 三次重复 ack
     16 +0  < . 1:1(0) ack 1001 win 257 <sack 1:1001 2001:3001,nop,nop>
     17 +0  < . 1:1(0) ack 1001 win 257 <sack 1:1001 2001:4001,nop,nop>
     18 +0  < . 1:1(0) ack 1001 win 257 <sack 1:1001 2001:5001,nop,nop>
     19 // 回复确认包，让服务端不再重试
     20 +.1 < . 1:1(0) ack 5001 win 257
     21
     22 +0 `sleep 1000000`
    

用 tcpdump 抓包以供 wireshark 分析`sudo tcpdump -i any port 8080 -nn -A -w fast_retran.pcap`，使用 packetdrill 执行上面的脚本。 可以看到，完全符合我们的预期，3 次重复 ACK 以后，过了15微妙，立刻进行了重传

![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f878595513f8~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=2184&h=630&s=556134&e=jpg&b=e6e3fc)

打开单个包的详情，在 ACK 包的 option 选项里，包含了 SACK 的信息，如下图： ![](https://p1-jj.byteimg.com/tos-cn-i-t2oaga2asx/gold-user-assets/2019/2/27/1692f878596b44a2~tplv-t2oaga2asx-jj-mark:1600:0:0:0:q75.image#?w=1412&h=958&s=347072&e=jpg&b=fefefe)