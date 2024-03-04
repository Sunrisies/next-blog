本文开始探讨`应用层`的故事。在应用层中，`HTTP 协议`扮演着非常重要的角色。`HTTP 协议`是应用层协议中最为重要和广泛应用的协议之一。`Web 浏览器`通过 `HTTP 协议`向 Web 服务器请求资源，`Web 服务器`则通过 `HTTP 协议`向浏览器发送响应。除了 `Web 浏览器和 Web 服务器之间的通信`，`HTTP 协议`也被广泛应用于`其他应用程序之间的通信`。

> HTTP 协议最初由蒂姆·伯纳斯-李（Tim Berners-Lee）于 1991 年在 CERN（欧洲核子研究中心）开发，旨在为 Web 浏览器和 Web 服务器之间的通信提供一种标准化的方式。随着 Web 的迅速发展，HTTP 协议也不断演进，目前最新版本为 HTTP/3。

HTTP 发展历程
=========

最初版本的 HTTP 协议被称为`HTTP/0.9`，只支持客户端向服务器请求 HTML 文档，服务器响应文档并关闭连接。

在 1996 年，`HTTP/1.0`被引入，支持更多的请求方法、响应码和协议头字段，同时也支持多个对象的传输。但是，`HTTP/1.0` 还存在一些问题，例如每次请求都需要`重新建立 TCP 连接`，导致网络性能较差。

为了解决这些问题，`HTTP/1.1`在 1999 年被引入，引入了`持久连接`等新特性，大大提高了网络性能。此外，`HTTP/1.1` 还引入了缓存机制、压缩等功能，使得 Web 应用更加高效。

虽然目前`HTTP/2 和 HTTP/3`也都相继面世，但`HTTP/1`依然是这些非常重要的基础，本文重点讲解还在我们 Web 世界里面发光发热的`HTTP/1.1`协议。

在实战中掌握构成 HTTP 的要素
=================

HTTP 是应用层协议，通常用于从 Web 服务器传输`HTML`到本地浏览器。它支持请求响应模式、多种请求方法（如`GET、POST、OPTIONS、PUT`等）、`控制 Headers`、传输数据、多种响应码等。由于`请求响应模式`设计得很人性化，HTTP 协议易于理解和使用。

部署实验环境，感受问答式交互
--------------

为了搭建实验环境并部署一个`HTTP/1.1`服务器，我这里使用`Java` 框架进行演示。

> 要搭建一个Java开发环境，包括Maven（包管理工具和编译运行等）和IDE（全称是集成开发环境（Integrated Development Environment），用于编写代码），可以按照以下步骤进行：
> 
> 1.  下载Java Development Kit（JDK）：访问Oracle官网下载JDK并按照下载的安装程序进行安装。
> 2.  下载Maven：访问Apache Maven官网下载Maven并按照下载的安装程序进行安装。
> 3.  配置Maven环境变量：将Maven的bin目录添加到系统环境变量中。
> 4.  下载IDE：可以选择Eclipse或IntelliJ IDEA等Java IDE，访问官方网站下载并按照下载的安装程序进行安装。
> 5.  配置IDE：打开IDE并安装Java开发插件，然后配置Maven路径和Java路径。 完成以上步骤后，你就可以开始使用Java开发环境进行编程了。
> 
> 安装配置环境是每个开发者的入门过程，有时候会遇到各种问题和困难。如果你在这个过程中遇到了任何问题可以寻求帮助。

在成熟的开发框架里面，启动`HTTP/1.1`服务器只要很少的几行代码（如果开发环境还有问题，可以先不着急上手，后面会给出更加方便的操作指南～），比如如下所示的代码。

    public Server() throws CertificateException, IOException {
            HttpHandler httpHandler = RouterFunctions.toHttpHandler(
                    route(GET("/"), request -> ServerResponse.ok()
                            .bodyValue("你好"))
            );
            ReactorHttpHandlerAdapter adapter = new ReactorHttpHandlerAdapter(httpHandler);
            HttpServer httpServer = HttpServer.create().port(90)
                    .protocol(
                            HttpProtocol.HTTP11
                    ).handle(adapter);
            httpServer.bindNow();
        }
    
    

