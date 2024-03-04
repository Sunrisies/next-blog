第22章、只保留一个RAM
=============

标签： 计算机是怎样运行的

* * *

旧知识回顾
-----

经过长时间的努力，我们终于造出了一个支持14条指令的设备，但是电路图看起来十分复杂，各种弯弯绕绕的线看的人眼花缭乱，导致很多小伙伴可能看了后边的忘了前边的。这其中很大的一个原因是因为时钟信号线和复位信号线过多导致的，为方便大家理解，我们现在省略电路中的时钟信号线和复位信号线的连接，再来重新梳理一下电路中各个部件之间的数据流动。

1.  开局我们有一个`程序计数器`，它的输出表示我们当前正在执行指令的地址：
    
    ![image_1f91eo6g31ejk9dffjum41198d6c.png-24kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c8b579471e1439398f49e182cb612ca~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=533&h=406&s=24605&e=png&b=ffffff)
    
2.  `程序计数器`的输出连接到`指令RAM`，指令RAM的输出代表一条指令：
    
    ![image_1f91eqp8ae0d1kh51ftu1lv11gur6p.png-18.2kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ecc004b6925e4df181bc603c02b5ec45~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=567&h=250&s=18602&e=png&b=ffffff)
    
    目前我们设计的一条指令包含16个二进制位，其中8～15位规划作为操作码，实际使用了8～11位；0～7位规划作为操作数，操作数分为两类：
    
    *   使用立即数作为操作数，目前的设计中指令中的0～7位代表一个立即数。比方说add\_i指令的操作数就是立即数。
        
    *   使用RAM地址作为操作数，目前的设计中指令中的0～5位代表一个地址。比方说add\_m、jmp、store指令的操作数就是RAM地址。
        
    
    我们可以把操作码称作`opcode`，把代表立即数的操作数称作`operand_imm`，把代表地址的操作数称作`operand_addr`，那么一条指令就可以被画出三个分支：
    
    ![image_1f91eta5013t81gth1qg0224pco76.png-43kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d4557c369dab4be1b875d212f0025ac8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=876&h=494&s=44056&e=png&b=ffffff)
    
3.  先看`operand_addr`分支，在执行需要访问RAM的指令中，需要先从`数据RAM`中把指令中给定地址处的数据读出，那么`operand_addr`其实就作为一个`数据RAM`的地址输入，如下图所示：
    
    ![image_1f91eulog1uug12hvb661jcao0b7j.png-43.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4b52a6a5685c4379ba150ea7e9032c33~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1059&h=507&s=44711&e=png&b=fefefe)
    
    `数据RAM`的输出有两个用途：
    
    *   一是作为ALU的输入B参与运算，比方说add\_m指令就是要从RAM中读出指定地址的数据与累加器中的数据做加法。
        
    *   二是作为跳转指令的目的地址，比方说jmp、je指令都需要指定下一条指令的地址。
        
4.  以立即数作为操作数的算术/逻辑运算指令（比方说add\_i）需要将指令中的立即数（也就是operand\_imm）与累加器中的数据进行运算，以RAM地址作为操作数的算术/逻辑运算指令（比方说add\_m）需要从`数据RAM`中读出给定地址的数据（也就是alu\_b\_value）然后与累加器中的数据进行运算。operand\_imm和alu\_b\_value都会被作为ALU的输入B的输入，所以它们需要先通过一个`2-1选择器`然后在与ALU的输入B连起来，如下图所示：
    
    ![image_1f91f0h39m1a1hu7181gsg4gea80.png-30.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b1947a9089624a069c0c180e4c473cea~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=927&h=425&s=31140&e=png&b=fefefe)
    
5.  ALU的输入A来自累加器（简称ACC），在执行完算术/逻辑运算指令后，运算结果应该还写回到累加器中，效果如下图所示：
    
    ![image_1f91f22co10ma15pe1t1cond14o38d.png-47.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/194a1aeb42514e3eb0f0d3da04f2b616~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1170&h=532&s=48823&e=png&b=fefefe)
    
    这里我们把原先ALU的控制信号S₁、S₀统称为`ALU_OP`。
    
