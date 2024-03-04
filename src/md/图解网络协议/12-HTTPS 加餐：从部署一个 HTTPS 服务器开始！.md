我们已经学了那么多 `HTTPS` 的理论知识了，你是不是已经跃跃欲试了呢？话不多说，首先让我们尝试来配置一个 `HTTPS 服务器`。

从部署一个 HTTPS 服务器开始
-----------------

实验环境下，可以使用自己的服务器和证书来尝试配置 `https 服务`。如果你没有自己的服务器和证书，你可以在本地生成一个自签名证书。

以下是使用 `OpenSSL` 生成自签名证书的步骤：

1.  安装 `OpenSSL`（一般Linux系统和MAC系统都自带了）。
2.  打开终端并导航到要保存证书的目录。
3.  运行以下命令以生成私钥：`openssl genrsa -out server.key 2048`。
4.  运行以下命令以生成证书请求：`openssl req -new -key server.key -out server.csr`。
5.  运行以下命令以生成自签名证书：`openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt`。

下面让我们部署一个HTTPS服务器，如果你的环境存在问题，建议使用之前所说的Docker环境解决。

### Node.js 部署

如果你已经生成了`自签名证书`，就可以使用 Node.js 的 `https 模块`在本地部署一个 `HTTPS 站点`。以下是一个使用自签名证书的示例。

1.  创建一个名为 `server.js` 的文件，并将以下代码复制到文件中：

    const https = require('https');
    const fs = require('fs');
    
    const options = {
      key: fs.readFileSync('server.key'),
      cert: fs.readFileSync('server.crt')
    };
    
    https.createServer(options, (req, res) => {
      res.writeHead(200);
      res.end('Hello, world!');
    }).listen(443);
    

