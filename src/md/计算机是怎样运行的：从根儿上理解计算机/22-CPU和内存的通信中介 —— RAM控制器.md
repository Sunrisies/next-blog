第23章、处理器和RAM的矛盾
===============

标签： 计算机是怎样运行的

* * *

电路模块划分
------

经过长时间努力，我们现在可以使用1个RAM来既存储指令，也存储数据了。其实上一章的电路可以被分为2个部分，如下图所示：

![image_1f93kl8eg16hblabkl3sfepbe13.png-110.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/296610cab12d4e42a81ca4ff6d5121fb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1302&h=835&s=113201&e=png&b=d4c1e3)

它们分别是：

*   第1部分：获取和执行指令的部分。
    
    这个部分是整个电路的灵魂部分，我们也可以将其称作`处理单元`（英文名 Process Unit，简称PU），或者`处理器`（英文名：processor）。其实计算机中也可以有别的某些专门用途的处理单元，比方说专门处理图形和图像计算的处理单元，为了和其他专门用途的处理单元做区分，我们目前做的这个处理单元也可以被称作中央处理单元，也就是Central Process Unit，简称CPU。我们可以用黑盒子将CPU包起来（我们忽略了HALT信号的处理）：
    
    ![image_1f93mqnso1ri91ojq1rfp1mtp11r41t.png-13.8kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/988f8fe27e4c447fa5cbe1083f02cb00~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=428&h=437&s=14088&e=png&b=ffffff)
    
    用黑盒子包装起来的CPU也可以被称为一个`芯片`（chip），该芯片与外界通信的信号线也可以被称作该芯片的`引脚`（引脚）。可以看到我们重命名了CPU的输入输出信号名称，其中后缀为\_I表示输入信号，后缀为\_O表示输出信号，之后介绍的信号也都遵循此规范。
    
    其中各个信号的含义如下表所示：
    
    信号名
    
    信号位数
    
    类型
    
    用途
    
    CPU\_CLK\_I
    
    1
    
    输入
    
    时钟信号
    
    CPU\_RST\_N\_I
    
    1
    
    输入
    
    复位信号
    
    CPU\_DATA\_I
    
    16
    
    输入
    
    CPU从存储设备读入的数据
    
    CPU\_WE\_O
    
    1
    
    输出
    
    CPU允许存储设备写入数据
    
    CPU\_ADDR\_O
    
    6
    
    输出
    
    CPU将数据写入到存储设备的地址
    
    CPU\_DATA\_O
    
    16
    
    输出
    
    CPU写入到存储设备中的数据
    
*   第2部分：RAM，用于保存指令和数据。
    
    RAM的黑盒子我们很久之前就画过了，不过为了格式上的统一，我们再重新画一下：
    
    ![image_1f93nlq2g1mfv13sk1avu1i8h108c2a.png-12.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8a44b2916bb34e1b960cf5b7fc26e315~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=423&h=377&s=12586&e=png&b=ffffff)
    
    RAM也可以以单独芯片的形式出现， 其中各个信号的含义如下表所示：
    
    信号名
    
    信号位数
    
    类型
    
    用途
    
    RAM\_CLK\_I
    
    1
    
    输入
    
    时钟信号
    
    RAM\_DATA\_I
    
    16
    
    输入
    
    RAM接收的数据输入
    
    RAM\_WE\_I
    
    1
    
    输入
    
    RAM接收的写使能信号
    
    RAM\_ADDR\_I
    
    6
    
    输入
    
    RAM接收的地址信号
    
    RAM\_DATA\_O
    
    16
    
    输出
    
    RAM的数据输出
    

CPU和RAM的连接方式如下图所示：

![image_1f98ra5j4j8d1me7m911l463gp9.png-31.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99bbedd65cb94305a3c89f4d7615e92f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=662&h=587&s=32075&e=png&b=ffffff)

CPU和RAM速度不匹配的问题
---------------

虽然搭建电路的过程是复杂的，但结果是很美好的，我们费了半天劲其实主要就是搭建起来了CPU和RAM这两个模块。作为用户的我们只需要将指令和数据事先输入到RAM中，然后CPU就可以从RAM中取指令，之后执行指令，然后取下一条指令，再执行，再取指令，再执行... 直到取到halt指令为止。

