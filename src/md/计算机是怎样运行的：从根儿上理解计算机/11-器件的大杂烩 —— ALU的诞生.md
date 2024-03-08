第12章、ALU的诞生
===========

标签： 计算机是怎样运行的

* * *

截止到目前为止，我们已经唠叨了很多电路结构，比方说各种逻辑门，半加器、全加器、n位加法器等等等等。这些电路都有一个特点：任意时刻的输出仅仅取决于该时刻的输入，与电路原来的输出无关（当然，当输入改变时，会经过一段传输延迟时间后，输出才会改变），我们称这种类型的电路为`组合电路`（`Combinational Circuit`）。

> 小贴士：  
>   
> 与组合电路对应的是时序电路（Sequential Circuit），这是一种任意时刻的输出不仅仅取决于该时刻的输入，还与电路原来的输入有关的电路，我们之后会详细唠叨～

在设计完组合电路的结构之后，我们一般都把组合电路看成是一个黑盒子，只露出输入和输出的导线，就像这样：

![image_1duhji5661lg517linea1un21uamm.png-37.6kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3590c471a1dc4861b72f6ba066b8edc7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=819&h=205&s=38476&e=png&b=fefefe)

如图所示，图中的组合电路接受`n`个输入信号，产生`m`个输出信号。输出信号和输入信号的逻辑关系可以用下边的一组逻辑函数表示。

Y1\=F1(A1,A2,A3,...,An)Y\_1 = F\_1(A\_1, A\_2, A\_3, ..., A\_n)Y1​\=F1​(A1​,A2​,A3​,...,An​)

Y2\=F2(A1,A2,A3,...,An)Y\_2 = F₂(A\_1, A\_2, A\_3, ..., A\_n)Y2​\=F2​(A1​,A2​,A3​,...,An​)

.........

Ym\=Fm(A1,A2,A3,...An)Y\_m = F\_m(A\_1, A\_2, A\_3, ... A\_n)Ym​\=Fm​(A1​,A2​,A3​,...An​)

接下来我们再介绍几种比较重要的组合电路。

按位与运算
-----

假设`A`代表n位二进制数`An-1An-2...A₂A₁A₀`、`B`代表n位二进制数`Bn-1Bn-2...B₂B₁B₀`。我们想让`A`和`B`做按位与运算，其实就是为`An-1`和`Bn-1`做与运算得到结果`Yn-1`、`An-2`和`Bn-2`做与运算得到结果`Yn-2`、...、`A₂`和`B₂`做与运算得到结果`Y₂`、`A₁`和`B₁`做与运算得到结果`Y₁`、`A₀`和`B₀`做与运算得到结果`Y₀`，最后将每个位进行与运算的结果拼接为`Yn-1Yn-2...Y₂Y₁Y₀`就是最终的运算结果。这个过程很容易用电路实现：

![image_1eqae3abp1ncsd1f10p91pj6jin13.png-39.9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cb5f15b463694520854e242678377b4a~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=562&h=561&s=40891&e=png&b=fefefe)

还是老套路，这个图太复杂了，我们简化一下（为了和与门区分开，我们在与门符号中加了`按位与`三个字）：

![image_1eqadkijp1k7d1sqd67ut0knrom.png-16.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/10fc4d7f557a4c5eab20d4cfd97642a0~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=662&h=189&s=16641&e=png&b=ffffff)

以后我们就用上图来表示两个n位二进制数`A`、`B`进行按位与运算，得到结果`Y`的过程（`Y`也是一个n位二进制数）。类似`+`代表加法的运算符号，`-`代表减法的运算符号，`按位与`也是一种运算类型，我们使用`&`表示按位与运算的运算符号。那么A和B进行按位与运算得到结果Y的过程可以表示为：

    Y = A & B
    

按位或运算
-----

同理，我们也可以为A、B这两个n位二进制数做`按位或`运算，电路图如下：

![image_1eqae7c1l7pk1hb4tvrph71thh20.png-46.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/edc781f4a57846ada347426938767581~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=550&h=574&s=47419&e=png&b=fefefe)

继续老套路，这个图太复杂了，我们简化一下（为了和或门区分开，我们在或门符号中加了`按位或`三个字）：

![image_1eqae9qjq1944hbuvb67r01ndv2d.png-17.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f053e0e728b74ccca936155cad31ee4b~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=649&h=179&s=18158&e=png&b=fefefe)

