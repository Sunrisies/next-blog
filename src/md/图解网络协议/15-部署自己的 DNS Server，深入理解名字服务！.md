在之前的内容中，我们了解了`DNS`的基本原理和各个系统的角色。但是，你有没有想过拥有自己的域名呢？就像`Google、百度和 QQ 等互联网巨头`一样，它们都拥有自己的`独特域名`。无论是公司还是个人，都希望在互联网上拥有自己的品牌和声誉，这就需要注册一个属于自己的域名。

为了让大家更好地理解，我就来演示一下如何注册自己的域名。学习的过程中，实践非常重要，只有`亲身体验`才能深刻感受到其中的乐趣和意义。

拥有一个权威域名
========

首先，我们需要找一个`域名提供商`。域名提供商是一家允许个人或企业注册域名，并将其映射到互联网上的 IP 地址的公司或组织。它们通常提供域名搜索、注册、续订、DNS 管理和其他相关服务。此外，域名提供商还可能提供托管、电子邮件、网站建设和其他互联网服务。

常见的域名提供商有`GoDaddy`、`Namecheap`、`Google Domains`、`万网`等。

域名提供商需要向`域名注册局`缴纳费用，这些费用包括注册费、续费费用以及其他相关服务的费用。域名注册局是负责`管理和维护顶级域名（例如.com、.org、.net等）`的非营利组织或政府机构。

如果我们想购买一个域名，我们可以通过域名提供商`购买二级域名`，例如`yuangui.info`。一般来说，域名提供商会按年计算费用。我们可以对比各个域名提供商的价格和服务，选择最适合自己的购买方式。例如，我在`GoDaddy`上购买了一个有效期为一年的域名`yuangui.info`，到期后需要续费。

`GoDaddy`提供了很好的托管服务，可以在它们平台上去`添加自己的 DNS 记录`（包含`yuangui.com`和其`所有子域名`的名字 IP 映射）。但为了更加`灵活`、`方便扩展性更强`，现在让我们来`搭建自己的权威域名服务器`吧，因为拥有自己的域名服务器意味着可以更好地控制域名的解析和路由，从而更好地管理域名的网络流量和响应时间。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f613dcbdb1ec4d7980f3ba2088a6aa4c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2782&h=1265&s=278533&e=png&b=ffffff)

从哪里开始呢？就从在`GoDaddy`的页面上给自己的域名添加`一主一备两台名字服务器`开始，如上图所示。

搭建自己的权威域名服务器
============

我们之前提到了使用`Bind`搭建`递归域名服务器`，现在同样可以使用`Bind`搭建`权威域名服务器`。`Bind`功能强大，支持复杂的 DNS 配置，同时支持`DNSSEC`等安全扩展。

在`CentOS 7`上搭建`Bind 9`环境非常简单，只需运行命令`yum install bind -y`进行安装，然后修改配置文件即可。接下来我们将展示修改后的配置文件的完整内容，配置文件在`/etc/named.conf` 。

     # cat /etc/named.conf 
     options {
                listen-on port 53 { any; }; 
                listen-on-v6 port 53 { ::1; };
                directory       "/var/named";
                dump-file       "/var/named/data/cache_dump.db";
                statistics-file "/var/named/data/named_stats.txt";
                memstatistics-file "/var/named/data/named_mem_stats.txt";
                recursing-file  "/var/named/data/named.recursing";
                secroots-file   "/var/named/data/named.secroots";
                allow-query     { any; };
                recursion yes;
    
                dnssec-enable yes;
                dnssec-validation yes;
    
                /* Path to ISC DLV key */
                bindkeys-file "/etc/named.root.key";
    
                managed-keys-directory "/var/named/dynamic";
    
                pid-file "/run/named/named.pid";
                session-keyfile "/run/named/session.key";
        };
    
        logging {
                channel default_debug {
                        file "data/named.run";
                        severity dynamic;
                };
        };
    
        zone "." IN {
                type hint;
                file "named.ca";
        };
        zone "yuangui.info" IN {
            type master;
            file "/var/named/named.yuangui.info";
        };
    
        include "/etc/named.rfc1912.zones";
        include "/etc/named.root.key";
    

