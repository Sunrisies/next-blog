2021 年 10 月 4 日，Facebook 及其旗下`Instagram 和 WhatsApp`等应用全网宕机，停机时间长达`7 个小时`。在浏览器尝试打开时，用户会看到`DNS（Domain Name System）错误提示`。此次服务中断不仅让数十亿用户陷入困境，还使得 `Facebook 内部在线服务无法修改配置`去修复数据中心，导致`延误`长达 7 个多小时。

可以说，这次宕机给 Facebook 带来了巨大的损失。那么，什么是`DNS 服务`呢？为什么`DNS 异常`会造成这么可怕的后果？让我们一起来深入了解。

尝试解析 DNS 协议
===========

`DNS（Domain Name System）`是一种用于解析`域名`和 `IP 地址`之间映射关系的系统。在互联网上，每个设备都有自己的的 IP 地址，但是人们更容易记住和使用的是域名，如`baidu.com`。

DNS 简介
------

`DNS 服务器`负责将`域名`映射到相应的 `IP 地址`，使得人们可以使用`易于记忆的域名`来访问网站和其他网络资源。当你在浏览器中输入`域名`时，浏览器会向 `DNS 服务器`发送一个查询请求，以获取该`域名`对应的 `IP 地址`。`DNS 服务器`会返回一个响应，其中`包含该域名对应的 IP 地址`。

DNS 由`多个层次的域名系统`组成，其中最顶层的域名是`根域名（.）`，例如`baidu.com`完整域名是`baidu.com.`， 其中`com 是顶级域名`，`baidu`是`com`的子域名。每个域名可以有多个子域名，其中子域名是父域名的一个分支。DNS 通过使用`层级结构`来管理域名和 IP 地址之间的映射关系。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/19f3d4e5c4104f53a6eaf91d855af49f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1430&h=809&s=94141&e=png&b=eaedf0)

像其他的网络协议都有标准 RFC 一样，`DNS`也有自己的 [RFC](https://www.rfc-editor.org/rfc/rfc1035 "https://www.rfc-editor.org/rfc/rfc1035")。`DNS RFC 文档`包含了有关 DNS 协议的详细规范和实现细节。具体内容包括`协议结构、数据格式、DNS 服务器和 DNS 解析`等。虽然 RFC 标准详尽地规定了 DNS 标准，但是理解起来却很抽象，如果你有较强的钻研能力，当然还是建议你读一读。现在先别管这些，我们一起来捕获一些 DNS 包，实际看看 DNS 协议数据包是什么样子吧～

捕获 DNS 包
--------

一般来说 DNS 服务器运行在`UDP 53 端口`上，所以我们可以使用以下命令`捕获并过滤所有的 DNS 包`：

`sudo tcpdump -A -i any udp port 53 -w dns.pcap`

我们在前面已经讲过了`ping`的工作原理，曾经说到如果`ping 一个域名`，首先要得到它的一个`IP 地址`，那么这个地址就是`DNS 查询`的结果。

在`ping`的过程中，比如我在本机执行`ping baidu.com`却没有`DNS 流量包`产生，这是为什么呢？

这主要是因为系统中有对应域名的`DNS 缓存`。如果系统中没有对应域名的缓存就能轻易捕获到 DNS 询问流量了。在`Mac OS`下我们可以使用以下命令清理缓存：

`sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`

之后再重新`ping baidu.com`这个域名：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/54c7df14e4484492ba34ee928fa5840c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1228&h=216&s=82880&e=png&b=0e2b35)

同时去抓包，会捕获到`DNS 查询`的一组标准查询和对应的响应，如下图所示。 这组查询和响应具有`相同的 Transaction ID: 0xedab`，响应的 `Reply code 为 No error (0)`。

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/43288c5f290146cda5d8507fe1e89fdb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2474&h=948&s=575720&e=png&b=242424)

回答的资源记录数目是 2，具体信息如下图`Answers 列表`所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7aacae3b92fa4167a5c513ad95bc481e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=908&h=110&s=27091&e=png&b=202020)

从抓包结果来看，无论是请求还是响应，都是一样的格式，让我们来看一下 DNS 协议包的规范。

解析 DNS 格式
---------