以后我们就用上图来表示两个n位二进制数`A`、`B`进行按位或运算，得到结果`Y`的过程（`Y`也是一个n位二进制数）。我们使用`|`表示按位或运算的运算符号。那么A和B进行按位或运算得到结果Y的过程可以表示为：

    Y = A | B
    

数据选择器
-----

有时候我们会有从多个输入信号中选出一个作为输出信号的需求，比方现在要从`A₀`、`B₀`两个输入信号中选出一个作为输出信号`Y₀`，具体该怎么实现呢？我们可以画这样的一个电路图：

![image_1eqc7q4ag1ogm1cl47opov4j4541.png-9.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/39b47259683d469ba2db5503d79088e3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=397&h=211&s=9543&e=png&b=ffffff)

那么：

*   当开关1闭合，开关2断开时，Y₀ = A₀，如下图所示：
    
    ![image_1eqc82pum15dr1l8jbu91e7s1dur4e.png-9kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ee78e6879c0a4cca8cf04595ba7d9c0e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=414&h=208&s=9213&e=png&b=ffffff)
    
*   当开关1断开，开关2闭合时，Y₀ = B₀，如下图所示：
    
    ![image_1eqc8338v1i4g1jeeg0vfvhs9i4r.png-8.6kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/22c9a550e50d4368a98a3c055d24ce9c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=373&h=201&s=8818&e=png&b=ffffff)
    

接下来又是老生常谈，我们用手去拨动开关就太low了，还是使用之前介绍过的`传输门`作为电控开关来替代一下机械开关。我们使用`TG1`来替代原先的`开关1`，`TG2`来替代原先的`开关2`（TG是Transmission Gate的缩写）。由于`开关1`和`开关2`必须有且仅有一个闭合，另一个断开，所以两个传输门的控制信号必须得相反。如下图所示：

![image_1eqc9dftjmptm8d1qlf40v19v258.png-9.2kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e8fea43ff3ef47c6b1e667fa1e90a1a3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=530&h=260&s=9470&e=png&b=ffffff)

图中的线太多了，我们省略一下图中的连接线以及反相器，使用S₀‾\\overline{\\text{S₀}}S₀作为S₀通过反相器后的信号，简化后的图如下所示：

![image_1eqcbcl74ocl1odd19sr1qouq806v.png-8.4kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/70b9368801cb4839b8b72961d77b0d16~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=359&h=282&s=8577&e=png&b=ffffff)

那么

*   当S₀=0时，TG1导通，TG2截止，此时Y₀ = A₀。
*   当S₀=1时，TG1截止，TG2导通，此时Y₀ = B₀。

由于S₀是用来控制Y₀到底是与A₀相同还是与B₀相同的，所以S₀也被称作`控制信号`，也可以被称作`数据选择信号`。

老规矩，上边的图还是太复杂，我们需要画一个简化的示意图：

![image_1eqcadcnm1kc811sm100p1gb1ffn65.png-8.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14ecfa096c4048fcbf7baf3c66779c6d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=436&h=287&s=8456&e=png&b=ffffff)

上图中的设备被称作`数据选择器`，简称选择器，或者也可以叫做多路开关、复用器等。由于上图所示的数据选择器完成了从两个输入信号里选择一个作为输出信号的功能，所以更准确地来讲，它应该被称为`2-1选择器`。`2-1选择器`完成的功能如下：

*   当S₀=0，Y₀=A₀
*   当S₀=1，Y₀=B₀

当然，我们不仅仅能制作从两个信号中选择一个作为输出的`2-1选择器`，也可以制作从两组信号中选择一组作为输出的`2-1选择器`。比方说我们现在有两组输入信号：`An-1An-2...A₂A₁A₀`和`Bn-1Bn-2...B₂B₁B₀`，我们想从中选择一组作为输出`Yn-1Yn-2...Y₂Y₁Y₀`，那么可以这样画电路图：

![image_1fs5it3o9u9519g413ob1r6j1ojh9.png-18.1kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/559174236d15452c9b2cdd8492a3978d~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=433&h=549&s=18504&e=png&b=ffffff)

从图中我们可以看出来：

*   当S₀=0时，`Yn-1Yn-2...Y₂Y₁Y₀`的值和`An-1An-2...A₂A₁A₀`相同；
*   当S₀=1，`Yn-1Yn-2...Y₂Y₁Y₀`的值和`Bn-1Bn-2...B₂B₁B₀`相同。

为了简便，我们用`A`来代表`An-1An-2...A₂A₁A₀`，用`B`代表`Bn-1Bn-2...B₂B₁B₀`，用`Y`代表`Yn-1Yn-2...Y₂Y₁Y₀`，来简化一下上边的电路图：