这段代码使用 `HttpServer.create()` 创建一个 `HttpServer` 对象，并将其绑定到 90 端口，使用 `HTTP 1.1` 协议。最后，通过调用 `bindNow()` 方法启动这个 `HttpServer`。这段代码的作用是创建一个简单的 HTTP 服务器，监听在本地 `90 端口`，`路由“/”接收 GET 请求并返回一个字符串 "你好"`。 启动服务器后，在浏览器中访问 [http://localhost:90/](http://localhost:90/ "http://localhost:90/") ，即可捕获如下图所示的数据包：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4ce40b657bd74fd8b9ab2d173d809c33~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1878&h=1638&s=307449&e=png&b=222222)

`HTTP/1.1` 的请求格式固定，包括`起始行、头部部分、空行和 Body 内容`等段落，并且使用`换行符`作为各个段落之间的分隔符。如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d27f2ccaaecd45d5b20864b81cfd992b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=505&h=261&s=31146&e=png&b=fefefe)

起始行指定了`请求方法（例如 POST）`、`URI 路径`（例如`/ 或者 /test/a`）和`协议版本（例如 HTTP/1.1）`。头部部分提供了更多的请求信息，如果请求包含 Body 内容，则一般会指定 `Content-Length` 以指示 Body 的长度。需要注意的是`头部字段可以不区分大小写`。

同样，可以观察到服务器返回的响应格式也有类似的结构，如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/480022e42c51492d85551cf305c27920~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=902&h=204&s=200732&e=png&b=212121)

`响应包`的格式如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c0d794bbb95540e89a8cddc649438b9a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=363&h=261&s=21635&e=png&b=fdfdfd)

响应的格式和请求类似，都是使用`换行符`作为各个字段之间的分隔符。通常，一个响应由以下几个部分组成：

*   `起始行（HTTP/1.1 200 OK）`返回一个 `HTTP 状态码`，例如这里的 `200 OK`。
*   头部字段
*   空行
*   响应体内容，通过 `Content-Length` ，我们可以知道`响应体内容的长度`。

HTTP 请求方法概述
-----------

前面抓包演示的请求方法是 `GET`，但 `HTTP` 还定义了多种请求方法，每种方法都有其特定的作用和特性。以下是几个常用的 HTTP 请求方法及其特点：

method

作用

`GET`

用于获取资源，通常用于请求页面、图片、视频等静态资源。GET 请求可以被缓存，并且可以被浏览器收藏。

`POST`

用于提交数据，通常用于表单提交、文件上传等场景。POST 请求不能被缓存，数据会被包含在请求体中，相对于 GET 方法更安全。

`PUT`

用于更新资源。PUT 方法会将请求体中的数据替换掉指定的资源，如果资源不存在则会创建新资源。

`DELETE`

用于删除资源。DELETE 方法会删除指定的资源，如果资源不存在则会返回 404 错误。

`HEAD`

与 GET 方法类似，但只返回响应头部信息，不返回响应体。HEAD 请求通常用于获取资源的元信息，如文件大小、修改时间等。

`OPTIONS`

用于获取服务器支持的 HTTP 请求方法和相关选项。OPTIONS 请求会返回服务器支持的请求方法列表和请求头信息等。