2.  将 `server.key` 和 `server.crt` 文件放在与 `server.js` 相同的目录中。
3.  在终端中导航到 `server.js` 所在的目录，并运行以下命令以启动服务器：`node server.js`。
4.  在浏览器中访问 [https://localhost](https://localhost "https://localhost") ，你应该能够看到`“Hello, world!”`消息。

### Java 部署

使用`JAVA`来部署环境也很简单，因为`JAVA SDK`里也提供了`TLS`证书自签名的功能，无需再用`openssl`做更多的工作，代码如下。

    private void https() throws  CertificateException {
        SelfSignedCertificate cert = new SelfSignedCertificate();
        HttpHandler httpHandler = RouterFunctions.toHttpHandler(
                route(GET("/image"), request -> {
                    Path imagePath = Paths.get("/Users/ywz/http2/image2.jpg");
                    byte[] imageBytes = new byte[0];
                    try {
                        imageBytes = Files.readAllBytes(imagePath);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    return ServerResponse.ok()
                                .contentType(MediaType.IMAGE_PNG)
                                .bodyValue(imageBytes);
                })
        );
        HttpServer server = HttpServer.create()
                .secure(spec -> spec.sslContext(SslContextBuilder.forServer(cert.certificate(), cert.privateKey())))
                .port(443)
                .protocol(HttpProtocol.HTTP11).handle( new ReactorHttpHandlerAdapter(httpHandler));
        server.bindNow();
    }
    

访问[https://localhost/image](https://localhost/image "https://localhost/image") ，就能够得到一张图片了！

这个代码都很简单，当然你也可以直接参考`git clone https://github.com/yinwuzhe/https`的实现。

请注意，由于自签名证书不受信任的证书颁发机构颁发，因此你的浏览器可能会显示安全警告。如果是用于实际生产用途，那就需要先配置自己的域名，并且从需要从受信任的证书颁发机构（例如> `Let's Encrypt`）获得 `SSL/TLS 证书`。

搜索引擎排名：越安全越靠前
-------------

在 HTTPS 协议下，通过使用 SSL/TLS 加密技术，可以保护用户输入的敏感信息，如账号密码、信用卡号等。这些信息被加密后，即使被黑客窃取，也无法破解其中的内容。同时，HTTPS 协议还可以验证服务器的身份，保证用户与服务器之间的通信是安全的。

所以，HTTPS 协议真是个不可或缺的工具啊！除了能够保障用户数据安全，还可以提高网站的排名哦！Google 早在 2014 年就宣布了这个消息，HTTPS 协议是搜索排名的重要因素之一！这意味着，如果你的网站采用了 HTTPS 协议，那么你会拥有更高的搜索排名，进而获得更多的流量和曝光率！

当然，采用 HTTPS 协议也会对网站的性能产生一定的影响。因为它需要进行额外的加密解密计算，所以网站的响应速度可能会变慢。而且，采用 HTTPS 协议还需要购买 SSL 证书，这可能会增加网站的成本。

不过，尽管采用 HTTPS 协议会对性能和成本产生影响，但是这也是为了保护用户的隐私和敏感数据。因此，强烈建议网站管理员在考虑采用 HTTPS 协议时，要充分考虑这些因素，并做出最适合自己网站的决策。

如果你在做一个伟大的网站，那么你的网站必须要用到 https 了，不然你的服务根本不会被大家发现！

握手流程——必须要快
----------

因为 HTTPS 是如此重要、如此普及，所以 TLS 必须快。加速初次握手以进行身份验证和保障连接将大大有助于其采用。如果我们希望 Web 成功废弃非安全 HTTP，则这一点至关重要。

前文我们讲到，HTTPS 实际上是使用 TLS/SSL 协议来实现安全通信的。前面我们讲到 TLS 的握手流程如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/251573e126994b1fa6d29eb6beee15f4~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1662&h=1092&s=306018&e=png&b=ffffff)

可以看到这个描述的流程包含了两个 Round-Trip Time。

### 2-RTT 交互的 TLS1.2

我们也抓包看到了其中的 Client Hello、Server Hello 以及证书等包消息。整个过程是如下图所示的交互：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/81a1ff8ade5940ad90f483db93c8605b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=974&h=597&s=52565&e=png&b=fcfcfc)

这个是 TLS 1.2 的 2 个 RTT 的交互图，使用 RSA 非对称加密来生成共钥私钥对。椭圆曲线加密算法（Elliptic Curve Cryptography，ECC）是一种基于椭圆曲线数学理论的非对称加密算法。RSA 加密使用的是基于大素数分解的数学原理，其加密和解密的运算复杂度较高，因此需要使用较大的密钥长度来保证安全性。与 RSA 算法相比，ECC 算法在相同的安全性水平下需要更短的密钥长度，从而提高了传输速度和存储效率。

由于 ECC 算法的数学基础与离散对数问题相关，它对于量子计算机的攻击更为抗拒。并且，ECC 算法的加密和解密速度比 RSA 更快，这在移动设备、无线传感器网络等资源受限的环境下尤为重要。

所以为了更高效和安全，后来的 TLS 都采用 ECC 算法，采用 ECC 算法的流程如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3411fb3970ee4df89e7a3b6c9d13c3d0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=974&h=638&s=58054&e=png&b=fcfcfc)

我们抓包也可以看到对应的流程确实如上面描述的那样。 ![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5c001488f223409d80a0039d06d3a1b3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2426&h=164&s=174556&e=png&b=e6e5fe)

Certificate 和 Server Key Exchange 都是在 TLS 握手期间用于交换公钥并建立安全通信的关键信息。Certificate 是证明身份和公钥的标准方式，而 Server Key Exchange 则是在某些情况下的备选方案。

### 带 Session 的 TLS1.2

在 TLS 握手过程中，如果客户端发送的 ClientHello 消息带有 Session ID，则服务器可以使用该 Session ID 作为索引，在之前的会话状态中查找相应的加密参数，如对称加密算法、密钥长度和 MAC 算法等。服务器使用这些参数对接收到的数据进行加密和解密。如果客户端请求重用之前的会话状态，服务器可以避免重复协商过程，提高握手效率和通信速度，如下图所示的流程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8726cd34f5dd4ad1b6461f33148adfb0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=974&h=482&s=42668&e=png&b=fcfcfc)

我们可以通过抓包观察到多个交互过程中都使用了同一个会话 ID。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dd8eecaf259e4b1f90a053adab1b4bc9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1730&h=1294&s=259221&e=png&b=242424)

### 更高效的 TLS1.3

TLS 在初次握手时需要快速响应，因为这会影响用户体验和服务器负载。缩短握手时间和提高连接速度对于推广安全的 HTTP 和 Web 的发展至关重要。TLS 的发展从 1.2 到 1.3（大约在2015年），对整个流程进行了优化，提高了效率。TLS v1.3 草案中提出了 `1-RTT` 和 0-RTT 握手的建议，进一步加快了握手过程。