> 小贴士：  
>   
> 原来CPU能做的事情是如此的简单：取指令、执行指令、取指令、执行指令... 循环往复。

当我们搭建起一个小作坊之后应该干嘛呢？当然是扩招员工，做大规模，使它变成一个大公司。对于我们搭建的电路来说，下一步就是要增加RAM的容量，让它可以存储更多的指令和数据，这样才能支持编写更大规模的软件（即程序）。可是增加RAM容量的时候遇到了一些问题。

还记得我们之前是如何搭建容量为`4×8`的RAM的吗？我们来看一下电路图：

![image_1f9b3ulnm10dssho11u1eiq1l05m.png-41.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b931437ce71047eeacd3aa33f9aadb73~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=847&h=739&s=42906&e=png&b=fefefe)

我们使用4个8位寄存器来保存数据，每一个寄存器都对应一个专门的地址，然后可以：

*   在读取数据时，我们将RAM当作是一个`组合电路`来看待。将地址信号作为`4-1选择器`的控制信号，然后就可以输出该地址对应寄存器中的数据。
    
*   在写入数据时，我们将全局的WE信号设置为逻辑1，然后将地址信号作为`2-4译码器`的输入，就可以将该地址对应寄存器的WE信号设置为逻辑1，从而在下一个时钟信号上升沿到来后修改该寄存器中的数据。
    

在RAM容量较小的时候采用这种方式制作RAM也没有什么问题，但是随着容量的增大问题就会越来越多，比方说：

*   寄存器是一个十分耗费晶体管的器件，使用的晶体管越多，也就意味着要占用更多的芯片面积。
    
    随着技术的进步，后续出现了使用六个晶体管来存储一位数据的静态RAM存储器（简称SRAM），如下图所示：
    
    ![image_1f9b54gcv1mf13tae7b1njv1al713.png-16.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6c758a461fca414e98f86034ff34104f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=579&h=364&s=16475&e=png&b=fefefe)
    
    也出现了使用1个电容加一个晶体管来存储一位数据的动态RAM存储器（简称DRAM），如下图所示：
    
    ![image_1f9b5608v1i0tg3g11pd1ertaak1g.png-26kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/deae6eabee834eaa87916ec16d150f11~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=474&h=380&s=26673&e=png&b=ffffff)
    
    > 小贴士：  
    >   
    > SRAM和DRAM存储一位数据的电路图不是我自己画的，是取自《Memory System：Cache, DRAM, Disk》一书。这是一本系统唠叨存储系统的书籍，十分推荐阅读。
    
    虽然我们把SRAM和DRAM存储一位数据的电路图画了出来，但我们并不想深入更多的细节以及展开讨论，因为这涉及到更多的模拟电路和数字电路的知识，以及可以让人发疯的各种细节，这些并不是在一个章节中可以讲明白的知识。与其讲个模模糊糊，还不如直接把它们当一个黑盒子对待。
    
    我们平常所说的“内存条”其实指的就是DRAM存储器，它在读取和写入数据时会更耗时。
    
*   地址线条数越多，这会导致芯片的引脚数量变得更多。
    
    为解决这个问题，一般是将RAM中存储的二进制位组织成行和列，然后将地址拆分为行地址和列地址。比方说下边是一个包含4行4列的RAM的示意图：
    
    一般是将RAM中存储的二进制位组织成行和列，比方说下边是一个包含4行4列的RAM的示意图：
    
    ![image_1f9b61jfq1360s2d1f1s1boq1kr21t.png-8.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ddf8b51aa81348c68ea004201787b135~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=662&h=298&s=8632&e=png&b=ffffff)
    
    其中每一个小方格都代表若干个二进制位，我们可以分两次给出某个小方格对应数据的地址：
    
    *   先给出数据的行地址，这一步骤称为行激活。
        
        ![image_1f9b62a9u1duu497eqo15474m32a.png-9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ffd7f50eccf54aa190af56d64f116266~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=669&h=262&s=9253&e=png&b=fcfcfc)
        
        在发送行地址之后，要等待若干个时钟周期才能继续发送列地址（具体等待多少个时钟周期取决于RAM的型号以及我们所使用的时钟频率）。
        
    *   然后给出数据的列地址，如果是写入操作还需要给出待写入的数据，如下图所示：
        
        ![image_1f9b62vav1e8u3cj10451oaf1ktq2n.png-9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fd2f1bb43a054ee7ae857a6eb3a46adb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=672&h=239&s=9213&e=png&b=fcfcfc)
        
    
    如果接下来还需访问本行内的其他列，那么紧接着只发送列地址即可；如果接下来要访问别的行中的数据，那就得先发送该行地址将其激活，然后再给出列地址。
    

