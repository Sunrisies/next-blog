我们在[《实战 HTTP1，并深入理解 HTTP 协议的工作原理》](https://juejin.cn/book/7209116225988165667/section/7215499018343252003 "https://juejin.cn/book/7209116225988165667/section/7215499018343252003")的结尾提出了一个想法：使用 HTTP 头部的`Cookie`和`Session`设计一个具有登录状态的服务器。本文接下来将介绍如何实现这一功能，无论你是否已经熟悉这些概念和设计，都可以跟随我来一起探讨这部分内容。

先来介绍一下什么是`Cookie`和`Session`。

为什么发明 cookie 和 session？
=======================

我们现在访问的网站已经几乎全部都使用 cookie 了，所以你可能不能想象到如果没有 cookie 世界会怎么样。

如果没有 cookie，Web 浏览器仍然可以正常工作，但是一些网站的功能可能会受到限制，例如：

1.  在网上购物时，用户需要在每个页面上重新输入商品信息和付款信息，而不能像使用 Cookie 时那样将它们保存在购物车中（假如购物车的信息没有及时保存到后台存储）。
2.  用户每次访问需要登录的网站时，都需要重新输入用户名和密码，而不能像使用 Cookie 时那样保持登录状态。

Cookie 和 Session 的发明者是一位名叫`Lou Montulli`的程序员，他大约在 1994 年为了解决早期的 Web 浏览器无法保持用户状态的问题而发明了`Cookie`。

Cookie 是一种在 Web 浏览器和 Web 服务器之间传输的`小型文本文件`。

> 在 HTTP 协议中，cookie 的大小限制是 4KB。如果超过这个限制，服务器将无法设置 cookie。需要注意的是，浏览器对 cookie 的大小限制也有可能不同，这取决于具体的浏览器实现。

当用户访问一个网站时，服务器可以向用户的浏览器发送一个 Cookie，其中包含一些关于用户会话的信息，如用户 ID、用户名、购物车内容等。浏览器将这些信息存储在用户的计算机上，并在以后的请求中将 Cookie 发送回服务器。服务器使用 Cookie 中的信息来识别用户，并根据其存储的信息为他们提供个性化的体验。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ad55e6c6cc7c4222b0e3ba4141ff935a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2269&h=1313&s=166486&e=png&b=e8ebee)

当你在访问网站时，网站会通过 cookie 来记住你的状态，比如你的购物车里有哪些商品。但对于一些重要的信息，比如你的登录信息，网站需要更谨慎地处理。

因为不能相信客户端说的一切，所以网站需要一种方法来验证你的身份，以确保你是真的用户。这就需要一个“`暗号`”，也就是一个随机的数字，服务器会在你登录后（验证你的帐号密码）发送给你，并要求你在以后的请求中带上这个暗号。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/90da40cd5359460e85a79bc78432b0ec~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2038&h=825&s=118874&e=png&b=e8ebee)

当然，这个暗号也有被窃听的风险，所以网站必须使用`HTTPS`来保证安全。

`session`的发明和设计就是为了防止别人伪造你的身份，如果能理解这个，就能明白为什么`session 和 cookie 的设计`如此经典了，再和`HTTPS`一起协同工作，一个用户的身份在互联网上就很难被伪造也很难被窃取了。

让我们再给 Session 下一个正式一点的定义：`Session`是一种在 Web 服务器上存储用户状态的机制。当用户第一次访问一个网站时，服务器会为他们创建一个唯一的`Session 会话 ID`作为 cookie 返回，并将其存储在一个称为`Session 的数据结构`中。这个`Session ID`在用户的所有请求中都会被`发送回服务器`，服务器使用它来查找`Session 数据结构`并维护用户状态。

观察语言框架的 Session
===============