可以参考 RFC [www.rfc-editor.org/rfc/rfc2616…](https://www.rfc-editor.org/rfc/rfc2616#section-5.1.1 "https://www.rfc-editor.org/rfc/rfc2616#section-5.1.1") 去了解更多。

HTTP 响应码一览
----------

前面演示的实验，我们看到 `HTTP 响应码是 200`，这是什么意思呢？HTTP 响应码是指服务器响应客户端请求时返回的状态码。HTTP 响应码由三位数字组成，第一位数字表示响应的类别，共分为五类，具体如下：

类别

作用

1xx

信息性状态码，表示请求已接收，继续处理。

2xx

成功状态码，表示请求已成功接收、理解和处理。

3xx

重定向状态码，表示需要客户端进一步操作才能完成请求。

4xx

客户端错误状态码，表示客户端提交的请求有错误，服务器无法处理。

5xx

服务器错误状态码，表示服务器处理请求时出现错误。

常见的 HTTP 响应码包括：

*   `200 OK`：请求成功。
*   `204 No Content`：请求成功，但响应体为空。
*   301 Moved Permanently：永久重定向，请求的资源已被永久转移到新的 URL。
*   `304 Not Modified`：客户端缓存资源未过期，服务器返回资源未修改的响应。
*   400 Bad Request：请求有错误，服务器无法处理。
*   401 Unauthorized：请求需要身份验证，但未提供有效的身份凭证。
*   403 Forbidden：请求被拒绝，服务器没有权限处理请求。
*   404 Not Found：请求的资源不存在。
*   `500 Internal Server Error`：服务器内部错误。
*   `503 Service Unavailable`：服务器不可用，通常是由于过载或维护等原因。

所以，前面的 200 表示请求成功。了解 HTTP 响应码可以帮助你更好地理解服务器响应信息，今天访问一个网站就遇到 503，那可能是`服务器过载`了（这个网站是一个免费的星座网站，可能受到竞争对手的攻击而过载了）。

HEADERS，应用控制的魔法
---------------

演示实验中我们还看到头部有 `Content-Type` 和 `Content-Length` 等内容，都是明文编码的。HTTP 协议中采用文本形式编码的头部 HEADERS 有更好的可读性和可调试性。常见的头部用于解决各种问题，不需要背诵。由于用途广泛且实际使用场景多，相关内容略多。

我总结了一个 HEADERS 功能的表格，如下表格所示：

作用范围

Headers

用于`缓存`的

Cache-Control、if-modifyed 系列 ETAG

用于`传输优化`，包括压缩的

Transfer-Encoding: chunked、gzip 等

用于内容的

Content-Type 设置媒体类型、Content-Length

用于连接的

Connection、Upgrade 等用了升级为 websocket/http2

用于状态的

Cookie、Authorization 等

用于`传输过程`的信息

Forwarded-for 等

尽管你可能对这些 `HEADERS` 的作用还有很多疑问，但不要着急！让我们通过实际示例来了解这些 `HEADERS` 、请求方法和状态码的作用，因为`“talk is cheap，show me the code”`。

HTTP1 实战大作战
-----------

在开始实战之前，我们需要确保自己的开发环境可用。如果你的环境存在问题，强烈建议使用Docker沙盒环境解决。使用`Docker`[创建一个沙盒环境](https://docs.docker.com/engine/install/ "https://docs.docker.com/engine/install/")（适用于`Linux/MAC/Windows`系统），然后再按照如下步骤启动开发环境、获取代码、运行程序。

    //运行Docker开发环境
    # docker run -it ksimple/java8-mvn-nodejs-npm-python3 bash
    
    //进入doker,clone代码仓库
    root@f034fd594c8e:/# git clone https://github.com/yinwuzhe/http1
    root@f034fd594c8e:/# cd http1
    
    //编译打包运行
    root@f034fd594c8e:/http1# mvn clean package
    root@f034fd594c8e:/http1# java -jar target/http1-1.0-SNAPSHOT.jar
    

### 演示各种请求方法

让我们首先看一个简单的 `HelloController`（代码都放在[GitHub仓库](https://github.com/yinwuzhe/http1 "https://github.com/yinwuzhe/http1")了，具体命令参考上面的步骤），它使用 `Spring Boot 的 RestController 注解`简化其代码，我在其中定义了处理 `HTTP 请求的各种方法`，我们一起来看一下。

        @RestController
        public class HelloController {
    
            private String name="hello,buddy!";
            @RequestMapping(value = "/",method = {RequestMethod.HEAD,RequestMethod.OPTIONS})
            public void hello() {
            }
            @GetMapping("/getName")
            public String getName() {
               System.out.println("name = " + name);
               return name;
            }
            @RequestMapping(value = "/modifyName",method = {RequestMethod.POST,RequestMethod.PUT})
            public Boolean modifyName(@RequestBody  String name) {
                System.out.println("name = " + name);
                this.name=name;
                return true;
            }
            @DeleteMapping("/delName")
            public Boolean delName() {
               this.name="";
                return true;
            }
    }
    

这个类使用了注解`@RequestMapping`来定义各种请求方法，定义了处理 HTTP 请求的不同方法。

通过客户端命令 `curl`（`curl`是一个命令行工具，用于在终端中向服务器发送HTTP请求并接收响应） 来和服务器交互，输入命令`curl -X OPTIONS http://localhost:8080/ -v`来使用 HTTP `OPTIONS`请求方法，结果如下图所示：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f88695149b64dacb39dce37b2fbe2f7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1330&h=520&s=280429&e=png&b=1e1e1e)

可以看到，服务器通过返回`Allow`头部告知我们它支持`GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH`这些方法。

再来看下`HEAD`请求方法`curl -X HEAD http://localhost:8080/getName -v`。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5126cb1768eb4b15a2c53d4c2cbad6af~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1420&h=560&s=110748&e=png&b=1e1e1e)

HEAD 请求只返回头部，使用`Content-Length`来指示内容长度为 12，不返回具体的`Body`内容。其实，`HEAD`和`OPTIONS`请求无需显式定义，每个支持`GET/POST`的请求都默认也支持`HEAD`和`OPTIONS`，比如`/getName`只显示的定义了支持`GET`，但是通过`HEAD`访问也可以。

其他更加常用的几个方法，如下图所示。

*   `GET`请求`curl http://localhost:8080/getName -v`一般用于获取内容，这里返回了`text/plain`类型的打招呼内容；
*   `POST`方法`curl -X POST http://localhost:8080/modifyName -H "Content-Type: text/plain" -d "newName" -v` 常用于修改资源，通过这个方法我们修改了名字，你可以再次访问`/getName`验证一下；
*   `DELETE`方法被常用于删除资源，这里通过`/delName`删除了名字。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0588bc65d1174d4293ebae59a2fdf2d4~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=5874&h=3696&s=3362994&e=png&a=1&b=012b36) 还有更多的一些请求方法，如果你感兴趣不妨也试下呢？