我们先给大家看一下现代内存条的一个实物：

![image_1f9b66bo486p17o91l761k8115bd34.png-117.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/124743c1709c4a2baa637de584b154f3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=400&h=282&s=120256&e=png&b=fefcfc)

图中最下边那一排金灿灿的条状金属片格外引人注目，它们就是内存条与外部设备通信的引脚，俗称金手指，如下图所示：

![image_1f9b66p9gvcb56ll0g114qstp3h.png-114.6kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c2edfb2707d147069afde09332e59d3d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=445&h=232&s=117360&e=png&b=fefdfd)

访问（读或写）这种大容量RAM除了要分别发送行地址和列地址之外，还需要通过控制信号发送预充电、周期性刷新等命令，还需要考虑发送不同命令之间的时间延迟。有没有感觉很麻烦？是的，超级麻烦！当你想租房的时候，会在各个小区挨门挨户的敲门问人家有房子出租么？这样会付出极大的时间和精力以及面临很大的找不到房子的可能性。此时一个十分省事儿的办法就是去找中介，让中介带着我们去看房，当然代价就是要交一些中介费。

CPU在与大容量RAM这种十分复杂的硬件进行通信时，与其CPU自己搞明白通信的每一个细节，不如直接找一个中介。CPU直接把要访问的地址和数据交给中介（按照以前直接和RAM通信的方式与中介进行沟通），中介再去处理和大容量RAM的具体沟通细节，沟通完成后再把结果交给CPU。我们可以把这个中介称作`RAM控制器`（RAM Controller），`RAM控制器`给CPU提供了非常友好的访问接口，让CPU专注于做自己的事情，而无需考虑与复杂RAM通信的各种细节。

> 小贴士：  
>   
> 什么是预充电，什么是周期性刷新？内存条的内部结构到底是长什么样的？每个金手指都代表什么信号？为什么内存条上有那么多的黑色小方框？一连串的黑人问号已经展现在了各位心头。我们需要再次强调，讨论像内存条这样复杂硬件的实现需要好几个章节的篇幅，甚至需要完整的一本书，考虑到本书不是面向硬件开发人员的，我们并不想把复杂硬件的实现细节暴露给大家，之后有机会在纸质书或者公众号里再来讨论更多关于内存条的具体细节吧。

CPU和RAM控制器的通信
-------------

在引入了`RAM控制器`这个中介之后，CPU和RAM控制器的简要沟通过程就如下图所示：

![image_1famk04a91g4o1e5llpg1ibg134a9.png-44.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6b8dacfa16754abb966d22bb2988fd45~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=832&h=490&s=45554&e=png&b=fefefe)

因为引入复杂的RAM后，`RAM控制器`读写RAM的过程可能需要多个时钟周期，在这个过程中有两个核心的问题需要解决：

1.  RAM控制器需要知道CPU啥时候给它发送读/写请求，在接收到请求之后它才能进一步和实际的RAM进行沟通。
    
2.  CPU需要知道RAM控制器啥时候将结果准备好。
    

为解决这两个问题，CPU和RAM控制器的通信方式就不能简单的和之前CPU与RAM直接沟通的方式一样了，我们需要引入了一些新信号，先看一个超简单的RAM控制器需要在之前介绍的RAM的基础上需要增加哪些信号（RAM控制器的各个信号都以RC\_开头）：

![image_1fams209o144hg8813t318is4oc9.png-17.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2b96ab35a2a64b99bc6284e5b5f57599~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=468&h=515&s=18288&e=png&b=ffffff)