![image_1eqcfaucuf0koi17i015ipohk8m.png-14.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eeeb6e79c3ed45f49dc209149c06b58e~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=560&h=280&s=14890&e=png&b=ffffff)

通过一个控制信号`S₀`可以制作出`2-1选择器`，如果我们增加一个控制信号`S₁`，也就是两个控制信号`S₀`和`S₁`就可以制造出一个`4-1选择器`，也就是从4组信号中选择一组来作为输出，如图所示：

![image_1f87m5vmi1kfcbqh1d4e1f3ls2vc.png-17.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cb651c061d0c4015925f95d78dbcc97c~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=595&h=416&s=18098&e=png&b=fefefe)

通过这个电路我们可以实现：

*   当`S₁=0, S₀=0`时，`Y=A`。
    
*   当`S₁=0, S₀=1`时，`Y=B`。
    
*   当`S₁=1, S₀=0`时，`Y=C`。
    
*   当`S₁=1, S₀=1`时，`Y=D`。
    

我们可以简化一下这个`4-1`复用器的电路结构：

![image_1eqcg8ponuem1o5u19p7841ddk9g.png-18.3kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/65c42086cee84fb9a5472c2687479ac3~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=509&h=279&s=18750&e=png&b=fefefe)

其实我们还可以通过3个控制信号来设计一个`8-1`复用器，通过4个控制信号来设计一个`16-1`复用器，不过我们就不多唠叨了，大家可以自己试试～

ALU
---

上边已经介绍了很多电路结构了，如果我们把它们都组合到一起将会发生一些神奇的事情，如图所示：

![image_1eqefqv116v21m9d1rbe16rg1sev9t.png-45.5kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d46b46e78e9446718164c74be7337cba~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=753&h=647&s=46541&e=png&b=ffffff)

其中`A`、`B`分别表示两组输入信号（每组中包含n个信号），`S₁`和`S₀`作为`4-1`复用器的控制信号，并且`S₀`还作为`n位加法器`的`Cin`信号，决定着`n位加法器`是执行加法运算还是减法运算，`Y`表示一组输出信号（也包含n信号）。`Y`的值取决于`S₁`和`S₀`的值：

*   当`S₁=0, S₀=0`时，`n位加法器`的`Cin`输入为0，表示执行加法操作，并且`4-1`复用器输出的是`n位加法器`的输出，也就是此时`Y`的值相当于`A + B`的值。
    
*   当`S₁=0, S₀=1`时，`n位加法器`的`Cin`输入为1，表示执行减法操作，并且`4-1`复用器输出的是`n位加法器`的输出，也就是此时`Y`的值相当于`A - B`的值。
    
*   当`S₁=1, S₀=0`时，`4-1`复用器输出的是`按位与`电路结构的输出，也就是此时`Y`的值相当于`A & B`的值。
    
*   当`S₁=1, S₀=1`时，`4-1`复用器输出的是`按位或`电路结构的输出，也就是此时`Y`的值相当于`A | B`的值。
    

也就是对于同样的输入`A`和`B`，随着我们调节控制信号`S₁`和`S₀`的值，最终的输出`Y`也跟着改变，代表着`A`和`B`之间不同的运算结果。加法和减法属于算术运算，按位与和按位或属于逻辑运算，我们把这种用来对输入信号做算数或者逻辑运算的电路结构称之为`算术逻辑单元`，英文名：`Arithmetic/Logical Unit`，简称`ALU`。当然，这个电路结构太复杂，我们简化一下（ALU的简化示意图和2-1选择器的简化示意图有点儿像，所以我们在图中特意写了`ALU`来做区分）：

![image_1eqju2792ipr1est1pklj0h155t9.png-14.7kB](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/347c20973d9f45fdb46813a695b82a89~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=523&h=282&s=15024&e=png&b=ffffff)

哇唔，好简单的一个图！我们已经不需要去管这个`ALU`底层到底是怎么实现的了，现在只需要知道`ALU`只是一个大的组合电路，对于给定的输入`A`和`B`来说，我们只要调节控制信号`S₁`和`S₀`的值，输出`Y`就代表着`A`和`B`之间不同种类的运算结果。当然，我们也可以通过多增加一些控制信号，来制作出一些更复杂的`ALU`，从而支持更多`A`和`B`之间运算类型。

各位小伙伴，有没有再次感受到`抽象`的强大作用！