### 媒体类型：展示更友好

前面返回的`Content-Type内容类型`都是纯文本类型 `text/plain`，现在让我们来看一个返回`图片格式`响应的请求。

     @GetMapping(value = "/getImg",produces = {"image/jpg"})
        public byte[] getImg() {
            Path imagePath = Paths.get("/Users/ywz/http2/image2.jpg");//自己准备一张图片
            byte[] imageBytes = new byte[0];
            try {
                imageBytes = Files.readAllBytes(imagePath);
            } catch (IOException e) {
                e.printStackTrace();
            }
            return imageBytes;
    }
    

通过在浏览器中访问[http://localhost:8080/getImg](http://localhost:8080/getImg "http://localhost:8080/getImg") ，你可以在页面上正常显示图片。这是因为响应头部的`image/jpg`告诉浏览器客户端该文件是一张图片，因此浏览器可以将其展示在网页上。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a3410dbe6c8e467f894670c38b273ce0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2361&h=1076&s=625888&e=png&b=222326)

因为图片的大小是 `23400 字节`超过了 `MTU`，所以会被拆分为多个TCP包进行传输。 你不妨使用 `sudo tcpdump -i any src host localhost and src port 8080` 观察这个请求响应的具体过程，看看这个HTTP响应是否分为了多个 TCP 包传输。

### 观察各种响应码

我们谈到了 `HTTP 有几大类响应码`，正常情况返回 200，现在让我来看下响应码为 3xx、4xx 和 5xx 的情况。

    @GetMapping("/return302")
        public ResponseEntity return302(){
            return ResponseEntity.status(HttpStatus.FOUND).header("Location", "重定向的URL").build();
        }
        @PostMapping("/return400")
        public ResponseEntity<String> return400() {
            return ResponseEntity.badRequest().body("Name is required");
        }
        @GetMapping("/return500")
        public ResponseEntity<byte[]> return500() throws IOException {
           int a=2,b=0;
            int i = a / b;
            return null;
    }
    

访问这些请求，各自的响应结果如下图所示。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3e3aafe9f19a4bdaade286aa4da9d55f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=5700&h=3293&s=3162765&e=png&a=1&b=012b36)