6.  load类型指令用于将某个数加载到累加器中（load\_i加载的是立即数，load\_m加载的是RAM中的数），被加载的数据被放到了ALU的输入B处。此时我们将ALU＿OP设置为加法，然后让ALU的输入A为0即可达到让累加器的输入为ALU的输入B的效果，这样我们就得在ALU的输入A前边加一个`2-1选择器`，如下图所示：
    
    ![image_1f91f3m7v1avg1j1a1au7sddlco8q.png-51.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6cd8cb26118c4f2c965388e8099ce7e8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1188&h=540&s=52930&e=png&b=fefefe)
    
7.  为支持store指令，即将累加器中存储的数据写到`数据RAM`中，累加器的输出应该作为`数据RAM`的数据输入，如下图所示：
    
    ![image_1f91f4jjk1vr62l11nbhlf815ks97.png-52.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a6664acbfcf64f8eb85fb515143c210b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1163&h=559&s=53716&e=png&b=fefefe)
    
8.  正常情况下，在执行完一条指令后，应该执行地址比当前指令地址大1的新指令，如下图所示：
    
    ![image_1f91f79vf122b7epjlt12rc11gg9k.png-41.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dbb8d333f3974958983c35eae8c23fe8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1076&h=443&s=42295&e=png&b=fefefe)
    
    但是在执行jmp、je等跳转指令时，程序计数器的输入应该为jmp\_addr，此时我们需要引入一个`2-1选择器`，如下图所示：
    
    ![image_1f91fiutb1u1716vgaui1ccg1vira1.png-42.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/67057568d2e44dc0b201fe05acbe9258~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1104&h=464&s=43084&e=png&b=fefefe)
    
9.  各种`2-1选择器`的控制信号、累加器和数据RAM的WE信号以及ALU的控制信号都是根据当前正在执行的指令生成的，指令的opcode通过控制单元，由控制单元来统一生成这些信号，如下图所示：
    
    ![image_1f91fk2qb1qi1cj1t0u14341ianae.png-47kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ffec2e6aa56e49dc8c5e0eb12cc0f8ad~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1129&h=612&s=48114&e=png&b=fefefe)
    
10.  对于条件跳转指令je来说，只有在执行上一条指令后ALU的输出为0时，je指令才真正执行跳转。这就导致需要ZF寄存器来存储一下ALU的结果是否为0，并且将ZF寄存器的输出作为`控制单元`的输入来生成控制信号（ZF寄存器的输出只影响PC\_SEL信号），如下图所示：
    
    ![image_1f91fmbdk161v1sn8g001gmk1g5jar.png-51kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/95fc41b707184a408f68065421fe514a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1213&h=626&s=52271&e=png&b=fefefe)
    

> 小贴士：  
>   
> halt指令用来让电路停止执行，我们是采用让各个寄存器以及RAM接收不到CLK信号的方式来实现halt指令的，由于我们省略了CLK信号，所以在上图中也未画出halt指令的实现，这一点大家注意一下。

只保留一个RAM
--------

在我们之前的唠叨中，使用单独的`指令RAM`来存储指令，使用单独的`数据RAM`来存储数据，这样的计算机结构也被称作`哈佛结构`。

本质上`指令`和`数据`都是一堆二进制位，只是我们人为的将其区分为指令和数据，那能不能只使用一个RAM，这个RAM既存储指令，也存储数据呢？当然可以，而且这就是本章的主题。这种把指令和数据都存储到同一个存储设备中的计算机结构也被称作`冯·诺伊曼结构`。

### 面临问题

我们看下边这个电路图：

![image_1f8v6ee2r1vgscutgqd1qr7cu9.png-14.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/65bcc6ac3bf14897868d037664522b6e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=687&h=314&s=14450&e=png&b=ffffff)

每当时钟信号上升沿到来后，寄存器的输出b代表的数据将被更新为输入a代表的数据，而且经过组合逻辑所需的一段传输延迟时间后，组合逻辑的输出c稳定后将保持不变。也就是说，在一个时钟周期内，各个信号线代表的数据最终会稳定在某个值并保持不变，在下个时钟信号上升沿到来后才会被更新为别的值。

这样的话，如果我们仅使用1个RAM来既存储指令，又存储数据的话，那么在某个时钟周期内，该RAM的地址信号到底代表指令的地址，还是该代表数据的地址呢？以及该RAM的输出到底代表指令，还是代表数据呢？如下图所示：