`DNS 报文`通过 UDP 封装，格式如下表所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2eb8b5df0b61481a87f098d2ded677af~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1198&h=574&s=101780&e=png&b=ffffff)

如我们所见，DNS 格式以两个字节的`事务 ID`开头，接下来是两个字节的`标志位`，然后是包含问题、回答、服务器等`统计信息的区域`，统计信息之后是`详细的资源记录`。尽管 DNS 请求和响应格式基本相同，但响应会包含额外的回答区域和其他区域。响应的回答区域通常包含多个 RR 记录，RR 代表`资源记录`，包含了`一个域名对应的各种资源信息`，例如 IP 地址、邮件服务器、别名等。

`A（Address）记录`就是主机名映射到的`IP 地址`。可以看到这里`baidu.com`有两个`A 记录`。一个`DNS 名字`可以有`多个 IP 地址`，这可作为负载均衡的用途。

`DNS 负载均衡`常用于高流量的网站、应用程序或在线服务等场景，可以帮助提高服务的可用性和性能，同时也可以避免单一服务器的故障对整个系统的影响。DNS 负载均衡可以通过多种方式实现，例如`轮询、随机、加权轮询`等。当客户端请求访问一个 DNS 负载均衡的域名时，DNS 服务器会`通过配置的负载均衡算法`返回多个 A 记录（顺序由负载均衡算法决定），客户端浏览器一般选择 DNS 服务器返回的`第一个 A 记录`。

解锁网络神器 DNS 工具
-------------

`DNS 请求和响应`的数据结构颇为复杂，使用抓包的方式确实也很麻烦。那有没有更为方便的方式呢？这里推荐两个小工具。

对于想要知道域名对应的 IP 这个单纯的目的来说，非常推荐使用`nslookup` 命令，如下图所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a3bae2955c8f4163abc7eb496970acfb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=802&h=460&s=128924&e=png&b=161822)

`nslookup` 命令可以将查询结果清晰地打印在控制台上，比起我们自行解析抓包要简单得多。

还有一个更强大的命令 `dig`，使用 `dig` 命令进行 DNS 查询不仅可以将`DNS 协议包里面的 Answers 部分`清晰地打印在控制台上，还能够提供统计信息、权威 DNS 服务器信息以及其他额外的有用信息。此外，`dig +trace baidu.com`能看到`baidu.com`的 DNS 解析轨迹。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57fe9c9d02a747999bdb3662e10df03d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1298&h=1328&s=666475&e=png&b=161822)

当然，dig 还有些别的参数和用法，你也可以探索一下，我们后面还会用到。

DNS 是一个非常有趣和实用的网络协议，本文下半部分开始从更广阔的视角继续探索 DNS，而且利用简单的工具和方法去`发现 DNS 各个层级的服务器`，甚至自己去`搭建自己的 DNS 服务器`。

深入探索 DNS-拨开云雾
=============

我们已经知道 DNS（域名系统）是一种分布式系统，它将域名映射到 IP 地址。在客户端看来，DNS 解析就是一个请求响应而已，但其实没那么简单：`对你而言简单的事情，是因为别人在负重前行`。

比如说“分布式”体现在哪里？首先是我们提到的各个层级的域名服务器，又有父子关系，那 DNS 解析必然要涉及这些。DNS 解析过程包括多个步骤，例如：当用户在浏览器中输入 URL（google.com）时，浏览器会首先查找`hosts 文件`和`DNS 缓存`，如果未找到，则会向`本地 DNS 服务器`（resolver）发出请求（`query google.com 的 A 记录`）。如果本地 DNS 服务器没有缓存或映射，它会向`根 DNS 服务器`（比如`a.root-servers.net`）发送请求（`query com 名字服务器的 A 记录`）。根 DNS 服务器返回`顶级域名服务器`的地址（比如`a.gtld-servers.net`），然后本地 DNS 服务器再去请求这个`顶级域名服务器`（`query google 名字服务器的 A 记录`），顶级域名服务器返回`google.com 权威 DNS 服务器`的地址（比如`ns1.google.com`），再通过`权威 DNS 服务器`查到`google.com 的 A 记录`。最后，本地 DNS 服务器`将 google.com 的 IP 地址返回给浏览器`，浏览器可以使用它来连接到所请求的网站。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0341961e9aa74af5a106d0287b399166~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2864&h=1307&s=309530&e=png&b=f7f8f9)