首先，配置文件里面有几个注意`是否要修改`的地方。

*   `listen-on port 53 { any; };`：用于指定服务器的监听地址和端口，以便与其他服务器或客户端进行通信。需要将这里改为能和外网通信的网卡 IP 或者`any`，因为默认值`localhost`会导致外网无法访问。
    
*   `allow-query { any; };`：用于指定`允许查询服务器`的 IP 地址或网段。通常用于限制服务器的查询范围，以保护服务器不受到未经授权的查询的攻击，设置为`any`则所有机器都可访问。
    
*   `recursion yes;`：用于设置是否递归查询，一般客户机和服务器之间属于递归查询，即当客户机向 DNS 服务器发出查询请求后，若 DNS 服务器本身不能解析，则会向另外的 DNS 服务器发出查询请求，得到结果后转交给客户机。此选项有`yes`和`no`两个值，作为`递归服务器的 recursion 配置需要设置为 yes`；如果只是作为`权威域名服务器`，这个配置需要改为`no`。
    

配置区域 zone
---------

如果你也跟着安装了一个`Bind 服务`，是否留意到上面我的配置文件里面新增了一个`zone 块`（区域信息块），是如下所示的小段落：

     zone "yuangui.info" IN {
            type master;
            file "/var/named/named.yuangui.info";
        };
    

DNS 配置文件中的`Zone 区域信息`指的是`特定域名下的 DNS 记录集合`，例如`yuangui.info`下包括该域名下所有主机名的 DNS 记录，如`A 记录`、`NS（名字服务器）记录`等。

这个配置文件表示在 DNS 服务器上创建一个名为`"yuangui.info"`的区域（zone），并且该区域的类型为`“master”`（即该 DNS 服务器是区域的主服务器，我们还需要去配置一个备份的服务器）。该区域的`资源记录`存储在指定的文件 `"/var/named/named.yuangui.info"` 中。

具体来说，当 DNS 服务器接收到查询请求时，它将`搜索该区域的资源记录文件`以查找与查询匹配的资源记录，并返回相应的响应。在该区域中添加、删除或修改资源记录时，需要`手动编辑`该文件，并重新加载 DNS 服务器以使更改生效。

一起来看下区域`yuangui.info`的资源记录配置文件。

       # cat named.yuangui.info 
        $TTL 1D
        @       IN SOA    ns1.yuangui.info. admin.yuangui.info. (
                                                20230605        ; serial
                                                200S     ; refresh
                                                60S     ; retry
                                                6000S     ; expire
                                                600S )  ; minimum
                IN NS   ns1.yuangui.info.
                IN NS   ns2.yuangui.info.
                IN A    43.156.20.160
        ns1     IN A 114.132.76.142
        ns2     IN A 43.156.20.160
        www     IN A 43.156.20.160
        h1      IN A 43.156.20.160
       ...
    

下面是每个指令的含义：

*   `$TTL 1D`：设置 TTL（生存时间）为 1 天，表示解析结果会被缓存 1 天。
    
*   `@ IN SOA ns1.yuangui.info. admin.yuangui.info. (...)`：定义域名的 `SOA 记录`（`Start of Authority`，它指定了该域名的主域名服务器、域名管理员的电子邮件地址以及其他一些元数据信息。SOA 记录在 DNS 中具有特殊的作用，它是`区域文件中的第一个记录`），其中包括：`ns1.yuangui.info` 是主域名服务器的主机名，`admin.yuangui.info` 是管理员邮箱，`20230605` 是版本号（每次修改文件后可以手动将这个文件的版本号递增，用于主从同步），以及后面的 refresh/retry/expire/minimum。这些都是`时间信息`，那有什么作用呢？我们后面会结合`备份`服务器和递归服务器来进行详细讲解。
    