![image_1f8v6fb5u19c28m1a7t1io21taom.png-29.8kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/56e333935ac0496bb74cf1e82120fc97~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=740&h=380&s=30520&e=png&b=ffffff)

很抱歉，在一个时钟周期内，地址信号线要么表示指令对应的地址，要么表示数据对应的地址；输出信号线要么代表指令，要么代表数据。那该咋办呢？

### 取指和执行状态

既然一个时钟周期搞不定，那我们就整两个时钟周期，一个时钟周期用于读取指令，另一个时钟周期用于读取数据。这两个时钟周期也可以被称作两个阶段：

*   取指阶段。在这个阶段，RAM的地址信号代表指令的地址，RAM的输出代表指令。
    
*   执行阶段。在这个阶段，RAM的地址信号代表数据的地址，RAM的输出代表数据。也是在这个阶段，真正的执行指令。
    

![image_1f90g9ljs1u1kpjdmsd641b82d.png-14.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bd3b6707419a42f1a0173ba66688721b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=762&h=279&s=14424&e=png&b=fdfdfd)

如上图所示，第0周期是取指阶段，第1周期是执行阶段，第2周期又是取指阶段，第3周期又成了执行阶段，就这样一直取指、执行、取指、执行下去。

因为现在电路只能处在取指阶段或者执行阶段，我们就说电路可以处在两个状态：

*   状态一：取指状态。我们把处在取指阶段的电路称为处在取指状态。
    
*   状态二：执行状态。我们把处在执行阶段的电路称为处在执行状态。
    

接下来可以给电路的不同状态编一个号：

*   取指状态编号为0。
*   执行状态编号为1。

我们把电路当前处在的状态称为Snow，把电路的下一个状态称为Snext。那么：

*   如果当前电路处于取指状态，那么它的下一个状态就是执行状态，也就是当Snow\=0时，Snext\=1。
    
*   如果当前电路处于执行状态，那么它的下一个状态就是取指状态，也就是当Snow\=1时，Snext\=0。
    

我们可以用下边的表格来描述电路现处状态和下一个状态之间的关系：

Snow

Snext

0（取指状态）

1（执行状态）

1（执行状态）

0（取值状态）

这显然是一个反相器的真值表，不过电路的状态只能在时钟信号上升沿到来后才能更新，那我们可以引入一个称为`状态寄存器`的寄存器来保存电路当前所处于的状态，如下图所示：

![image_1f90gh263hopp37oegibdtdv9.png-15kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d974b5eb59c8416f8a3deced689a439f~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=490&h=280&s=15375&e=png&b=ffffff)

如图所示，输出信号STATE表示着电路当前处在的状态。当STATE=0时，表示电路当前处于取指状态，当STATE=1时，表示电路当前处于执行状态。我们可以把上边的这个电路装在黑盒子里，只露出CLK和RST\_N输入信号以及STATE输出信号，然后将这个设备称为`状态生成器`，如下图所示：

![image_1f90hb4pq92h1ngkd831lj2fov2d.png-12kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/04e7b14ec78e4e6a970a8215cee7b0d7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=417&h=259&s=12299&e=png&b=ffffff)

这个`状态生成器`是一个可以生成状态的机器，所以也可以被称为`状态机`，因为我们目前只能生成`0`（取指状态）和`1`（执行状态）两种状态，所以这个设备也可以被称为`有限状态机`。

那么，在RST\_N=0时，输出信号STATE始终为逻辑0，当把RST\_N从逻辑0调整为逻辑1后，每当有时钟信号上升沿到来后，输出信号STATE都会取反。也就意味着每次时钟信号上升沿到来后，电路的状态会在取指状态和执行状态之间切换。我们把在RST\_N=1时的状态变换过程用下图表示一下：

![image_1f90gietvjr71gsq113himc40n13.png-12.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/00936fb6e13846ee9ac5add1f3477c66~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=583&h=205&s=12823&e=png&b=fefefe)

上图表示的意思就是每当时钟信号上升沿到来后，如果当前的状态是`0`（取指状态），那么就会变为`1`（执行状态）；如果当前的状态是`1`（执行状态），那么就会变为`0`（取指状态）。这种描述`有限状态机`状态转换过程的图也称作`状态转换图`。很显然，这个有限状态机的下一个状态Snext是什么，仅仅取决于当前状态Snow是什么，我们可以把这种下一个状态仅仅取决于当前状态是什么的有限状态机称为`无外部输入的有限状态机`（更多的地方称作Moore型状态机）。