如上图所示，可以看出是本地 DNS 服务器在“负重前行”，`替我们做域名解析`的工作。图上有 8 个步骤，客户端发出请求后，只要等待接收响应即可。其他所有的`分布式查询步骤 2～7`都是本地 DNS 服务器干的，本地 DNS 服务器的这些查询称为`递归查询`。

> 需要注意的是：单独的顶级域名比如 com 不是一个合法的域名，一个合法的域名至少在权威域名服务器中有注册。顶级域名本身不能构成一个地址，因为它只是域名层次结构中的最高级别，是在域名系统中用于分类和管理二级域名的标识符。

现在让我们详细探索一下拓扑图中的各个角色，先从客户端开始。

客户端
---

客户端是终端用户的`浏览器`、`命令行`以及`任何应用程序`。它会顺序依次查找`本地 hosts 文件`和`DNS 缓存`来试图解析某个域名。

`本地 hosts 文件`是一个文本文件，包含了 IP 地址和域名之间的映射关系，可以用来指定特定的 IP 地址对应的域名。你可以在计算机上的 hosts 文件中找到它，比如下面是我的一台服务器的`hosts 文件内容`：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab18b6f639344cb68087501a2a9f181a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=768&h=394&s=129404&e=png&b=161822)

`IPv6 地址`当然也可以在 hosts 文件里配置。如果在 host 文件加入一行`127.0.0.1 baidu.com`，就会发现再次访问`baidu.com`就访问不通了。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dd63ee9667494116adb2711b8bb4e24a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=966&h=110&s=50995&e=png&b=161822)

如果 hosts 和本地 DNS 缓存仍未找到，客户端将请求发送给`本地 DNS 服务器`（DNS resolver，也称为名字解析服务器），请求`由它来完成域名解析`，我们接着来看一下`本地 DNS 服务器`吧。

本地 DNS 服务器
----------

终端用户的系统想要上网则需要配置一个 DNS 服务器，当你的手机连接到一个 Wi-Fi 网络时，也会`自动配置`一个 DNS 服务器地址。

如下图是我家里电脑和手机的 DNS 配置：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/454f3491b8bd4d52ae70f7c69b119f93~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2408&h=950&s=252987&e=png&b=f3f4f6)

该 DNS 服务器的地址可以是 `IPv4 或 IPv6`。其中，`IPv6 地址 fe80::1` 是一个链路本地地址，只能用于同一链路上的通信。如果需要在不同的链路之间进行通信，则需要使用`全局唯一的 IPv6 地址`。

这两个设备对应的本地 DNS 服务器是`本地运营商`或者 Wi-Fi 提供商设置的。

下面这个是云服务器上一台设备的配置，在文件 `/etc/resolv.conf`里面：

    # cat /etc/resolv.conf 
    # Generated by NetworkManager
    nameserver 183.60.83.19
    nameserver 183.60.82.98
    

另外，还有很多`公共的 DNS 服务器`，比如`8.8.8.8` ，可用于向互联网上的计算机`提供 DNS 解析服务`，当然我们也可以手动配置自己的 DNS 服务器为任意公共的 DNS 服务器，但不要胡乱设置，免得影响接入互联网。

域名服务器
-----

有三个级别的域名服务器提供域名解析服务：

*   根域名服务器 "."；
*   顶级域名服务器，比如 com；
*   权威域名服务器：二级域名及更多级别的域名都由权威域名服务器进行解析。

现在我们依次来看下这些域名服务器。

### 利用缓存不命中发现根服务器

客户端本身发现不了根域名服务器，因为所有的迭代查询都是本地 DNS 服务器发起的。当要查询某个顶级域名服务器的地址时，本地 DNS 服务器理应向根域名服务器发出请求。但因为本地 DNS 服务器也有它的缓存，一般情况下使用缓存就够了，而`不是每次都去询问根域名服务器`。