*   `IN NS ns1.yuangui.info.` 和 `IN NS ns2.yuangui.info.`：定义域名的 NS 记录，即 yuangui.info 域名的 DNS 服务器是 `ns1.yuangui.info` 和 `ns2.yuangui.info`。
    
*   `IN A 43.156.20.160`：定义 yuangui.info 的 A 记录，即将 yuangui.info 解析为 IP 地址 43.156.20.160。
    
*   `ns1 IN A 114.132.76.142` 和 `ns2 IN A 43.156.20.160`：定义主机名 ns1 和 ns2 的 A 记录，即将 ns1.yuangui.info 解析为 IP 地址 114.132.76.142，将 ns2.yuangui.info 解析为 IP 地址 43.156.20.160。
    
*   `www IN A 43.156.20.160` 和 `h1 IN A 43.156.20.160`：定义主机名 www 和 h1 的 A 记录，即将 [www.yuangui.info](http://www.yuangui.info "http://www.yuangui.info") 和 h1.yuangui.info 解析为 IP 地址 43.156.20.160。
    
*   当然也可以添加一个 MX 记录，用于指定邮件服务器，后面有机会的话，我们也可以聊一下这块。
    

在这些配置文件都配置好了之后，就可以启动我们的权威域名服务器了！

启动并验证自己的域名服务器
-------------

运行命令 `systemctl start named`就可以启动名字服务。

迫不及待地想要验证一下了吗？直接在浏览器输入 [yuangui.info/](https://yuangui.info/ "https://yuangui.info/") 就好。

> 我在这台机器上面部署了一个 nginx，也申请了一个 https 证书，你实践的时候可以在域名 IP 对应的主机上部署任何你想要部署的服务。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/86efa1257e874aac97de0b078c1e674c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1422&h=770&s=227638&e=png&b=ffffff)

继续验证配置的其他的`子域名`，如下图所示的结果：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8edd9f4a51824e4aac896546db430d01~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=760&h=374&s=75982&e=png&b=0e2b35)

配置好的这些域名都可以解析到地址，这就意味着我已经成功地拥有了`yuangui.info`这个域名啦！太棒了！

> 如果你没有自己的域名，也不影响你搭建自己的环境并且配置区域信息，可以这样来验证 `dig +short @114.132.76.142 h3.yuangui.info`，其中 @ 的 IP 地址是你搭建的权威域名服务器的地址。

分析整体运行
------

我们已经成功配置并验证了一台权威域名服务器，确保其正常运行。当前的网络拓扑如下所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cbe6f52a6e2348b797013cc85fc47336~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1889&h=849&s=115949&e=png&b=ebeef1)

为了捕获完整的递归数据，请在递归服务器 `43.156.19.65`（这是我的递归服务器部署的地址，你可以自行部署，便于抓包）上使用以下命令清空缓存：`rndc flush`。然后，执行 `dig @43.156.19.65 yuangui.info` 命令。在递归服务器上抓取数据包，请使用此命令：`sudo tcpdump -A -i any udp port 53 -w dns.pcap`。

通过数据包分析，我们可以更深入地了解其整体运行机制，如下图所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4bca0cf7d8f84e47944090b8551f39f9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1809&h=1446&s=236024&e=png&b=f7f8f9)

因为递归 DNS 服务器没有缓存，它会向`根 DNS 服务器`（比如`a.root-servers.net`）发送请求（`query info 名字服务器的 A 记录`）。根 DNS 服务器返回`info 顶级域名服务器`的地址（比如`a0.info.afilias-nst.info`），然后递归 DNS 服务器再去请求这个`顶级域名服务器`（`query yuangui.info 名字服务器的 A 记录`），顶级域名服务器返回`yuangui.info 权威 DNS 服务器`的地址（`ns1.yuangui.info`），再通过`权威 DNS 服务器`查到`yuangui.info 的 A 记录`。最后，本地递归 DNS 服务器`将 yuangui.info 的 IP 地址返回给用户`。