### 电路改进

我们之前都是使用1个时钟周期来执行一条指令的，在引入了`取指阶段`和`执行阶段`后，我们需要在`取指阶段`将指令从`RAM`中取出，然后在`执行阶段`真正的执行指令（所谓“真正的执行”就是指根据指令作为输入，通过控制单元产生各种控制信号，来指导各个器件完成不同的功能），也就意味着我们需要2个时钟周期去执行一条指令。事情变得稍微复杂了一些，我们再从头看一下数据在各个部件之间是如何流动的：

1.  开局我们有一个`程序计数器`，它的输出表示我们当前正在执行指令的地址：
    
    ![image_1f91g2u0encg192f150t1ft91vuab8.png-23.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f03fb12a09c347e7b0d49b1ed24c305a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=494&h=393&s=23835&e=png&b=ffffff)
    
2.  `程序计数器`的输出到`RAM`，在`取指阶段`，RAM的输出代表一条指令：
    
    ![image_1f91g7qbklktc6e1am514k1q399.png-21.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2e7d1deaa0db49838f3953681c0814d9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=590&h=320&s=21800&e=png&b=ffffff)
    
3.  在`取指阶段`从RAM中读出的指令实际上是在下一个时钟周期，也就是`执行阶段`才真正的被执行，所以我们需要引入一个寄存器来保存在`取指阶段`从RAM中读出的指令，如下图所示：
    
    ![image_1f91g9ac31ffd1tf7jfgo6657jm.png-22.8kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f8017b863df34846bf5eeb96913a3ead~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=670&h=289&s=23307&e=png&b=ffffff)
    
    我们把保存指令的寄存器称作`指令寄存器`（Instruction Register，简称IR）。
    
4.  现在是2个时钟周期执行一条指令，在`执行阶段`的时钟上升沿到来后才会真正的更新`IR寄存器`，而在`取指阶段`的时钟上升沿到达后并不需要更新`IR寄存器`，我们有必要使用带写使能信号的寄存器来制作`IR寄存器`：
    
    ![image_1f91gbtte1katqajba31oe319lb13.png-30.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7e9949a912994b708a79e8f18dab96bc~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=832&h=337&s=31111&e=png&b=ffffff)
    
    如上图所示：
    
    *   在`取指阶段`，STATE=0，令IR\_WE=1,那么在`执行阶段`的时钟信号上升沿到达后，IR寄存器中的指令被更新，在执行阶段执行该指令
        
    *   在`执行阶段`，STATE=1，令IR\_WE=0，那么在`取指阶段`的时钟信号上升沿到达后，IR寄存器中的指令不被更新。
        
5.  因为2个时钟周期执行一条指令，我们需要在`取指阶段`的时钟上升沿到达后更新程序计数器，而在`执行阶段`的时钟信号上升沿到达后不更新程序计数器，所以我们有必要使用带写使能信号的寄存器来制作`程序计数器`：
    
    ![image_1f91gcubeec56jq1j1u12q1cms1g.png-23.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/95cc993681f340d688ce8c67073b8338~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=613&h=368&s=24013&e=png&b=fefefe)
    
    如上图所示：
    
    *   在`取指阶段`，STATE=0，令PC\_WE=0，那么在`执行阶段`的时钟信号上升沿到达后，PC寄存器中的指令地址不被更新。
        
    *   在`执行阶段`，STATE=1，令PC\_WE=1，那么在`取指阶段`的时钟信号上升沿到达后，PC寄存器中的指令地址被更新。
        
6.  在执行阶段，IR寄存器的输出代表着当前需要执行的指令，目前一条指令共占用16个二进制位，其中：
    
    *   8～15位被规划作为操作码，实际使用了8～11位，操作码用opcode表示。
    *   0～7位代表一个立即数，立即数用operand\_imm表示。
    *   0～5位代表一个地址，地址用operand\_addr表示。
    
    如下图所示：
    
    ![image_1f91ggcq013us8qkjdcscv1a0u1t.png-36.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cb961334e5714855b4bf47fcd707ccc1~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=913&h=420&s=37292&e=png&b=fefefe)
    