> 小贴士：  
>   
> 我们忽略了RAM控制器与RAM之间通信的信号。

与之前的RAM相比，RAM控制器新增了这些信号：

*   RC\_RST\_N\_I：
    
    RAM控制器内部也维护了一个产生状态的`有限状态机`，在复位之后，该RAM控制器会处于空闲状态，等待CPU发送读/写请求。
    
*   RC\_HELLO\_I
    
    处在`空闲状态`的`RAM控制器`会在每个时钟信号上升沿都会检测RC\_HELLO\_I输入信号：
    
    *   当RC\_HELLO\_I=0时，意味着此时CPU并没有发送读/写请求，RAM控制器可继续保持空闲状态。
        
    *   当RC\_HELLO\_I=1时，意味着此时CPU正在发送读/写请求，RAM控制器从空闲状态转换到别的状态去处理对应的读/写请求。
        
*   RC\_ACK\_O
    
    当RAM控制器处理完与RAM的复杂交互后，需要通知CPU，此时就将RC\_ACK\_O输出信号设置为逻辑1。这时CPU的一次读/写操作就算是做完了。然后在下一个时钟周期进入空闲状态，等待CPU给自己发送读/写请求。
    

> 小贴士：  
>   
> HELLO是打招呼的意思，ACK是Acknowledge的缩写，表示确认收到的意思。

CPU也需要做相应的改变：

![image_1fescik6fbhe1i2cauagv6oqe9.png-11kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/46a9bef09f554440bd4ae3373e55b404~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=339&h=404&s=11222&e=png&b=ffffff)

如图所示，CPU新增了2个信号：

*   CPU\_HELLO\_O：
    
    每当CPU想从RAM中读取或写入数据时，就将CPU\_HELLO\_O设置为逻辑1，并且：
    
    *   当读取数据时，需要同时让CPU\_WE\_O=0、CPU\_ADDR\_O上给出待读取数据对应的地址。
        
    *   当写入数据时，需要同时让CPU\_WE\_O=1、CPU\_ADDR\_O上给出待写入数据对应的地址以及CPU\_DATA\_O上给出待写入数据的内容。
        
*   CPU\_ACK\_I：
    
    在CPU向RAM控制器发出读/写请求时，需要等待RAM控制器的响应，具体就是在每个时钟信号上升沿都检测CPU\_ACK\_I输入信号：
    
    *   当CPU\_ACK\_I=0时，说明CPU还需等待，不能进行下一步操作。
    *   当CPU\_ACK\_I=1时，说明可以进行下一步操作。

引入了RAM控制器后，整个电路的各个部分可以这样连接：

![image_1fams9kkildi17s31eia1egr1kq8m.png-55.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3ac549a485ba409eaf1c46c40d97d1bc~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=976&h=660&s=57267&e=png&b=ffffff)

下边的问题就是CPU生成CPU\_HELLO\_O输出信号和处理CPU\_ACK\_I输入信号的具体细节了。

> 小贴士：  
>   
> 下边的内容主要是描述在引入RAM控制器后，CPU的控制单元应该如何改变，有一丢丢复杂，如果大家不想看了可以跳过。

CPU处理CPU\_ACK\_I输入信号
--------------------

上一章介绍了使用2个时钟周期执行一条指令的控制单元，它的电路图如下所示：

![image_1fdrddgcl15u618nj1pko64i1ehd9.png-160.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/60e2cd0a747544b1ab8c825c7d9a3342~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1244&h=611&s=164177&e=png&b=fefefe)

现在访问RAM需要多个时钟周期，上述控制单元也应该做相应的变动了，我们来看看都要改哪些地方。

### 状态生成器的修改

我们知道现在CPU拥有2个状态：`取指状态`和`执行状态`：

*   当CPU处于`取指状态`时，它正在等待RAM控制器给自己返回指令，那么：
    
    *   当CPU\_ACK\_I=0时，说明RAM控制器并未准备好指令，那么下一个时钟周期CPU还得继续保持为`取指状态`不变。
        
    *   当CPU\_ACK\_I=1时，说明RAM控制器已经准备好了指令，那么下一个时钟周期可以转到`执行状态`。
        
    
    也就是当Snow\=0时：
    
    *   当CPU\_ACK\_I=0时，Snext\=0。
    *   当CPU\_ACK\_I=1时，Snext\=1。