整个过程和我们前面分析`google.com`的查找过程是一样的，只是这一次域名换成了我`自己的域名`！

稳固我们的名字服务
=========

虽然在`GoDaddy`的页面上给自己的域名添加`一主一备两台名字服务器`，但我们发现只部署一个也是可以工作的。

那还要不要配置`ns2.yuangui.info`这个域名服务器呢？答案是肯定的。

配置`从 DNS（Slave DNS）`的主要原因是增加 `DNS 系统的可靠性和稳定性`。当一个域名有多个 DNS 服务器时，如果其中一个主 DNS 服务器失效，从 DNS 服务器可以接管服务，确保域名的解析服务可以继续提供。此外，主 DNS 和从 DNS 可以分别位于不同的网络和地理位置，提供更好的`容错和负载均衡能力`。

配置 slave
--------

现在我们来配置 `ns2.yuangui.info` 域名服务器，并将其部署在与 master 服务器完全不同的位置。

首先，需要在 slave 服务器上安装 `BIND` 服务。然后，修改 slave 服务器上的 `named.conf` 文件。其内容大致与 master 服务器相同，主要区别在于将 master 服务器的 IP 地址添加到 `zone "yuangui.info"` 块中，并将 `type` 设置为 `slave`。

    zone "yuangui.info" IN {
     type slave;
     masters { 114.132.76.142; };
     file "slaves/yuangui.info.zone";
    };
    

启动 slave 服务器后，我们可以观察到 slave 和 master 服务器之间的数据同步，是如下图中`AXFR`类型的 DNS 数据：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/956d47ecfc7f4ec29f668a5ccaff984e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3000&h=1110&s=442979&e=png&b=222222)

同步过程的具体实现是通过 `SOA`（Start of Authority）记录中的一些配置信息来完成的。下图展示了从 slave 服务器向 master 服务器同步的一些相关配置：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bad0963829694ffb8f3edaf7ec6f889a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1778&h=1194&s=193694&e=png&b=f1f3f5)

如图所示，`refresh` 时间设置为 200 秒，表示 slave 服务器会每 200S 向 master 服务器发起一次数据同步请求。`retry` 参数则用于指定当同步请求失败时，slave 服务器何时再次尝试同步。例如，若 `retry` 设置为 60 秒，当前同步请求若失败，slave 服务器将在 60 秒后重试同步操作。`expire` 参数表示一段时间，在这段时间内，如果 `slave 服务器`无法从 `master 服务器`获取更新信息，slave 服务器将继续为 DNS 查询提供服务。过了这段时间后，如果 slave 服务器仍然无法从 master 服务器获取更新，则它将不再视其 master 服务器为可用并`停止为该 zone 提供 DNS 查询服务`。我们可以根据需要自行配置这些参数。

此外，通过持续抓包，我们观察到主从服务器之间确实断断续续有数据包的通信。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c69aed4f91ad4c378b8a3ccf87d09bdd~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2740&h=1256&s=560712&e=png&b=ffffff)

这证明 slave 服务器会定期发起同步请求，就像我们了解到的那样，两者之间存在定期的数据同步。然而，关于具体的同步格式、数据同步是否是全量或增量，这里我们并不详细探讨更多的专业知识。如果你对此感兴趣，可以自行了解更多相关信息。

模拟单点故障，还能工作吗？
-------------

现在让我们重新审视一下整体网络拓扑图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/95de42d0bd21423881250f86d6d2becc~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1809&h=1632&s=266145&e=png&b=f4f6f7)

我们已经部署了一主一备共两台名称服务器。在这种情况下，`info 顶级域名`服务器会根据负载均衡策略决定将访问请求转发给哪个 `yuangui.info` 的域名服务器。有时候会转发给 `ns1.yuangui.info`，有时候会转发给 `ns2`。它们都能正常提供服务。

