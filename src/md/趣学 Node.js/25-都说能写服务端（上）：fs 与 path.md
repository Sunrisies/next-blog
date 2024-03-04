我们回到本小册的第一章开篇，看看有这么句话：**JavaScript** **性能开始有了质的飞跃，自然就有人瞄上了服务端领域**。那么，有哪些是写服务端（FaaS + BaaS 架构除外）时使用频率比较高的功能呢？

文件系统肯定是一个比较重要的功能，大家要读写临时文件，甚至要写文件到某个目录（对象存储出现之前）已做存储等等。尤其是 Node.js 本身在 `require` 加载模块的时候，就是靠着 `fs` 文件系统去读取源码文件。所以 `fs` 是 Node.js v0.0.2 版本时就存在的伴生模块。有了文件系统相关模块，自然就需要有内置模块去对文件路径进行解析、运算，于是 `path` 也是一个比较重要的模块。

`fs`
----

### 文件系统先序知识

先前有同学反馈，在文章中莫名其妙就蹦出一些新的名词。所以本章中，稍微提一下。若已了解，则可略过（那就没剩什么了）。

#### 文件描述符（File Descriptor，FD）

在操作系统中，文件描述符（File Descriptor，简称 FD）是一个非常重要的概念。它是一个用于访问文件或其它输入 / 输出资源（如管道 Pipe、网络套接字 Socket）的抽象标识符。在 Unix-like 系统（包括 Linux 和 macOS）中，文件描述符通常是一个非负整数。

> Unix 文件类型可参阅：[en.wikipedia.org/wiki/Unix\_f…](https://en.wikipedia.org/wiki/Unix_file_types "https://en.wikipedia.org/wiki/Unix_file_types") 。

粗暴来说，它就是个编号。每个进程中，每打开一个文件或其它资源，就给它分配一个编号，下次用这个编号就代表是相应的资源。

在 Unix-like 系统中，程序启动时通常有三个预定义的文件描述符：`0` 是标准输入（`stdin`），`1` 是标准输出（`stdout`），`2` 是标准错误输出（`stderr`）。一旦你有了文件描述符，你可以使用例如 `read` 和 `write` 的系统调用来读取和写入文件。比如，如果往 `1` 进行 `write`，则表示往屏幕终端输出内容。

尽管我们通常谈论将文件描述符用于文件，但它们也可以用于其他类型的资源。例如，在网络编程中，当你创建一个套接字时，它也会关联一个文件描述符。

在 Windows 系统中，概念类似但有一些差异。Windows 使用“句柄”而不是“文件描述符”来表示资源，例如文件和套接字，而且 Windows 的 API 不同于 Unix-like 系统。不过，本小册就不继续探究 Windows 下的这些概念了。

#### 打开文件

当程序通过调用操作系统提供的 `open` 函数打开一个文件时，操作系统将分配一个文件描述符来表示这个文件。`open` 函数返回这个文件描述符。例如，在 C 语言中，可以这样使用 `open` 函数：

    int fd = open("example.txt", O_RDONLY);
    

这段代码打开一个名为 `example.txt` 的文件以进行读取，并返回一个文件描述符。也就是说，如果某进程有很多文件被打开了，那么 `250` 就有可能是其中一个 FD。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/169f1c8bb53f48fd96892b7876b792fd~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=36018&e=png&b=fcfcfc)

#### 关闭文件

通过文件描述符使用文件时，一旦完成操作，应使用 `close` 函数关闭文件描述符。这是必要的，因为操作系统通常限制每个进程可以同时打开的文件描述符的数量。关闭文件描述符可以释放资源。

    close(fd);
    

这段代码关闭了之前打开的文件描述符。

#### 乱入：奶茶店🧋

这个关联就好比在奶茶店，你点了个榴莲海盐椰椰，奶茶店小姐姐给你打了个单，上面有个编号——`250`。榴莲海盐椰椰相当于文件路径，这个编号就是文件描述符。之后再做奶茶、取奶茶的时候就直接用 `250` 就好了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c56891a523c2453195e8dc6af0265135~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=560&h=560&s=192857&e=png&b=fdfcfc)

TWO...THOUSAND...YEARS...LATER

**小姐姐：** 250 好了，250。

**我：**

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e1bb92b969048d38212d610c716aa54~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=220&h=229&s=50002&e=png&b=f1eceb)

#### 万物皆文件

在 Linux 世界中，有一个神奇的理念，那就是“万物皆文件”。这句话听起来有点像魔法咒语，但当我们拨开神秘的面纱，深入了解它，你就会发现它的强大和优雅。

在 Linux 中，不仅普通的文本文件和图片是文件，设备如打印机、硬盘，以及网络连接和进程等都被视为文件。这意味着你可以像操作普通文件一样操作这些东西。