*   当CPU处于`执行状态`时，那么：
    
    *   如果正在执行不需要访问RAM的指令，诸如add\_i，load\_i等，那么下一个时钟周期上升沿到达后即可转到`取指状态`工作。
        
    *   如果正在执行需要访问RAM的指令，诸如add\_m，store等，那么得继续细分情况讨论：
        
        *   当CPU\_ACK\_I=0时，说明RAM控制器并未准备好数据，或者写入操作尚未完成，那么CPU还得继续保持为`执行状态`不变。
            
        *   当CPU\_ACK\_I=1时，说明RAM控制器已经准备好数据，或者写入操作已经完成，那么CPU在下一个时钟周期进入`取指状态`。
            
    
    很显然我们得在`执行状态`区分一下当前执行的指令需不需要访问RAM，我们可以引入一个名为`ACCESS_RAM_INS`的信号来标记当前执行的指令是否需要访问RAM，这个信号可以由`1号控制单元`生成（ACCESS\_RAM\_INS信号的生成过程类似ALU\_OP这些信号，本质都是一个多输入逻辑门，具体生成细节我们就不展开唠叨了）：
    
    ![image_1f9eb7kln1iao21h8jjgdbnkdf.png-19.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1a36b65638a6465fb156d2e9c27fccd7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=563&h=284&s=20346&e=png&b=ffffff)
    
    这样：
    
    *   当ACCESS\_RAM\_INS=0时，意味着正在执行不需要访问内存的指令，诸如add\_i、load\_i等。
        
    *   当ACCESS\_RAM\_INS=1时，意味着正在执行需要访问内存的指令，诸如add\_m、store等。
        
    
    引入了ACCESS\_RAM\_INS信号之后，我们再回过头看当Snow\=1时：
    
    *   如果ACCESS\_RAM\_INS=0，Snext\=0。
        
    *   如果ACCESS\_RAM\_INS=1，分情况讨论：
        
        *   如果CPU\_ACK\_I=0，Snext\=1。
        *   如果CPU\_ACK\_I=1，Snext\=0。

这样我们就可以写出CPU的当前状态Snow以及下一个状态next之间的真值表：

Snow（输入）

CPU\_ACK\_I（输入）

ACCESS\_RAM\_INS（输入）

Snext（输出）

0（取指状态）

0

X

0（取指状态）

0（取指状态）

1

X

1（执行状态）

1（执行状态）

X

0

0（取指状态）

1（执行状态）

0

1

1（执行状态）

1（执行状态）

1

1

0（取指状态）

根据这个真值表，我们可以很容易的制作出新的`状态生成器`（从真值表中找出所有Snext为1的行，然后根据这些行的输入，分别制作一个只在该输入情况下输出才为1的设备，最后将这些设备的输出作为一个或门的输入即可）

![image_1ffhrdg911ktl1nh6m80uotcr09.png-22.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3e938368e4d44441b89adefd7ac1df94~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=984&h=309&s=23041&e=png&b=fefefe)

还是把这个新的`状态生成器`装在黑盒子里：

![image_1f9e19rf41cgm1ppb13f673dav0d2.png-15.2kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4fc0fd3d241743238e3c432eef062bff~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=614&h=289&s=15594&e=png&b=ffffff)

把新制作的`状态控制器`和`1号控制单元`放到完整的`控制单元`中就是这样：

![image_1f9ec8s1k1s3f8es1tld170j1j3ke9.png-45.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fe7302efe7f44ba79bef4c92a66364e8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1070&h=638&s=46364&e=png&b=fefefe)

### 其他控制信号的处理