下面是一个`1-RTT`握手交互流程图，需要一个往返时间。 ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f7bedcc7a4f42ca86773a5b060b5952~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=974&h=522&s=45157&e=png&b=fcfcfc)

这种快速握手的实现得益于ECC加密算法，下面我们先看一下如何使用ECC。

    # 选定椭圆曲线方程和G点，选个随机数作为私钥
    $ openssl ecparam -name prime256v1 -genkey  -out privkey.pem
    # 从私钥生成公钥
    $ openssl ec -in privkey.pem -pubout -out public_key.pem
    read EC key
    writing EC key
    

使用`openssl ecparam -name prime256v1 -genkey -out privkey.pem`命令生成一个私钥，其中的prime256v1是ECC可选的参数之一，代表一个椭圆曲线方程和上面的一个点,是类似于下图这样的一条曲线。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/242b458de9ea425480730a3e1771819a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=300&h=300&s=13064&e=png&a=1&b=2a00fd)

> prime256v1，也称为 secp256r1，是一种椭圆曲线，是 NIST 标准中推荐的一种 ECC 曲线。它的方程为 y^2 = x^3 - 3x + b，其中参数 b 的值为：0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
> 
> 素数 p 的值：p = 2^256 - 2^224 + 2^192 + 2^96 - 1。
> 
> 基点 G 的坐标：G = (x, y)，其中 x 和 y 的值为：
> 
> x = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
> 
> y = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5

可以看到G 的坐标是一个大数。

在椭圆曲线密码学（ECC）中，双方可以通过相互交换公钥来得到共享密钥用于后续通信。这个过程通常使用椭圆曲线Diffie-Hellman（ECDH）密钥交换算法来实现。 就是使用的是椭圆曲线上的点而不是整数来进行运算。假设双方为Alice和Bob，他们共同协商一个椭圆曲线和一个基点G。Alice生成自己的私钥a和公钥A=aG，Bob生成自己的私钥b和公钥B=bG。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/48d65b2f9265431dadeb8bd7c377cec3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2857&h=698&s=589556&e=png&b=012b36)

Alice和Bob交换各自的公钥后，Alice计算出共享密钥K=aB=b(aG)，Bob计算出共享密钥K=bA=a(bG)。由于K=aB=bA，所以Alice和Bob最终得到的共享密钥是相同的。 ECC算法的安全性基于椭圆曲线上`离散对数问题`的困难性，攻击者无法从公开的信息中推算出私钥，因此也无法计算出共享密钥。

这样的话，`1-RTT`握手交互流程图是否可以理解了呢？客户端通过 `key_share` 交换选定的 ECC 参数和自己私钥计算出的公钥，服务器同意该参数后生成一个私钥，并将对应的公钥通过 `key_share` 返回给客户端。此时客户端和服务端都获得了对方的公钥，并可以通过上述公式计算出共享密钥 `K`。在传输数据之前，客户端还需验证证书等内容，若无法验证则不会继续通信。

`0-RTT` 还是利用了`会话Session`的思想，握手的交互流程如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2e0c040cf43f4812945ed4fa4e1b952a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1384&h=1020&s=156898&e=png&b=fcfcfc)

0-RTT 模式需要先前的会话才能使用。在 0-RTT 模式中，客户端使用从先前会话派生的密钥来发送加密的 Early Data，以尽可能快地发送数据。因此，如果之前没有与服务器建立过会话，则无法使用 0-RTT 模式。

此外，TLS 1.3采用`加密会话`来减少服务器资源消耗和提高安全性。使用加密的会话不需要服务器存储会话信息，从而减少内存消耗，并提高安全性。

总结
--

本文首先带着大家部署了一个最简单的 HTTPS 服务器！部署自己的 HTTPS 服务器可以为网站提供更高的安全性和保护用户的隐私，因为 HTTPS 使用加密技术保护数据传输过程中的机密性和完整性。

此外，HTTPS 还可以提升网站的可信度和用户体验，因为现代浏览器已经开始标记使用 HTTP 的网站为不安全，并且对使用 HTTPS 的网站进行优化和加速，从而提高了网站的访问速度和性能。

同时，随着 HTTPS 标准的不断发展和更新，如 TLS 1.3 协议的推出，HTTPS 也变得更加高效和安全，为网站提供更好的保护和服务。