7.  在执行阶段，执行需要访问RAM的指令时，需要operand\_addr作为RAM的地址输入，这样的话，RAM就有了2个地址输入（程序计数器的输出和operand\_addr），引入一个`2-1选择器`即可解决该问题：
    
    ![image_1f91gmg6e1llk1lnt41l1bvc8ut2a.png-36.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c3b6ca5f20d43b7825a19585a76d070~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=854&h=489&s=37352&e=png&b=fefefe)
    
    很显然：
    
    *   在`取指阶段`，也就是STATE=0时，令RAM\_ADDR\_SEL=0，表明要从RAM中读取指令。
    *   在`执行阶段`，也就是STATE=1时，令RAM\_ADDR\_SEL=1，表明要从RAM中读取数据。
    
    如上图所示，当RAM\_ADDR\_SEL=1时，从RAM中读取的数据共包含16个二进制位，共有两种用途：
    
    *   一是作为ALU的输入B参与运算，比方说add\_m指令就是要从RAM中读出指定地址的数据与累加器中的数据做加法，图中用alu\_b\_value表示。
        
    *   二是作为跳转指令的目的地址，比方说jmp、je指令都需要指定下一条指令的地址，图中用jmp\_addr表示（由于目前的RAM总共有6根地址线，最多支持64个地址，所以我们只选取第0～5位作为跳转地址）。
        
8.  以立即数作为操作数的算术/逻辑运算指令（比方说add\_i）需要将指令中的立即数（也就是operand\_imm）与累加器中的数据进行运算，以RAM地址作为操作数的算术/逻辑运算指令（比方说add\_m）需要从`数据RAM`中读出给定地址的数据（也就是alu\_b\_value）然后与累加器中的数据进行运算。operand\_imm和alu\_b\_value都会被作为ALU的输入B的输入，所以它们需要先通过一个`2-1选择器`然后在与ALU的输入B连起来。不过目前只使用1个64×16的RAM来既存储指令也存储数据，从RAM中读取的数据包含16个二进制位，而operand\_imm只包含7个二进制位，我们需要先将operand\_imm扩展为16个二进制位。我们这里支持有符号数的运算，所以采用符号扩展，如下图所示：
    
    ![image_1f91i9apn4kp4hsgn619ung9n2n.png-36.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7222a35824684706aef005fee11919ee~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=887&h=443&s=37164&e=png&b=fefefe)
    
    > 小贴士：  
    >   
    > 此时ALU的每个输入的位数都是16，也就是说ALU负责对两个16位二进制数进行运算。
    
9.  ALU的输入A来自累加器（简称ACC），在执行完算术/逻辑运算指令后，运算结果应该还写回到累加器中，效果如下图所示：
    
    ![image_1f91id5mi1bq5124q1vj31j4bsh334.png-52.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1c9d63dc8a694f03ba776ca0f95b62d8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1095&h=510&s=53749&e=png&b=fefefe)
    
10.  为支持load指令，需要在ALU的输入A前边加一个`2-1选择器`，如下图所示：
    
    ![image_1f91iekk34ko16u9cf9knp4973h.png-60.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/df25ffc8069c44d7beefb61fe93a6bf0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1166&h=597&s=61750&e=png&b=fefefe)
    
11.  为支持store指令，即将累加器中存储的数据写到`数据RAM`中，累加器的输出应该作为`数据RAM`的数据输入，如下图所示：
    
    ![image_1f91ijn553q099560o1t47i8g4b.png-61.2kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1f8b6c532ed94115a39c7be4410ccbf4~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1190&h=588&s=62696&e=png&b=fefefe)
    
12.  正常情况下，在执行完一条指令后，应该执行地址比当前指令地址大1的新指令，如下图所示：
    
    ![image_1f91imvi8vs919ih1iik7tgn14o.png-47.8kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9a43ab77cb1c481e88b99bb9608a6078~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1051&h=484&s=48914&e=png&b=fefefe)
    
    但是在执行jmp、je等跳转指令时，程序计数器的输入应该为jmp\_addr，此时我们需要引入一个`2-1选择器`，如下图所示：
    
    ![image_1f91j1iu83qa50b18neohk1nco55.png-49.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/499be62a029c4360834ba617350a08a2~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1103&h=492&s=51118&e=png&b=fefefe)
    