*   取指状态的控制信号修改
    
    在引入了RAM控制器后，当CPU处在`取指状态`时，如果RAM控制器尚未返回指令，那在下一个时钟周期上升沿到达后不应该更新任何一个存储设备，也就是电路中的各种WE信号都应为逻辑0。幸运的是，在上图对应的`控制单元`中，当CPU处于`取指状态`时，只有IR\_WE信号为逻辑1，其余WE信号均为逻辑0。接下来我们只需要：
    
    *   当STATE=0、CPU\_ACK\_I=0时，令IR\_WE=0。
    *   在其他情况下让\_IR\_WE信号保持为原控制单元生成的信号不变。
    
    完成这个功能很简单，引入一个`2-1选择器`即可：
    
    ![image_1f9gtaedo1pon1ron12v3rqg8aa6d.png-20.8kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a52cb9d966f4c5ea04986625bc5d7fd~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=787&h=351&s=21258&e=png&b=ffffff)
    
    或非门具有“只有当两个输入都为0时，输出才为1”的特性，所以只有当STATE=0、CPU\_ACK\_I=0时，上图中`2-1选择器`的控制信号才为逻辑1，生成的新IR\_WE才为逻辑0。在其他输入的情况下，新的IR\_WE信号和之前的IR\_WE信号保持一致。
    
*   执行状态的控制信号修改 当CPU处在`执行状态`时，如果执行的是需要访问RAM的指令（ACCESS\_RAM\_INS=1），那下一个时钟周期上升沿除RAM\_WE信号之外的所有WE信号都应为逻辑0（稍后解释RAM\_WE信号为何可以除外）。在之前制作的`控制单元`中，在`执行状态`，会将PC\_WE、ACC\_WE、ZF\_WE设置为逻辑1，IR\_WE设置为逻辑0。所以我们需要：
    
    *   当STATE=1、ACCESS\_RAM\_INS=1、CPU\_ACK\_I=0时，令PC\_WE=0、ACC\_WE=0、ZF\_WE=0。
    *   在其他情况下让PC\_WE、ACC\_WE、ZF\_WE信号保持为原控制单元生成的信号不变。
    
    完成这个功能很简单，引入一个`2-1选择器`即可：
    
    ![image_1f9h008301brt38b1j8219jh1qb177.png-27.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/31ae40fd4cb742e2bdbc33c26c0889d6~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=540&h=530&s=28064&e=png&b=ffffff)
    
    为啥我们不需要重新生成RAM\_WE信号呢？因为RAM\_WE信号其实是给RAM控制器的输入信号RC\_RAM\_WE，那么：
    
    *   当CPU执行读取RAM的指令时，比方说add\_m，RAM\_WE肯定为逻辑0。
    *   当CPU执行写RAM的指令，也就是store指令时，在RAM控制器将数据写入RAM的整个过程中，它的RC\_RAM\_WE信号都保持为逻辑1也没什么问题。

那我们可以把修改后的IR\_WE、PC\_WE、ACC\_WE、ZF\_WE信号生成过程封装在一个黑盒子里，如下图所示：

![image_1f9h24fvb17tu1qdsi9817rt4247k.png-23.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/deed2920c3e24a25a1867c2d786fa47d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=584&h=279&s=23994&e=png&b=ffffff)

把上边的黑盒子放在完整的`控制单元`中：

![image_1f9h2pavq16sj7im1du01gq5fl181.png-42.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2dbedc7afbe547c5bbe482ae2619915f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1082&h=570&s=43508&e=png&b=fefefe)

赞！我们就解决了`控制单元`的问题！

CPU生成CPU\_HELLO\_O信号
--------------------

现在还剩最后一个问题就是如何生成CPU\_HELLO\_O信号了。我们需要先分析一下什么时候CPU需要访问RAM：

*   当CPU处于取指状态时，需要访问RAM。
    
    也就是当STATE=0时，令CPU\_HELLO\_O=1。
    
*   当CPU处于执行状态，分两种情况讨论：
    
    *   当执行的是需要访问RAM的指令时，也就是当STATE=1、ACCESS\_RAM\_INS=1时，令CPU\_HELLO\_O=1。
    *   当执行的是不需要访问RAM的指令时，也就是当STATE=1、ACCESS\_RAM\_INS=0时，令CPU\_HELLO\_O=0。

很容易画出生成CPU\_HELLO\_O信号的电路图：

![image_1f9h50kpd1cl61a63jau86i16s58e.png-12.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/93603af441864744a5c2a417aa373cd3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=757&h=140&s=13020&e=png&b=ffffff)