想象一下，硬盘驱动器就像是一个巨大的文件柜，你打开一个抽屉（文件），在里面写下一些信息（写入数据），然后关上它。而当你需要这些信息时，你只需打开抽屉并读取它。

再来一个例子，想象你的鼠标就像是一本神奇的日记。每当你移动鼠标或点击按钮时，日记中就会写下一些字。在 Linux 中，你的程序可以读取这本日记（作为文件），就像读取普通的文本文件一样，来了解鼠标的活动。

> 在 Linux 系统中，鼠标通常可以通过 `/dev/input` 目录下的设备文件进行访问。这些设备文件通常命名为 `mouseX` 或 `eventX`，其中 `X` 是一个数字。
> 
> 要打开鼠标的文件描述符，你可以使用标准的 `open` 系统调用。下面是一个简单的示例代码，演示如何在 C 语言中打开一个鼠标设备的文件描述符：
> 
>     #include <fcntl.h>
>     #include <unistd.h>
>     #include <stdio.h>
>     
>     int main() {
>         int fd = open("/dev/input/mouse0", O_RDONLY);
>         
>         if (fd < 0) {
>             perror("Failed to open mouse");
>             return 1;
>         }
>         
>         printf("Mouse opened successfully with file descriptor: %d\n", fd);
>         
>         // Remember to close the file descriptor when done
>         close(fd);
>         
>         return 0;
>     }
>     
> 
> 在这个示例中，我们试图打开 `/dev/input/mouse0`。如果打开成功，文件描述符将是一个非负整数，我们需要记住在完成操作后关闭它。
> 
> **看吧，这打开也是个“文件描述符”——万物皆奶茶。**
> 
> ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2b952e007b14450c8ae4b9cbb8981e19~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=792&h=414&s=202475&e=png&b=f5f1f0)
> 
> 拿错了，万物皆文件。
> 
> ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1402b78185d4fb38b10a9cde96e062e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=240&h=240&s=21722&e=png&a=1&b=f7f7f7)
> 
> 如果你打算读取鼠标的事件数据并对其进行解析，你可能会发现打开 `/dev/input/eventX` 更有用，因为它提供了更丰富的信息。不过，解析从这些设备文件中读取的原始数据可能是复杂的，并且需要对 Linux 输入子系统有深入的了解。
> 
> `/dev/input/mouse0` 这类文件并不是普通的文件，它们是“设备文件”。这就是 Linux 中“万物皆文件”哲学的一个例子。
> 
> 在 Linux 系统中，设备通常通过特殊的设备文件来表示，这些设备文件位于 `/dev` 目录下。这些设备文件允许用户空间的程序以文件的形式与硬件设备进行交互，但实际上它们并不代表磁盘上的实际文件。当你对这些设备文件执行 I/O 操作时，你实际上是在与驱动程序通信，而驱动程序负责管理底层的硬件设备。
> 
> 这是通过使用相同的系统调用（如 `open`, `read`, `write`, `close` 等）来统一不同类型的资源的一个强大方式。对程序员来说，不需要学习一套新的 API 来处理设备；它们可以像处理普通文件一样处理设备。
> 
> “文件”可以是一个真实的文件，也可以是一个管道、网络套接字、设备文件或其他类型的资源。通过使用文件描述符，Linux 可以提供一种一致的接口来管理各种不同类型的资源。

甚至网络通信也可以被视为文件。想象一下，你和远方的朋友通过两个神奇的信箱进行通信。你在一个信箱里放一封信（写入数据），然后朋友在另一个信箱里回复。在 Linux 中，这两个信箱就是文件，你可以通过读写这些文件来进行网络通信。

通过将一切视为文件，Linux 把世界简化成了一种统一、简洁的模型。这不仅使得编程变得简单，还允许各种资源和数据以一种高度一致和可预测的方式交互。

就像一位魔法师用同一根魔杖施展各种魔法，Linux 里的“万物皆文件”让你用同样的工具和技术掌控着一个丰富多彩的数字世界。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ae69043980db48208a2770b21b3aa80e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=69794&e=png&b=faf7f7)

##### 回忆一下