13.  在`执行阶段`，ALU的输出是否为0的结果应该作为ZF寄存器的输入，以供之后执行je指令使用。不过在`取指阶段`，ALU的输出是否为0的结果不应写入ZF寄存器，这样我们就得使用带使能信号的寄存器作为ZF寄存器，如下图所示：
    
    ![image_1f91jku0d1i4m138p1t2q1vb1r1j5i.png-54.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9d62e2212c2540bab11b82dafe7c3359~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1236&h=480&s=55621&e=png&b=fefefe)
    

好了，数据在各个部件之间的流动关系我们已经画好了。万事俱备，只欠生成各种设备的控制信号的控制单元了，我们稍后详细说明。

### 控制单元的制作

首先来看我们刚刚引入的3个新设备的控制信号：RAM\_ADDR\_SEL、PC\_WE、IR\_WE应如何生成。前边讨论了RAM\_ADDR\_SEL、PC\_WE、IR\_WE信号和STATE信号之间的关系，如下表所示：

STATE（输入）

PC\_WE（输出）

IR\_WE（输出）

RAM\_ADDR\_SEL（输出）

0（取指状态）

0

1

0

1（执行状态）

1

0

1

我们很容易画出以STATE为输入信号，以RAM\_ADDR\_SEL、PC\_WE、IR\_WE为输出信号的组合电路：

![image_1f91mqgc2pnd8cj1erqegmb886p.png-15.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4d3ff50868e742bd93b1b3d7d89116fc~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=705&h=282&s=15824&e=png&b=ffffff)

我们也可以把上图中通过STATE信号生成这些控制信号的电路称作一个控制单元，不过我们之前的电路里已经有过一个控制单元了，就把上图的电路称作`2号控制单元`吧，赶紧用黑盒子把上图封装起来：

![image_1f91okako10nkf05j1c6ep11hi8q.png-11.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e8b8809ae29450eb4f6b8f7e54d6fd8~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=527&h=248&s=11815&e=png&b=ffffff)

为和刚刚制作的`2号控制单元`做区分，我们将之前在一个时钟周期中执行一条指令时用到的控制单元称为`1号控制单元`，`1号控制单元`长这样（图中未画出HALT信号）：

![image_1f91n0eul17a816141a9a172l168f7j.png-17kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c7caafea48364455baf4b7f823c6a223~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=534&h=246&s=17458&e=png&b=ffffff)

当累加器、RAM、ZF寄存器这些设备的WE信号为逻辑1时，在下一个时钟信号上升沿到来后便会更新它们所存储的值。在`取指阶段`并不真正执行指令，所以需要将这些设备的WE信号全都设置为逻辑0，在`执行阶段`这些设备的WE信号是由`1号控制单元`产生的，也就是我们期望：

*   在`取指阶段`，也就是STATE=0时，RAM\_WE、ACC\_WE、ZF\_WE保持为逻辑0不变。
*   在`执行阶段`，也就是STATE=1时，RAM\_WE、ACC\_WE与`1号控制单元`输出的RAM\_WE、ACC\_WE一致，ZF\_WE信号为逻辑1。

所以我们可以用下图所示的方式将`1号控制单元`和`2号控制单元`连接起来：

![image_1f91omhdq1urj1m71not5611rif97.png-31.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7699a68074f3432584e31133d45144c9~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=740&h=561&s=32302&e=png&b=fefefe)

其中的`STATE`信号是通过`状态生成器`生成的，我们也把`状态生成器`也画出来：

![image_1f91on88h13g14s4uvg2dl1iuu9k.png-39.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f807ce6354aa4271bc7cc2ca417fdedb~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=925&h=564&s=40013&e=png&b=fefefe)

老规矩，上边的图太复杂了，我们把`1号控制单元`、`2号控制单元`和`状态生成器`合并为一个大的`控制单元`，那么这个`控制单元`的示意图就如下所示：

![image_1f91osgr41ks1t1qjc9ba61bb8a1.png-20.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6521669d84a748af9270242697465b7a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=449&h=398&s=20572&e=png&b=fefefe)

赶紧把这个复杂的`控制单元`放到电路中吧：

![image_1f91png4eb531r9p1lpi1apd5k9ae.png-60.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b0accd4d4c7640fdbbf8e704698f8a99~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=1244&h=611&s=61716&e=png&b=fefefe)

终于，终于，终于完成了本章，深呼吸一口气，继续往下看吧~