你可以使用以下命令进行抓包过滤： `dns.qry.name matches "yuangui.info$" and dns.qry.type==1`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/23135fbb49bf4200a7b0ce2426631ce9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2996&h=1102&s=708683&e=png&b=d9edfe)

假设你想模拟单点故障，可以让 slave 服务器停止工作，例如将 ns2 的 `allow-query` 配置更改为 `localhost`，那么它将拒绝为外部请求提供服务。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7fc20ede4c4d47a780514b5b712b92b7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2966&h=764&s=448347&e=png&b=d9edfe)

在此情况下，我们可以看到 ns2 返回了许多 `"Refused"` 响应。随后，所有请求将被`转发到 ns1`。尽管如此，整体系统仍对外部提供服务，我们`仍然可以解析该域名下的资源`。

其他
--

最后，我们需要简要说明两个小点。

首先，假设我们查询一个不存在的域名，例如在客户端终端输入命令 `dig @43.156.19.65 h6.yuangui.info`，然后在递归 DNS 服务器上抓包，我们可以看到以下请求和响应：

    08:21:51.066279 IP 113.87.116.9.12949 > VM-0-6-centos.domain: 39635+ [1au] A? h6.yuangui.info. (56)
        E..T....1..|qWt
        ...2..5.@~f... .........h6.yuangui.info.......).........
        ..%.o..2...........Q......
        08:21:51.066824 IP VM-0-6-centos.37925 > 114.132.76.142.domain: 19092 [1au] A? h6.yuangui.info. (44)
        E..H?...@.q.
        ...r.L..%.5.4..J............h6.yuangui.info.......)...........a.....P..n...
        08:21:51.112157 IP 114.132.76.142.domain > VM-0-6-centos.37925: 19092 NXDomain*- 0/1/1 (90)
        E..v&...-...r.L.
        ....5.%.b..J............h6.yuangui.info.............*0.".ns1...admin........Q......     :...*0..).........      :...*0........
        08:21:51.112498 IP VM-0-6-centos.domain > 113.87.116.9.12949: 39635 NXDomain 0/1/1 (118)
        E...z3..@..
    
        ...qWt  .52..~...............h6.yuangui.info.............*0.".ns1...admin........Q......        :...*0..).........
        ..%.o..2..}...d....%.&^..       ................
    

在此示例中，`113.87.116.9` 是客户端的公网 IP 地址，向我们的 ns1 发起查询 `h6.yuangui.info 的 A 记录`。由于该域名不存在，ns1 回应了一个 `NXDomain`（Not Existed Domain）消息，表示找不到该域名。

第二点要说明的是：对于递归服务器已经缓存过的顶级域名，请求会直接转发给我们的权威域名服务器。正如下图所示，当顶级域名 info 已被缓存时，客户端的请求在递归服务器后，直接被转发给了 ns2 名字服务器。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1aa07c1d1e344d1e8edb0674fe781624~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1688&h=758&s=88444&e=png&b=161822)

总结
==

在本文中，我们申请了域名`yuangui.info`并拥有了一个权威域名服务器，可管理其下的所有二级域名。我们深入分析了域名系统的运作方式，并为确保稳定服务，在`异地部署`了备份 DNS 服务器并验证了系统的健壮性。如果你没有条件拥有自己的域名，想要在 yuangui.info 下拥有一个自己机器的域名，也可以私信我哦～

DNS 系统仍存在许多值得探讨的问题，例如当在本地访问`hub.docker.com`时，可能会发现无法访问。请看下图，两次`dig`出现了完全不同的结果，而且命令`dig @1.1.1.1 hub.docker.com`中 @ 的服务器`1.1.1.1`甚至都不存在！对此你有何看法？

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8112d250431c47369dd8bd9c9697838d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3791&h=1060&s=1568525&e=png&b=012b36)

由于篇幅有限，本文先到此结束。我们将在后文继续讨论 DNS 的一些问题。