*   `302 表示重定向到另一个网站`。如果在浏览器中打开，它将自动跳转到`Location`指定的网站。
    
*   `405 表示请求参数错误`。
    
*   `500 一般表示服务器错误`，出现了错误的处理，比如这里的`除零错误`。
    

你还能构造更多的响应码的请求方法吗，欢迎在评论区留言～

### 压缩文件，节省带宽

当你需要传输大文件时，可能会特别占用带宽；HTTP 也早就想到了，可以通过`压缩功能`来帮助你节省网络带宽。

这意味着，你可以在发送文件之前对它进行压缩，然后在 HTTP 请求头中添加 `Content-Encoding:gzip`，这样接收方就会知道这个包是被压缩过的。这种方式能帮助你更快地发送和接收文件，节省你的时间和网络资源。让我们看如下代码：

     @GetMapping(value = "/gzipDownload", produces = {"image/jpg"})
        public ResponseEntity<byte[]> getData() throws IOException {
            // 获取原始数据，例如从数据库或其他来源
            byte[] imageBytes = getBytes();
            // 使用gzip压缩数据
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (GZIPOutputStream gzipOut = new GZIPOutputStream(baos)) {
                gzipOut.write(imageBytes);
            }
            byte[] compressedData = baos.toByteArray();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Content-Encoding", "gzip");
            headers.setContentType(MediaType.IMAGE_JPEG);
            headers.setContentLength(compressedData.length);
            return new ResponseEntity<>(compressedData, headers, HttpStatus.OK);
    }
    

使用命令`curl http://localhost:8080/gzipDownload -v --output test.gz`我们看到：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d2edcae551241f6b7a8835bd417e3f6~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=974&h=558&s=112472&e=png&b=0e2b35)

客户端再使用命令`gzip -d test.gz`就可以解压缩，获取到原始内容了。

### 缓存：减少重复访问，提高效率！

还有什么呢？HTTP 在提高效率方面下了狠功夫，还有一项非常实用的功能——缓存！看下面的代码，我们可以通过设置 HTTP 响应头中的`Cache-Control`来开启缓存功能。

    @GetMapping("/cache")
    public ResponseEntity<byte[]> getExampleResource() throws IOException {
        byte[] imageBytes = getBytes();
        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic().getHeaderValue());
        return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);
    }
    

当我们访问这个路由时，响应头部会包含`Cache-Control: max-age=3600,public`。这样，如果客户端支持缓存，比如浏览器，就会缓存这个响应。在接下来的一个小时内，如果再次访问这个路由，浏览器就不会再向服务器发送请求，而是直接使用之前缓存的响应。这种方式能够大大提高网页加载速度，给用户带来更好的体验。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/181df7d1fdc04818b0880fe08eab37fb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=842&h=452&s=96135&e=png&b=0e2b35)

让我们再看一个例子，我们也可以通过设置 HTTP 响应头中的 ETAG 来开启缓存功能。

    @GetMapping("/return304")
            public ResponseEntity<byte[]> return304(@RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch,
                    @RequestHeader(value = "If-Modified-Since", required = false) String ifModifiedSince) throws IOException {
                byte[] resource = getBytes();
                HttpHeaders headers = new HttpHeaders();
                // 设置ETag和Last-Modified属性
                String etag = calculateETag(resource);
                headers.setETag(etag);
                headers.setLastModified(LocalDate.now().toString());
                // 如果客户端已经缓存了资源，并且资源没有变化，则返回304 Not Modified响应
                if (ifNoneMatch != null && ifNoneMatch.equals(etag) || ifModifiedSince != null && getLastModifiedTime().toEpochMilli() <= Date.parse(ifModifiedSince)) {
                    return ResponseEntity.status(HttpStatus.NOT_MODIFIED).headers(headers).build();
                }
                // 否则返回完整的资源
                return ResponseEntity.ok().headers(headers).body(resource);
    }
    