`ICANN`（Internet Corporation for Assigned Names and Numbers，是一个非营利组织，负责管理和协调互联网的全球域名系统和 IP 地址分配）的数据显示，目前顶级域名服务器支持超过 1500 个顶级域名，例如`.com、.net、.org、.edu、.gov`等。想要本地 DNS 服务器避开缓存去查询根服务器，可以尝试`ping 一个不存在的顶级域名`，比如`ping x.y.z`，因为缓存没命中，就会使得迭代 DNS 服务器向根服务器发起请求，原理如下图所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1a397ca0833e4dc1a2a358537f3516ca~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1732&h=644&s=98455&e=png&b=f3f5f6)

抓包的请求响应如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/801dbcb6ff764bc9b4bbc9d1c9bdf3ce~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2752&h=1404&s=382657&e=png&b=242424)

响应返回`No such name`，另外在域名服务器区域可以看到根域名服务器的`Type 是 Root`，主域名服务器的地址是`a.root-servers.net`，这是一个根域名服务器。

直接运行`dig`命令，可以看到根域名服务器的所有的`IP 分布`，这里我还标注了它们所处的地理位置，如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb5a17b038184edca66d48dc8f8dd3c1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=6499&h=2220&s=4141481&e=png&a=1&b=012b36)

### 故技重施发现顶级和权威域名服务器

我们同样可以利用缓存不命中原理查找顶级域名服务器。让我们执行命令 `ping unknown11.com`，响应的包里能看到返回了`d.gtld-servers.net`，`gtld`是顶级域名（Generic Top-Level Domain）的缩写，表明这是一个顶级域名服务器。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8a132cf841a34c6893c2b6f0f593f004~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1180&h=520&s=108089&e=png&b=1f1f1f)

依旧故技重施，执行命令 `ping j1634438.qq.com`，我们可以看到如下返回：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7fb0535f140c447084545ba3143d32c9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1300&h=528&s=105753&e=png&b=1f1f1f)

看到了权威域名服务器`qq.com`，所有的二级域名都是一个`权威域名`，这也是符合预期的。

使用自己的递归 DNS 服务器
---------------

虽然能够发现各个层级的域名服务器，但是客户端的`视野`终究是受限的。现在`本地 DNS 服务器`的原理也基本理解了，我们可以尝试来搭建自己的 DNS 服务器。[bind](https://www.isc.org/bind/ "https://www.isc.org/bind/") 是一个开源的 DNS 服务器，可以作为`权威 DNS 服务器`和`递归 DNS 服务器`使用。

`bind`的配置较为复杂，下面的操作步骤展示我在`Mac OS` 下使用 bind 搭建自己的`本地 DNS 服务器`的过程。

    $ brew install bind
    $ cd /opt/homebrew/etc/bind
    # cat named.conf 
     options {
            directory "/opt/homebrew/var/named";
             recursion yes;
            allow-recursion { any; };
    
        };
     $ brew services start bind  
    

注意将配置中的`recursion` 修改为`yes;`，以此将 bind 配置为`递归 DNS 服务器`。当启动 bind 之后，我们可以看到本地的`TCP 和 UDP 53 端口`都起来了，可以通过`dig @localhost`验证本地 DNS 服务的可用性。最后修改自己电脑的 DNS 服务器，就可以直接使用刚刚配置好的 DNS 服务器了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/323f2e7ec94e43b0b70fba701ce2a856~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1276&h=286&s=39001&e=png&b=272827)

让我们实际验证一下，执行命令`ping v.qq.com`，此时我们可以抓包看到很多的递归过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e1ab2c9f3bdb4a4287aa11d74aa5c729~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3056&h=1498&s=961026&e=png&b=d9edfe)

从上图可以看到，为了得到`v.qq.com`的 `IP 地址`，本地的 DNS 服务器与`相关的 DNS 服务器`发起了`迭代查询`。

喜欢鼓捣的话，你也可以试下使用自己的 DNS 服务器～

总结
==

本文我们通过实际的例子探讨了 DNS 协议包的交互问答过程，并亲自动手验证了各个层级的域名服务器，且使用了自己配置的递归 DNS 服务器。我们将在后续章节中探讨权威 DNS 服务器和安全等问题。

希望你在阅读本文的过程中，也多多动手实践~

还记得本文在开头讲的`Facebook DNS 故障`的问题吗？我觉得故障的原因是`facebook.com`所在的权威域名服务器访问出现故障了，你认同吗？或者是否有别的看法呢？欢迎留言。