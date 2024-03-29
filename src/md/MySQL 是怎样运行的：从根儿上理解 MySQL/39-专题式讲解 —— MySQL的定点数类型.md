MySQL的定点数类型
===========

标签： MySQL是怎样运行的

* * *

上一篇文章我们唠叨了浮点数，知道了浮点数存储小数是不精确的。本篇继续唠叨一下MySQL中的另一种存储小数的方式 —— 定点数。

### 定点数类型

正因为用浮点数表示小数可能会有不精确的情况，在一些情况下我们必须保证小数是精确的，所以设计`MySQL`的大叔们提出一种称之为`定点数`的数据类型，它也是存储小数的一种方式：

|类型|占用的存储空间（单位：字节）|取值范围| |:--:|:--:|:--:|:--:| |`DECIMAL(M, D)`|取决于M和D|取决于M和D|

其中：

*   `M`表示该小数最多需要的十进制有效数字个数。
    
    注意是`有效数字`个数，比方说对于小数`-2.3`来说有效数字个数就是2，对于小数`0.9`来说有效数字个数就是`1`。
    
*   `D`表示该小数的小数点后的十进制数字个数。
    
    这个好理解，小数点后有几个十进制数字，`D`的值就是什么。
    

举个例子看一下，设置了`M`和`D`的单精度浮点数的取值范围的变化：

类型

取值范围

`DECIMAL(4, 1)`

\-999.9~999.9

`DECIMAL(5, 1)`

\-9999.9~9999.9

`DECIMAL(6, 1)`

\-99999.9~99999.9

`DECIMAL(4, 0)`

\-9999~9999

`DECIMAL(4, 1)`

\-999.9~999.9

`DECIMAL(4, 2)`

\-99.99~99.99

可以看到，在D相同的情况下，M越大，该类型的取值范围越大；在M相同的情况下，D越大，该类型的取值范围越小。当然，`M`和`D`的取值也不是无限大的，`M`的取值范围是`1~255`，`D`的取值范围是`0~30`，而且`D`的值必须不大于`M`。`M`和`D`都是可选的，如果我们省略了它们，那它们的值按照机器支持的最大值来存储。

我们说定点数是一种精确的小数，为了达到精确的目的我们就不能把它转换成二进制小数之后再存储(因为有很多十进制小数转为二进制小数后需要进行舍入操作，导致二进制小数表示的数值是不精确的)。其实转念一想，所谓的小数只是把两个十进制整数用小数点分割开来而已，我们只要把小数点左右的两个十进制整数给存储起来，那不就是精确的了么。比方说对于十进制小数`2.38`来说，我们可以把这个小数的小数点左右的两个整数，也就是`2`和`38`分别保存起来，那么不就相当于保存了一个精确的小数么，这波操作是不是很6。

当然事情并没有这么简单，对于给定`M`、`D`值的`DECIMAL(M, D)`类型，比如`DEMCIMAL(16, 4)`来说：

*   首先确定小数点左边的整数最多需要存储的十进制位数是12位，小数点右边的整数需要存储的十进制位数是4位，如图所示：
    
    ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9d4ea87b2c864dabbc8ae2cc56aad5ed~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=785&h=507&s=64207&e=png&b=ffffff)
    
*   从小数点位置出发，每个整数每隔9个十进制位划分为1组，效果就是这样：
    
    ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/38c24df435d449e3aea6e788da439fa7~tplv-k3u1fbpfcp-jj-mark:1600:0:0:0:q75.image#?w=970&h=268&s=26709&e=png&b=fefefe)
    
    从图中可以看出，如果不足9个十进制位，也会被划分成一组。
    
*   针对每个组中的十进制数字，将其转换为二进制数字进行存储，根据组中包含的十进制数字位数不同，所需的存储空间大小也不同，具体见下表：
    
    组中包含的十进制位数
    
    占用存储空间大小（单位：字节）
    
    1或2
    
    1
    
    3或4
    
    2
    
    5或6
    
    3
    
    7或8或9
    
    4
    
    所以`DECIMAL(16, 4)`共需要占用`8`个字节的存储空间大小，这8个字节由下边3个部分组成：
    
    *   第1组包含3个十进制位，需要使用2个字节存储。
    *   第2组包含9个十进制位，需要使用4个字节存储。
    *   第3组包含4个十进制位，需要使用2个字节存储。
*   将转换完成的比特位序列的最高位设置为1。
    

这些步骤看的有一丢丢懵逼吧，别着急，举个例子就都清楚了。比方说我们使用定点数类型`DECIMAL(16, 4)`来存储十进制小数`1234567890.1234`，这个小数会被划分成3个部分：

    1 234567890 1234
    

也就是：

*   第1组中包含整数`1`。
*   第2组中包含整数`234567890`。
*   第3组中包含整数`1234`。

然后将每一组中的十进制数字转换成对应的二进制数字：

*   第1组占用2个字节，整数`1`对应的二进制数就是（字节之间实际上没有空格，只不过为了大家理解上的方便我们加了一个空格）：
    
        00000000 00000001
        
    
    二进制看起来太难受，我们还是转换成对应的十六进制看一下：
    
        0x0001
        
    
*   第2组占用4个字节，整数`234567890`对应的十六进制数就是：
    
        0x0DFB38D2
        
    
*   第3组占用2个字节，整数`1234`对应的十六进制数就是：
    
        0x04D2
        
    

所以将这些十六进制数字连起来之后就是：

    0x00010DFB38D204D2
    

最后还要将这个结果的最高位设置为1，所以最终十进制小数`1234567890.1234`使用定点数类型`DECIMAL(16, 4)`存储时共占用8个字节，具体内容为：

    0x80010DFB38D204D2
    

有的同学会问，如果我们想使用定点数类型`DECIMAL(16, 4)`存储一个负数怎么办，比方说`-1234567890.1234`，这时只需要将`0x80010DFB38D204D2`中的每一个比特位都执行一个取反操作就好，也就是得到下边这个结果：

    0x7FFEF204C72DFB2D
    

从上边的叙述中我们可以知道，对于`DECIMAL(M, D)`类型来说，给定的`M`和`D`的值不同，所需的存储空间大小也不同。可以看到，与浮点数相比，定点数需要更多的空间来存储数据，所以如果不是在某些需要存储精确小数的场景下，一般的小数用浮点数表示就足够了。

对于定点数类型`DECIMAL(M, D)`来说，`M`和`D`都是可选的，默认的`M`的值是10，默认的`D`的值是0，也就是说下列等式是成立的：

    DECIMAL = DECIMAL(10) = DECIMAL(10, 0)
    DECIMAL(n) = DECIMAL(n, 0)
    

另外`M`的范围是`1~65`，`D`的范围是`0~30`，且`D`的值不能超过`M`。