让我们回忆一下[第 16 章](https://juejin.cn/book/7196627546253819916/section/7217621247163629601 "https://juejin.cn/book/7196627546253819916/section/7217621247163629601")，Node.js 是如何获取 CPU 信息、uptime 等内容的？都是在底层通过读取 `/proc/stat`、`/proc/cpuinfo`、`/sys/devices/system/cpu/cpu<编号>/cpufreq/scaling_cur_freq`、`/proc/meminfo` 等文件来搞定的。实际上这些文件并不是“真实存在的文件”。

`/proc` 文件系统是 Linux 系统中的一种特殊文件系统，通常被称为 procfs。它不占用磁盘空间，而是作为内核和用户空间之间的一个接口。通过 `/proc` 文件系统，内核将一些系统和进程信息以文件的形式暴露给用户空间。当你读取 `/proc/stat` 文件时，你实际上是在查询系统的当前状态。这些数据是实时生成的，而不是存储在磁盘上的。

这就是为什么当你查看 `/proc` 下的文件时，它们通常显示为 `0` 字节大小，但当你实际读取它们时，它们包含有用的信息。因为这些数据是动态生成的，不占用任何磁盘空间。

`/sys` 同样不是真实的磁盘文件，它是 sysfs，与 `/proc` 文件系统类似，sysfs 也是一种虚拟文件系统。它是 Linux 内核的一个特性，提供了一种将内核对象、属性和配置选项以文件系统层次结构的方式呈现给用户空间的机制。sysfs 通常挂载在 `/sys` 目录下。

当你读取 `/sys/devices/system/cpu/cpu<编号>/cpufreq/scaling_cur_freq` 时，你实际上是在查询 CPU 的当前运行频率。这个信息是动态生成的，直接来自内核，而不是存储在磁盘上的。

> Linux 内核（Linux Kernel）是 Linux 操作系统的核心组件。它是一个开源的操作系统内核，负责管理系统的硬件资源，同时为运行在系统上的应用程序提供服务和接口。Linux 内核最早是由 Linus Torvalds 在 1991 年开发的，至今仍在积极开发和维护中。
> 
> 内核是操作系统的心脏，它管理着计算机的硬件资源，包括 CPU、内存、存储设备和外围设备，并为运行在操作系统上的应用程序提供一系列服务。里面包含了：进程调度、内存管理、文件系统、网络、设备驱动、系统调用接口、安全和权限管理、模块化和可扩展性、多架构支持、虚拟化等内容。

### libuv 之文件系统

Node.js 中的文件系统 API 靠的是 libuv 完成的，走的依然是 libuv 的事件循环来达到异步操作的目的。`libuv` 提供了一系列的文件系统相关的函数，这些函数允许你以异步的方式对文件和目录进行操作。以下是 `libuv` 的一些主要 `fs` 相关函数的简要介绍：

1.  `uv_fs_open()`：用于打开文件。需要指定文件路径，打开模式和权限。一旦文件被打开，将调用回调函数。
    
2.  `uv_fs_close()`：用于关闭先前打开的文件。这是一个简单的操作，通常在你完成文件操作后使用。
    
3.  `uv_fs_read()`：用于从打开的文件中读取数据。你需要指定要读取的文件、缓冲区以及一些其他参数，例如偏移量。
    
4.  `uv_fs_write()`：用于将数据写入已打开的文件。你需要提供要写入的文件、包含数据的缓冲区和其他参数。
    
5.  `uv_fs_unlink()`：删除一个文件。
    
6.  `uv_fs_mkdir()`：创建一个新目录。需要指定目录路径和权限。
    
7.  `uv_fs_rmdir()`：删除一个目录。
    
8.  `uv_fs_readdir()`：读取目录的内容。可以用来列出目录中的文件和子目录。
    
9.  `uv_fs_stat()` 和 `uv_fs_lstat()`：获取文件或目录的信息，如大小、创建时间等。`uv_fs_lstat()`用于符号链接本身，而`uv_fs_stat()`用于符号链接指向的文件或目录。
    
10.  `uv_fs_rename()`：重命名文件或目录。
    
11.  `uv_fs_sendfile()`：高效地将一个文件的内容发送到另一个文件描述符。通常用于文件复制。
    
12.  `uv_fs_ftruncate()`：截断或扩展指定的文件，使其达到指定的大小。
    
13.  `uv_fs_copyfile()`：复制文件。允许指定复制过程中的标志，如是否覆盖已存在的文件。
    
14.  `uv_fs_chmod()` 和 `uv_fs_fchmod()`：改变文件的权限。`uv_fs_fchmod()`作用于通过文件描述符指定的文件，而`uv_fs_chmod()`作用于路径指定的文件。
    
15.  `uv_fs_utime()` 和 `uv_fs_futime()`：改变文件的访问和修改时间戳。
    

这些函数通常以异步方式工作，当你调用这些函数时，它们会立即返回，并在操作完成时调用一个回调函数。然而，`libuv`也提供了这些函数的同步版本，它们的名称通常以 `_sync` 结尾，例如 `uv_fs_open_sync()`，同步版本在操作完成之前不会返回。

#### `uv_fs_open()`

在 libuv 中，`uv_fs_open` 函数用于异步地打开文件。由于它是异步的，你不能立即获取打开的文件，而需要通过回调函数来处理。

下面是如何使用 `uv_fs_open` 的一个基本示例。

首先定义一个用于文件打开后的回调函数 `on_open`：

    void on_open(uv_fs_t* req) {
    

里面传进来的 `req` 是一个 `uv_fs_t` 的指针，该参数中的 `result` 若为 `-1` 则说明打开失败，否则代表打开的文件描述符。

        // 检查是否有错误发生
        if (req->result < 0) {
            fprintf(stderr, "Open error: %s\n", uv_strerror((int)req->result));
        } else {
            // req->result 包含打开的文件描述符
            int file_descriptor = req->result;
            printf("File opened with descriptor %d\n", file_descriptor);
        }
        
        // 一旦我们处理完请求，我们需要释放它
        uv_fs_req_cleanup(req);
      }
    

然后在主函数中初始化一个 libuv 的事件循环：

    int main() {
        uv_loop_t* loop = uv_default_loop();
    

通过 `uv_fs_open()` 来打开文件，路径为 `example.txt`，打开标识为 `O_RDONLY`，回调函数为 `on_open`。

        uv_fs_t open_req;
        // 参数分别是：loop, 请求, 回调, 文件路径, 打开的标志, 权限
        uv_fs_open(loop, &open_req, "example.txt", O_RDONLY, 0, on_open);
    

到目前为止，“文件打开”的“动作”就执行完毕了。但是文件最终被打开后的结果尚未被触发，因为它只会在事件循环的 Poll for I/O 阶段被触发，而目前为止我们尚未执行事件循环。所以我们需要执行事件循环来让后续的事件可以被触发。

        // 运行事件循环，这将使异步操作执行
        uv_run(loop, UV_RUN_DEFAULT);
    

最后，退出程序。

        return 0;
    }
    

上面就是一个 libuv 中最简单地异步打开某个文件描述符的代码。当这段代码的类似代码嵌入 Node.js 中，就有了下图的这种效果：

![26流程图1.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2b5035199b4a429a962629e2e77bd918~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1070&h=526&s=107045&e=png&b=fefefe)

> `uv_fs_t` 是 libuv 中用于表示文件系统操作的结构体。该结构体存储了与一个特定文件系统操作相关的信息。当你使用 libuv 的异步文件系统 API（如 `uv_fs_open`，`uv_fs_read` 等）时，通常需要传递一个 `uv_fs_t` 类型的变量。此结构体在操作完成时存储结果，并传递给相应的回调函数。其中最重要的是 `result` 字段，这个字段包含了操作的结果。
> 
> 该 `result` 为负时通常代表错误，针对不同的 API，`result` 含义也不同。如 `uv_fs_open` 的 `result` 代表打开的文件描述符；`uv_fs_read`、`uv_fs_write` 的 `result` 代表读取、写入的字节数；`uv_fs_readdir` 的 `result` 代表读取的文件目录数；`uv_fs_close`、`uv_fs_stat`、`uv_fs_fstat`、`uv_fs_lstat`、`uv_fs_unlink`、`uv_fs_mkdir`、`uv_fs_rmdir`、`uv_fs_rename` 等 API 的 `result` 则代表成功与否，`0` 为成功。

#### `uv_fs_close()`

`uv_fs_close()` 为关闭文件描述符。我们修改一下上面的代码，在打开文件描述符后马上异步关闭它。首先定义一个关闭的回调函数。

    void on_close(uv_fs_t* req) {
        // 检查是否有错误发生
        if (req->result < 0) {
            fprintf(stderr, "Close error: %s\n", uv_strerror((int)req->result));
        } else {
            printf("File successfully closed\n");
        }
    
        // 清理请求
        uv_fs_req_cleanup(req);
    }
    

然后就是刚才写的 `on_open` 函数了。

    void on_open(uv_fs_t* req) {
        // 检查是否有错误发生
        if (req->result < 0) {
            fprintf(stderr, "Open error: %s\n", uv_strerror((int)req->result));
        } else {
            // req->result 包含打开的文件描述符
            int file_descriptor = req->result;
            printf("File opened with descriptor %d\n", file_descriptor);
    

注意在这里，我们马上通过 `uv_fs_close` 来关闭，其中传的参数就是文件描述符和 `on_close`。

            // 启动关闭操作
            uv_fs_t close_req;
            uv_fs_close(req->loop, &close_req, file_descriptor, on_close);
        }
        
        // 清理打开请求
        uv_fs_req_cleanup(req);
    }
    

这就完成了关闭操作。上面的图也可以改一下了。

![26流程图2.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c25ea47dc4344573802a54a29e2fa7fd~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1114&h=406&s=109812&e=png&b=fefefe)

#### 文件读写

在 libuv 中，你首先需要使用 `uv_fs_open` 打开一个文件，并获取一个文件描述符。然后，你可以使用 `uv_fs_read` 来读取文件，或使用 `uv_fs_write` 来写入文件。

我们简单理一下流程：打开→读取→关闭。相当于只要在 `on_open` 里面做读取操作，在读取的回调函数里面做关闭操作即可。

    char buffer[1024];
    
    void on_close(uv_fs_t* req) {
        if (req->result < 0) {
            fprintf(stderr, "Close error: %s\n", uv_strerror(req->result));
        }
        uv_fs_req_cleanup(req);
    }
    
    void on_open(uv_fs_t* req) {
        if (req->result < 0) {
            fprintf(stderr, "Open error: %s\n", uv_strerror(req->result));
        } else {
    

在读取文件的时候，我们通过 `buffer` 来创建一个 libuv 能识别的缓冲区。

            // 读取文件
            uv_fs_t read_req;
            uv_buf_t iov = uv_buf_init(buffer, sizeof(buffer));
    

最后，通过 `uv_fs_read` 来读取文件内容。

            uv_fs_read(req->loop, &read_req, req->result, &iov, 1, -1, on_read);
        }
        uv_fs_req_cleanup(req);
    }
    

如此一来，还缺一个读取文件的 `on_read`。

    void on_read(uv_fs_t* req) {
    

如果 `result` 小于 `0` 则代表失败。

        if (req->result < 0) {
            fprintf(stderr, "Read error: %s\n", uv_strerror(req->result));
    

否则，则代表读取内容的长度。

        } else if (req->result > 0) {
            // 输出读取到的数据
            buffer[req->result] = '\0';
            printf("Read: %s\n", buffer);
    

读完输出后，我们执行关闭文件描述符操作。

            // 关闭文件
            uv_fs_t close_req;
            uv_fs_close(req->loop, &close_req, req->file, on_close);
        }
        uv_fs_req_cleanup(req);
    }
    

写文件过程与上方类似，使用 `uv_fs_write` 函数即可。你需要传递一个包含要写入的数据的缓冲区，以及一个回调函数来处理写操作的完成。

![26流程图3.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7e62fba7c0334556a5f8b87b3be8e127~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1096&h=322&s=112949&e=png&b=fefefe)

### Node.js 中的 `fs`

Node.js 中的 `fs` 实际上是对于上面所说的 libuv 的 API 的各种封装。封装起来有些抽象，类套来套去，源码解析有些麻烦，就不详细解析到最底层了。

#### 对于 libuv 的封装

在 Node.js 中的 C++ 侧，实现了一个叫 `FSReqCallback` 的类，它是对于 `uv_fs_t` 的一个封装。一个 `FSReqCallback` 对象中就封装了一个 `uv_fs_t` 变量，用于传递给 `uv_fs_*` 函数，除此之外，还存了一些其它有用的信息。

该类的实例中，有两个比较重要的字段：`context` 和 `oncomplete`。前者为此次操作的一些上下文，内含类似文件描述符、文件大小、偏移量等内容；后者则是整个操作结束后，C++ 侧回调函数来调用的 JavaScript 函数，这样就可以在事件循环的 Poll I/O 阶段中从事件中调用回到 JavaScript 代码中。

比如我们看一下 `readFile` 这个函数，首先是一些简单的参数操作：

    function readFile(path, options, callback) {
      callback = maybeCallback(callback || options);
      options = getOptions(options, { flag: 'r' });
    

然后为此次读文件新建一个上下文。“读文件”的上下文为一个 `ReadFileContext` 类的实例。

      const context = new ReadFileContext(callback, options.encoding);
      context.isUserFd = isFd(path); // File descriptor ownership
    

> 至于 `ReadFileContext` 中都有什么内容，有兴趣的读者可自行去[翻看源码](https://github.com/nodejs/node/blob/v18.16.1/lib/internal/fs/read_file_context.js#L71 "https://github.com/nodejs/node/blob/v18.16.1/lib/internal/fs/read_file_context.js#L71")。

然后是对 `context` 的一系列赋值等操作（不重要）。

      if (options.signal) {
        context.signal = options.signal;
      }
      if (context.isUserFd) {
        process.nextTick(function tick(context) {
          ReflectApply(readFileAfterOpen, { context }, [null, path]);
        }, context);
        return;
      }
    
      if (checkAborted(options.signal, callback))
        return;
    

处理参数。

      const flagsNumber = stringToFlags(options.flag, 'options.flag');
      path = getValidatedPath(path);
    

构造一个 `FSReqCallback` 并赋值上 `context` 与 `oncomplete`。

      const req = new FSReqCallback();
      req.context = context;
      req.oncomplete = readFileAfterOpen;
    

带着这些信息去调用 C++ 侧封装 libuv 的 `open` 函数。

      binding.open(pathModule.toNamespacedPath(path),
                   flagsNumber,
                   0o666,
                   req);
      }
    

这里面值得讲的有两个内容，一个是 `open` 函数是如何的；另一个是 `readFileAfterOpen` 这个 `oncomplete` 函数是如何的。

`open` 函数就是对 `uv_fs_open()` 的一个封装，只不过在代码层面抽象得可以与其它一些文件系统函数复用大部分代码。有兴趣可自行翻阅 [Node.js 源码](https://github.com/nodejs/node/blob/v18.16.1/src/node_file.cc#L1897-L1929 "https://github.com/nodejs/node/blob/v18.16.1/src/node_file.cc#L1897-L1929")。在 `open` 函数中，如果打开完毕，在事件循环的 Poll I/O 阶段会调用 `uv_fs_open()` 的回调函数，而这个回调函数则会进一步调用 `req.oncomplete`，也就是 [readFileAfterOpen](https://github.com/nodejs/node/blob/v18.16.1/lib/fs.js#L321-L335 "https://github.com/nodejs/node/blob/v18.16.1/lib/fs.js#L321-L335")。顾名思义，“在打开文件后，读取文件”。

    function readFileAfterOpen(err, fd) {
      const context = this.context;
    
      if (err) {
        context.callback(err);
        return;
      }
    
      context.fd = fd;
    
      const req = new FSReqCallback();
      req.oncomplete = readFileAfterStat;
      req.context = context;
      binding.fstat(fd, false, req);
    }
    

思路也很清晰，拿着这个上下文，把刚打开的 `fd` 给赋值上，然后新建一个 `FSReqCallback`，去调用 `fstat` 以获取一些必要信息（如文件大小），并在完成后调用 `readFileAfterStat`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c5b595abe5754180a3803b0dbbe08fd7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=31582&e=png&b=fefcfc)

这里的 `fstat` 同样是高度抽象和复用的 libuv 函数的封装。大部分抽象代码与 `open` 一致。然后就又转到了 `readFileAfterStat`。

    function readFileAfterStat(err, stats) {
      const context = this.context;
    
      if (err)
        return context.close(err);
    
      const size = context.size = isFileType(stats, S_IFREG) ? stats[8] : 0;
    
      if (size > kIoMaxLength) {
        err = new ERR_FS_FILE_TOO_LARGE(size);
        return context.close(err);
      }
    
      try {
        if (size === 0) {
          context.buffers = [];
        } else {
          context.buffer = Buffer.allocUnsafeSlow(size);
        }
      } catch (err) {
        return context.close(err);
      }
      context.read();
    }
    

这回就真的是读文件了。拿到文件大小 `size` 后，为 `context` 赋值上一个相应大小的 `Buffer`，然后开始执行 `context.read()`——真正读取文件的逻辑。

    class ReadFileContext {
      ...
    
      read() {
        let buffer;
        let offset;
        let length;
    
        if (this.signal?.aborted) {
          return this.close(
            new AbortError(undefined, { cause: this.signal?.reason }));
        }
        if (this.size === 0) {
          buffer = Buffer.allocUnsafeSlow(kReadFileUnknownBufferLength);
          offset = 0;
          length = kReadFileUnknownBufferLength;
          this.buffer = buffer;
        } else {
          buffer = this.buffer;
          offset = this.pos;
          length = MathMin(kReadFileBufferLength, this.size - this.pos);
        }
    
        const req = new FSReqCallback();
        req.oncomplete = readFileAfterRead;
        req.context = this;
    
        read(this.fd, buffer, offset, length, -1, req);
      }
    }
    

在 `read` 中，前面的代码无非是处理 `Buffer`、长度、偏移量等操作。到最后一样是新建一个 `FSReqCallback`，并把上下文和 `oncomplete` 塞进去，最终执行封装好 `uv_fs_read()` 的 `read()` 进行异步文件读取。当读取完毕之后，会调用 `req.oncomplete`，也就是 `readFileAfterRead()`。

这里面要注意的是，读取的长度是 `kReadFileUnknownBufferLength` 或者最大 `kReadFileBufferLength`。也就是说，如果我们文件大小超过了 `kReadFileBufferLength`，那么我们就分批读取，每次最多读 `kReadFileBufferLength` 字节。在 Node.js 中，`kReadFileBufferLength` 为 `512 * 1024` 字节，也就是 512K。若文件超过半兆，会被分批读取。这就是 `readFileAfterRead` 的作用，如果该回调函数中发现文件没读完，则做好一系列的合法性验证登操作后，重新执行一遍 `context.read()` 去读取下一批内容，直到读取完毕关闭文件描述符。

这就意味着，如果文件很大，则光在读取的过程中就可能需要经历好多个 Tick 有读取事件才能完成。

所以整个流程如下：

![26流程图4.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b2aef507b1e94aebb09bd7546dda1260~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1998&h=588&s=151197&e=png&b=fefcfc)

每次经过一次 `uv_fs_*` 都至少经过一次 [Node.js 的 Tick](https://juejin.cn/book/7196627546253819916/section/7197301896355250215 "https://juejin.cn/book/7196627546253819916/section/7197301896355250215")。

> 其它 `fs` 操作也都大同小异，有些更简单，有些更复杂。但大多底层都是靠对 libuv 中 `uv_fs_*` 函数的封装以及 `FSReqCallback` 来完成的。

`path`
------

既然有文件系统的操作，就自然需要有对文件路径的计算。为什么说 `path` 这么重要呢，让我们回过头来看看上面的 `fs.readFile()`，里面有一句这个：

    path = getValidatedPath(path);
    

这段代码就是对传进来的文件路径进行处理、合法化。其中这个文件路径可以是一个 `URL` 对象，在里面也做了一些转换；其也可以是一个赤裸裸的文件路径字符串，同样也做了转换。最终通过一个叫 `possiblyTransformPath()` 的函数把它转变为需要传给 libuv 的路径。它大概长这样（代码为了可读性，做了一些修改）：

    function possiblyTransformPath(filename) {
      if (typeof filename === 'string' && !path.isAbsolute(filename)) {
        return path.resolve(filename);
      }
      return filename;
    }
    

逻辑很简单，若该路径不是一个绝对路径，则对其进行 `path.resolve()` 从而变成一个绝对路径。

> The `path.resolve()` method resolves a sequence of paths or path segments into an absolute path.

这个函数中，若所有参数拼到最后还没有拼成一个绝对路径，那么会再讲结果跟当前工作路径（current working directory）拼接成绝对路径。所以 `path.resolve(filename)` 的意思是拿 `filename` 跟当前工作路径进行拼接。如当前路径是 `/foo`，`filename` 是 `bar`，那么结果就是 `/foo/bar`；如果 `filename` 是 `../bar`，那么结果就是 `/bar`。

看吧，随便抓一个函数，里面就要对路径进行操作。`fs` 跟 `path` 真的是分不开的。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ffd471630930431bab51de5c2374a4b0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=225&h=225&s=18918&e=png&b=fefefe)

`path` 中都是一些字符串的操作，用于计算的。所以都是纯 JavaScript 的代码。

### Windows 与 POSIX

Windows 与 POSIX 下的文件路径形式不一样。

> POSIX，全称为“Portable Operating System Interface”，是一系列标准，旨在确保不同的操作系统之间的兼容性。这些标准定义了操作系统应提供的各种接口和行为，包括但不限于文件处理、进程控制、线程和同步、以及基本的系统服务。
> 
> POSIX 标准起源于上个世纪 80 年代，当时 UNIX 操作系统的流行导致出现了多个不同的 UNIX 变体。这些变体之间的差异使得在一个 UNIX 系统上开发的软件很难移植到另一个 UNIX 系统。为了解决这个问题，POSIX 标准被开发出来，目的是为 UNIX 以及类 UNIX 系统（如 Linux）提供一套共同的应用程序编程接口。
> 
> 这让我想起了各种国产“兼容乐高”的积木——也是差不多道理吧。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2b7f51e9441148adb49ac413b17956f2~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=350&h=350&s=179138&e=png&b=f4e7e3)

Windows 和 POSIX 系统（如 Linux 和 Unix）在文件路径的表示和使用上有一些显著的差异：

1.  路径分隔符：
    
    *   在 POSIX 系统中，路径分隔符是正斜杠 (`/`)。例如：`/usr/local/bin`；
    *   在 Windows 中，路径分隔符是反斜杠 (`\`)。例如：`C:\Windows\System32`。不过，现代的 Windows API 通常也接受正斜杠作为路径分隔符；
2.  根目录：
    
    *   POSIX 系统有一个单一的根目录，即 `/`，所有的文件和目录都是这个根目录的子项；
    *   Windows 有一个分层的文件系统，每个驱动器（如 C 盘，D 盘等）有自己的根目录（如 `C:\`，`D:\`）；
3.  大小写敏感性：
    
    *   POSIX 文件路径通常是大小写敏感的。因此，`/folder/File` 和 `/folder/file` 是两个不同的路径；
    
    > **小插曲：** 我高中时候去绍兴 OI 比赛时，跟同往比赛的发小住同一间房间。当时刚接触到 Ubuntu 系统，并从官方申请了一张免费的 CD 安装盘，心心念念。日有所思夜有所想，在梦乡里睡正熟被发小叫醒，迷糊间脱口而出的第一句话就是“还要区分大小写呢”。
    
    *   Windows 的文件路径通常是大小写不敏感的。因此，`C:\folder\File` 和 `C:\folder\file` 通常被视为相同的路径；
4.  特殊字符：
    
    *   POSIX 允许文件名中使用几乎所有字符，只有正斜杠（用作路径分隔符）和空字符是不允许的；
    *   Windows 有一组保留字符，不能用于文件名，包括 `<`、`>`、`:`、`"`、`/`、`\`、`|`、`?` 和 `*`；
5.  相对路径与绝对路径：
    
    *   在 POSIX 中，如果路径以正斜杠开头，它是绝对的；否则，它是相对于当前工作目录的；
        
    *   在 Windows 中，如果路径以盘符开头（如 `C:`），它是绝对的；否则，它是相对的。还有更复杂的规则，涉及到 UNC 路径和其他因素。
        

在 Node.js 中，`path` 也根据操作系统不同，会有不一样的行为。但是有些也没有体现出来，如大小写敏感性、特殊字符等。

Node.js 实现了两套逻辑，跨平台也能使用对方平台的逻辑。比如 Windows 平台可以使用 POSIX 的 `path` 逻辑，反之亦然。因为 Node.js 的 `path` 中有着以下的字段：

*   `path.posix`；
*   `path.windows`。

这两个字段中的 API 接口都是一样的，只是内在行为不一样。其行为与其字段（Windows 或 POSIX）相符。也就是说如果我们用 `path.windows.resolve()`，则走的是 Windows 的逻辑，而 `path.posix.resolve()` 则用的 POSIX 的逻辑。

至于 `path` 的默认导出，则是视当前系统是什么，而选用该系统所应该使用的逻辑。其导出类似下面的逻辑：

    const platformIsWin32 = (process.platform === 'win32');
    
    const win32 = {
      ...Window 的 API 们
    };
    
    const posix = {
      ...POSIX 的 API 们
    };
    
    posix.win32 = win32.win32 = win32;
    posix.posix = win32.posix = posix;
    
    module.exports = platformIsWin32 ? win32 : posix;
    

第一行先根据 `process.platform` 判断当前是否 `'win32'`。然后在接下来 N 行中，各自实现 Windows 与 POSIX 下的 API 逻辑。下一步就是把 `win32` 这个对象分别赋值给 `posix.win32` 和 `win32.win32`，`posix` 赋值给 `posix.posix` 和 `win32.posix`。最后，再根据第一行的判断导出相应的对象。

### 举例：`path.join()`

篇幅关系，这里就只举一个 POSIX 下 `join()` 的例子，且不深究它们各自再调用进去的函数。更多的函数大家可自行翻阅 Node.js 源码，都是些纯字符串和路径规则的计算，比较容易看懂。

首先，若没有参数，则直接返回 `'.'`。

    const posix = {
      ...,
      join(...args) {
        if (args.length === 0)
          return '.';
    

然后逐个开始拼接，拼接过程中以 `/` 作为分隔符。

        let joined;
        for (let i = 0; i < args.length; ++i) {
          const arg = args[i];
          validateString(arg, 'path');
          if (arg.length > 0) {
            if (joined === undefined)
              joined = arg;
            else
              joined += `/${arg}`;
          }
        }
    

再判断一下 `joined` 是不是 `undefined`。

        if (joined === undefined)
          return '.';
    

我们前面看到了，拼接的时候是简单粗暴以 `/` 作为分隔符。也就是说，如果两个参数分别是 `/a/b` 和 `../c`，那么拼接结果应该是 `/a/b/../c`；或者两个参数分别是 `/a/b/` 和 `/c`，那么结果应该是 `/a/b//c`。这跟我们拿到的最终结果并不一致。前者在 `path.join()` 后的结果应该是 `/a/c`，后者则是 `/a/b/c`。最关键就在最后一步了：

        return posix.normalize(joined);
      },
      ...
    };
    

就是直接用 `posix.normalize()` 去规范化结果并返回。`path.normalize()` 本身就是 Node.js 的 `path` 中的一个 API，用处就不赘述了；篇幅原因，也不再深入进去讲了。

大意就是 `path.join()` 是简单粗暴把参数们以 `/` 拼接之后，通过 `path.normalize()` 一次性规范化好。

本章小结
----

本章为大家讲述了 Node.js 中的文件系统相关内置模块是如何工作的，并为大家弥补了文件系统的一些先序知识点，避免了大家在阅读小册时候出现之前被诟病的“莫名其妙跳出个新词”这种情况。Node.js 的文件系统模块是靠 libuv 提供的，而 libuv 在 Linux 之类的操作系统中，则是封装了系统提供的那些 API。层层套娃，在 Node.js 的 JavaScript 侧又多套了几层，最终到达了现在的样子。比如一个 `fs.readFile()`，它的流程就如下图：

![26流程图5.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4c20af34f73b4f4f906259dc0975868a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=2042&h=608&s=170778&e=png&b=fefcfc)

在讲述完 `fs` 后，又为大家简单提了一下与其伴生的 `path` 模块。其中都是些字符串操作。在 OI、ACM 等比赛中，最简单又最复杂的题目其实就是字符串模拟题了，简单是它不需要什么高深的算法，只需要按规则一步步实现即可；复杂是它们的规则通常很繁杂。讲规则又太复杂，不讲规则又没什么好讲的，所以只好让大家自行去翻阅源码了。不过，小册中还是稍稍为大家提了一下 Windows 与 POSIX 对于文件路径的一些异同点，并且 Node.js 中对两套操作系统体系都实现了不同的逻辑，根据运行操作系统的不同而进行不同的导出。