我们定义了一个路由，它返回一个包含资源字节的响应实体。我们设置了`ETag`和`Last-Modified`属性，并检查客户端是否已缓存资源并且资源是否发生变化（通过客户端请求的`If-None-Match`头和`If-Modified-Since`来判断）。如果资源未更改，则返回`304 Not Modified`响应，否则返回完整的资源。

访问这个路由吧，你可以顺便抓包看到这其中的`HEADERS`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a8fbd1537ead4e15a326c1f556a049b3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=7920&h=1783&s=3961489&e=png&a=1&b=012b36)

### 流式数据传输，防止用光内存

`HTTP` 不仅在提高效率方面下了狠功夫，还为`流式数据传输`打开了大门。

流式传输是指在数据传输过程中，数据会被`分成多个小块依次传输`，而不是一次性传输完毕。每个小块的大小可以是固定的，也可以是动态变化的，但是传输过程中数据的整体大小是未知的。 与传统的一次性传输不同，流式传输可以实现`边生成边传输`、`边传输边处理`的效果，这种方式在网络传输和实时数据处理等场景中非常常见。

在流式传输中，数据的传输和处理是同时进行的，当收到一部分数据时，就可以立即处理这部分数据，而不需要等待整个数据集传输完毕后再进行处理。这种方式可以大大减少数据传输和处理的延迟，提高数据传输和处理的效率。 流式传输可以应用于各种场景，如`实时视频流`、音频流、网络游戏、在线聊天等。

我们看下面的例子。

     @GetMapping(value = "/chunkDownload")
        public ResponseEntity<InputStreamResource> downloadFile() throws IOException {
            // 从文件系统或其他来源获取InputStream
            InputStream inputStream = new FileInputStream("/Users/ywz/Documents/XIAOYUANGUI/video/generic.mp4");
            // 创建一个InputStreamResource并将其传递给ResponseEntity
            InputStreamResource resource = new InputStreamResource(inputStream);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("video/mp4"))
                    .body(resource);
    }
    

在这里，我们将一个很大的 `video/mp4` 文件传输给浏览器，实现在线观看视频。使用浏览器访问[http://localhost:8080/chunkDownload](http://localhost:8080/chunkDownload "http://localhost:8080/chunkDownload") ，就可以在线观看这个视频了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/59be151a2de94607978b2dc9521206c8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3512&h=1654&s=2675786&e=png&b=111111)

流式传输是通过设置`Transfer-Encoding: chunked`头部实现的。当使用 `Transfer-Encoding: chunked` 时，响应体会被分成一系列块，其中最后一个块的大小为 0来标记传输结束。

这种方法对于服务器和浏览器都有好处。浏览器可以按需播放视频，而不需要等待整个视频传输完毕。另外，服务器对内存的要求较低，即使`内存设置较小，也能传输较大的视频文件`。例如，我们这里将服务器内存设置为`-Xmx256m`，但实际上可以传输 1.6G 的视频文件。

另外通过抓包，我们可以看下整体的 IO 统计情况，如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/707552212bf84268aa4ebee09873bde3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2728&h=1244&s=148340&e=png&b=ffffff) 刚开始传输的速率很快，后面因为内存不够用的原因，整体传输虽然变得比较慢，但并不影响视频的播放。

我们讲到了`HEADERS`控制的各种场景，甚至包括`流式数据传输`的场景，你可以思考下你工作上还有什么场景需要用到流式传输来帮助提高效率呢！欢迎留言～

总结
--

本文通过大量实践，旨在帮助你了解并掌握 HTTP 的各种元素和用法；通过实战，来深入理解 HTTP 协议的工作原理。

另外留下一个作业，希望你能使用`HTTP 头部的 cookie 和 session`来设计一个具有登录状态的服务器。如何设计一个有趣且完美的服务呢？我们也将在后续继续探讨 HTTP 的设计。