请查看此已实现登录效果的页面：[cookie.yuangui.info/](https://cookie.yuangui.info/ "https://cookie.yuangui.info/") 。可用以下任一帐号登录：`user1:pass1`、`manager1:manager1`或`圆规:hello`。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/939505d45b01402c8d649662d077aa83~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=5435&h=1250&s=2402041&e=png&b=242528)

使用账号`user1`登录后，再打开控制台查看浏览器的 cookie，会发现多了一个名为`JSESSIONID`的 cookie。`JSESSIONID`是服务器在登录成功时设置的，对于熟悉 Java 的同学，可能知道这是 Java 中`HttpSession`方法的实现。

我将展示如何用`HttpSession`实现一个简单的 HTTP 登录程序。以下是几行关键代码，要使用该程序，你需要处理前端和后端部分。

首先，创建一个登录页面。创建一个`login.html`文件，包含用户名和密码字段，并使用`POST`方法将表单数据发送到后端处理程序。接下来，创建一个后端处理程序。在该程序中，获取通过`POST`方法传递的用户名和密码，并将其与数据库中（目前是固定的几个）的用户凭据进行比较。如果成功，则使用`HttpSession`实例创建一个`Session`用户，否则提示验证失败。

> 代码和部署方式请参考后面的说明。

    @RequestMapping("/")
    public String home(HttpSession session, HttpServletResponse response) throws IOException {
        Object username = session.getAttribute("username");
        if (username == null) {
            //`检查用户是否已经登录`。如果未登录，则重定向到登录页面。
            response.sendRedirect("/login.html");
        } else {
            return "Hello " + username;
        }
        return "";
    }
       @PostMapping("/login")
        public ResponseEntity<Void> login(@RequestParam String username, @RequestParam String password,HttpSession session) {
        boolean authenticated = Utils.authenticate(username, password);
        if (authenticated) {
            //登录成功则设置Session
           session.setAttribute("username",username);
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create("/"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
          } else {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
          }
    

留意到我们这里用到了跳转逻辑，访问 url 时如果未登录，需要`302 跳转`到登录页面。在登录页登录成功则`跳转回`之前的页面。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/49c2760a2ce34c00900814ee9862d85f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1870&h=471&s=48222&e=png&b=f3f5f6)

`HttpSession`内部通常使用一个名为`JSESSIONID的cookie`来标识和跟踪会话，用于在客户端和服务器之间唯一标识用户会话。`JSESSIONID`通常是一个`随机生成的字符串或数字`。在用户的浏览器中，这个 cookie 在后续的请求中会发送回服务器，以便服务器能够识别特定的用户会话并在会话之间进行转换。

在一些 Web 应用程序中，`JSESSIONID`可能会被加密或编码，以提高安全性。这通常是通过使用加密算法或哈希函数来完成的。例如，在 Java 中，可以使用`javax.crypto 包中的加密 API`来加密`JSESSIONID`。然而，这种做法并不常见，因为`JSESSIONID`本身已经足够`随机`，足以保证安全性。

使用现有主流语言框架都能很方便地实现登录功能，`其他编程语言`也有类似支持`Session 的框架`。尽管我们已经了解了其原理，但仍需考虑`HttpSession`内部的实现细节，如`Cookie 的生存时间和范围`等。为深入理解这些细节，我们可以手动实现一个类似的功能，从头开始建立一个`Session 管理器`。这样做可以更好地理解 Session 的实现原理，并解决各种安全和性能问题。

一起来看下吧。

> 造轮子是最好的学习方式之一！

深入学习 Cookie，自己实现登录服务
====================

我们首先学习如何`在服务器端设置 cookie`。

服务器设置`Cookie`
-------------

我们先执行最简单的任务，即`设置 cookie`。使用与上面代码相同的登录界面，但用户登录成功后，我们将不再使用现成的`Http Session`，而是`自己设置一个 cookie`。

    @RequestMapping("/admin")
    public String admin(HttpServletRequest request,HttpServletResponse response) throws IOException {
        Map<String, String> cookieMap = new HashMap<>();
       ...
        String username = cookieMap.get("user");
        if ( username== null) {
            response.sendRedirect("/login2.html");
        } else {
            return "Welcome to Admin, " + username;
        }
        return "";
    }
    @PostMapping("/login2")
    public void login(@RequestParam String username, @RequestParam String password,
            HttpServletResponse response) throws IOException {
       if(Utils.authenticate(username,password)) {
            // Login successful, set cookie
            Cookie cookie = new Cookie("user", username);
            cookie.setMaxAge(36000); // 过期时间1小时
            cookie.setPath("/admin");
            response.addCookie(cookie);
        
            response.sendRedirect("/admin");
        } else {
            response.getWriter().println("Invalid username or password");
        }
    }
    

这里我们使用`/admin`页面来演示怎么设置 cookie。在本地启动应用程序，然后访问[http://localhost:8081/admin](http://localhost:8081/admin "http://localhost:8081/admin") ，就能立即跳转到登录页面啦！

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f5dd8a89133d49d9a665f1faf07d7f66~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3326&h=1967&s=512491&e=png&b=f1f3f5)

在用户输入账号密码并得到正确的校验之后，我们设置了一个名为`user`的 cookie，cookie 的值就是我们登录的用户名字。这里将`user`的 cookie 最大生存时间设置为`1 小时`，这意味着浏览器将在一个小时后丢弃该 cookie。此外，我们将 cookie 的路径设置为`/admin`，这样在其他路由，如`/`中，浏览器将不会将其作为 cookie 头发送到服务器。这是一个仅在`/admin`及其子路由下有效的 cookie，不像我们之前设置的`JSESSIONID`，它在`/`下有效，所以也能在`/admin`路由下看到，如上图所示。

你可以尝试将 cookie 的过期时间设置得比较短，验证一下是否很快就失效了呢。

> 如果你无法在本地部署环境，请使用以下链接进行访问并验证：[cookie.yuangui.info/admin/](https://cookie.yuangui.info/admin/ "https://cookie.yuangui.info/admin/") 。

客户端伪造`cookie`
-------------

我们已经看到了服务器设置`cookie`的情况，同时客户端也可以设置`cookie`，例如在将商品添加到`购物车`时，通常是`客户端将内容放入 cookie`中。

但是为什么不能直接使用`cookie`作为登录信息呢？这是因为我们担心客户端会伪造`cookie`，即使使用`https`也无法解决这个问题。

让我来模拟一下`客户端伪造 cookie`，在登录页面 [cookie.yuangui.info/admin/](https://cookie.yuangui.info/admin/ "https://cookie.yuangui.info/admin/") 未登录时，就在浏览器控制台中输入以下脚本，操作方法如下图所示。

    function setCookie(name, value, expires, path, domain, secure) {
      let cookie = name + '=' + encodeURIComponent(value);
      if (expires instanceof Date) {
        cookie += '; expires=' + expires.toUTCString();
      }
      if (path) {
        cookie += '; path=' + path;
      }
      if (domain) {
        cookie += '; domain=' + domain;
      }
      if (secure) {
        cookie += '; secure';
      }
      document.cookie = cookie;
    }
    setCookie('user', 'john_doe', new Date(Date.now() + 86400000), '/', null, false);
    

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/578348db1886457088bcfbaeab97ba52~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2230&h=1052&s=232435&e=png&b=212225)

`回车执行`这个脚本之后，将看到多了一个 key 是`user`的 cookie，其值正是我们设置的`john_doe`。再次进入`/admin`页面，你会发现`不用登录`便收到了欢迎词！

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1c0f06d39d74891969cd46901d26e1e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3748&h=800&s=605548&e=png&b=222326)

如果客户端都知道按照这个方法伪造，那我们的网站将会非常不安全。因为任何人都可以`模拟任何用户`，从而访问我们的网站，像"`john_doe`"这个用户原本是无法登录我们系统的，现在只要在 cookie 中注入一条`user`的信息也能够登录了。

注意到脚本中设置了 cookie 的`生存时间（1000 天）`和`path（/）`，这个含义在上面也已经了解过了。此外在设置 cookie 时，我们可以指定`domain`来定义哪些域名下该 cookie 有效，domain 的设置还支持`正则匹配`，后面我们会知道，这在`跨域名设置 cookie`时是非常有用的。

另外，cookie 的`secure`选项可以设置为 true，仅当使用`https 协议`时，该 cookie 才会发送到服务器。你也可以在我部署的`cookie.yuangui.info`（通过 http 和 https 都可以访问的网站）上验证该选项。

亲手实现 `HTTPSession`
------------------

通过使用`cookie 传递信息`，服务器和客户端可以维持状态，但是这种状态并不是安全的，因为客户端可以伪装。因此，服务端必须进行验证来确保客户端提供的信息是真实可信的。怎么`确保客户端说的是真话`呢，那就是我们之前所说的`session 机制`，原理我们已经了解，现在我们使用`"/mysession”`页面来实现自己的 Session。

    @PostMapping("/login3")
    public void login(@RequestParam String username, @RequestParam String password,
            HttpServletResponse response) throws IOException {
        if (Utils.authenticate(username,password)) {
            Session session = SessionManager.createSession(username, 3600);
            Cookie cookie = new Cookie("session_id", session.getSessionId());
            cookie.setMaxAge(3600); // 1 hour
            cookie.setPath("/mysession");
            response.addCookie(cookie);
            response.sendRedirect("/mysession");
        } else {
            response.getWriter().println("Invalid username or password");
        }
    }
    
    //SessionManger的实现
    public static Session createSession(String username, int expirationTime) {
        String sessionId = UUID.randomUUID().toString();
        Session session = new Session(sessionId, username, expirationTime);
        sessions.put(sessionId, session);
        return session;
    }
    public static Session getSession(String sessionId) {
        Session session = sessions.get(sessionId);
        if (session != null && session.isValid()) {
            return session;
        } else {
            return null;
        }
    }
    public static class Session {
       ...
        public boolean isValid() {
            return System.currentTimeMillis() < expirationTime;
        }
    }
    

这段代码实现了一个基本的`Session`会话管理器。其中`createSession()`方法创建一个新的会话，生成一个唯一的`sessionId`，将`sessionId`和会话对象`存储在内存 sessions Map`中，并将会话返回。`getSession()`方法接受一个`sessionId`作为参数，并从`sessions Map`中`检索`相应的会话对象。如果会话存在且仍然有效，则返回该会话。`isValid()`方法用于检查会话是否过期。

访问 [http://localhost:8081/mysession](http://localhost:8081/mysession "http://localhost:8081/mysession") 并登录后，你将看到如下页面：

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cedc08775c3c467eadd059ee651d051f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3252&h=844&s=568921&e=png&b=232427)

我们看到返回的`cookie:session_id`是一个随机字符串。在这种情况下，如果客户端想要伪造一个用户，其生成的伪造信息很难是`合法的 ID`。只要服务器无法在其内存中获取该 ID，则会认为用户身份非法。随机数的范围空间极大，因此客户端伪造成本极高，又因为`cookie`的生存时间设置得较短，客户端一般不存在`伪造成功`的可能。

然而，`将 session 存储在内存中`存在系统异常或重启的风险，如果系统突然异常重启，用户就需要重新登录。尤其在负载均衡环境下，同一个用户的请求可能会被发送给不同的服务器。用户在一个服务器上登录，而当下一个请求被分配到不同的服务器时，用户还需要重新登录，这简直就是灾难！

因此，为了避免这种种问题，我们需要将 session 存储在`分布式`且高效的共享存储中，使用`Redis`是一种可行的解决方案。

使得系统稳健的分布式 Session
------------------

`Redis`作为 Session 存储的好处很多，它不仅性能高、可扩展、可靠、还很安全。我们可以先在本地安装一个 Redis 来试试它的实用性：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/26bbaaf23f1049f5a776f5a36accfef1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=688&h=262&s=37748&e=png&b=0e2b35)

我们启动了一个`Redis`服务器，你可以看到我使用了`redis-cli -h ::1`（当然也可以使用 IPv4 地址）命令，连接到了 IPv6 本地地址。`分布式存储环境`已经有了，我们只需要将`Session 存储`切换到`Redis`就好啦！

我们来看下这块的关键代码：

       public class RedisSessionManager {
             JedisPool jedisPool = new JedisPool(new JedisPoolConfig(), "::1", 6379);
            Jedis jedis = jedisPool.getResource();
    
            public  Session createSession(String username, int expirationTime) {
                String sessionId = UUID.randomUUID().toString();
                Session session = new Session(sessionId, username, expirationTime);
                //将session存储到redis,并且设置过期时间
                jedis.set(sessionId,JSON.toJSONString(session));
                jedis.pexpire(sessionId,expirationTime*1000);
                return session;
            }
            public  Session getSession(String sessionId) {
                String s = jedis.get(sessionId);
                if (s != null) {
                    return JSON.parseObject(s, Session.class);
                } else {
                    return null;
                }
        }
    

引入的代码也非常简单，我们使用 Redis 客户端`jedis` 将`Session`存储到`Redis`中，并将`Redis 的 key`过期时间设置为我们期望的时间。这样，我们就实现了一个`RedisSessionManager`。

通过访问 [http://localhost:8081/redisSession](http://localhost:8081/redisSession "http://localhost:8081/redisSession") 页面，我们可以看到以下结果：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fdc8bf42a9a942ccaaf47c3a7fd9e16e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=3560&h=460&s=373681&e=png&b=232427)

此时，我们可以通过在`Redis`中执行`keys *`命令来查看存储的 key。如上所示，我们可以看到一个`cf9fb4b8-87b3-403e-98d7-95dd9faae437`的 key，这刚好就是浏览器中显示的 cookie 的值，这表明 Session 确实被存储在 Redis 中了。

    [::1]:6379> keys *
    
    1. "cf9fb4b8-87b3-403e-98d7-95dd9faae437"
    

值得一提的是，即使我们的服务因为某些原因异常并重启，这也不会影响下一次用户登录，因为`Session`已经被`安全地存储在 Redis`中，而不是单独存在于服务的内存中。

另外，如果我们的服务是多机部署的，也不会再出现需要多次登录的情况。只要 Session 信息都存储在 Redis 里面，不管请求被发送到哪台服务器，它们都是使用唯一的身份信息。

所以，`Redis Session`不仅保证了`Session`的可靠性和持久性，还提高了系统的可扩展性和容错性。

再说环境部署
======

以上四个实验都已经在我的服务器环境中部署完毕，分别对应以下网址：

*   [cookie.yuangui.info/](http://cookie.yuangui.info/ "http://cookie.yuangui.info/")
    
*   [cookie.yuangui.info/admin](http://cookie.yuangui.info/admin "http://cookie.yuangui.info/admin")
    
*   [cookie.yuangui.info/myession](http://cookie.yuangui.info/myession "http://cookie.yuangui.info/myession")
    
*   [cookie.yuangui.info/redisSessio…](http://cookie.yuangui.info/redisSession "http://cookie.yuangui.info/redisSession")
    

这些实验都是基于之前的容器部署完成的，相关代码可以在 [github.com/yinwuzhe/lo…](https://github.com/yinwuzhe/login-design "https://github.com/yinwuzhe/login-design") 中找到。如果想要尝试这些实验，只需要使用以下命令拉取代码并部署即可：

    #  docker run -it --net=host  ksimple/java8-mvn-nodejs-npm-python3 bash --name cookie
    # git clone https://github.com/yinwuzhe/login-design
    # cd login-design/cookie-session
    /login-design/cookie-session# mvn clean package
    /login-design/cookie-session# nohup java -jar target/cookie-1.0-SNAPSHOT.jar &
    

此外，在`CentOS 7`系统上，也可以使用以下命令来安装并`启动 redis`：

    yum install redis
        systemctl start redis
        systemctl enable redis
    

总结
==

这篇文章探讨了如何用`cookie 和 session`打造一个可用的`HTTP 登录应用程序`。

首先我们研究了成熟的语言框架的 Session 设计，之后从设置`最简单的 cookie`开始逐步探究，甚至`亲自伪造 cookie`攻击自己，证明了`仅靠 cookie`是不够安全的。于是，我们亲自尝试实现了更加完备的`session`设计，并且大胆尝试扩展支持了`Redis Session`。

尽管登录系统的设计已经经过反复讨论，但是仍然需要考虑更复杂的场景。其中一个例子就是`单点登录（SSO）系统`，它提供了一种便利的方式让用户只需要进行一次身份验证，就可以在多个应用程序或系统中访问受保护的资源，无需再次输入用户名和密码。

如何实现`SSO 系统`呢？在下一篇文章中，我们将继续探讨许多小公司或大公司所采用的 SSO 系统的设计和架构。