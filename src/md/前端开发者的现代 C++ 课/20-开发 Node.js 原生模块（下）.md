在上一节中我们介绍了如何搭建 Node.js 原生模块的开发环境，在搭建环境的时候，我们依据 node-addon-api 的接口完成了一个简单的原生模块，不过当时我们并没有详细介绍那个示例代码所涉及的知识，本节我们就详细介绍一下这些知识。除此之外，我们还会介绍如何在原生模块中接收输入数据、返回数据、抛出异常、使用异步方法以及各种数据类型的相互转换等知识。

入门示例介绍
------

现在我们来详细介绍一下上一节的示例代码：

    #include <napi.h>
    Napi::String Hello(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        return Napi::String::New(env, "world"); //返回一个js字符串
    }
    Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        //公开hello方法
        exports.Set(Napi::String::New(env, "hello"), Napi::Function::New(env, Hello));
        return exports;
    }
    NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
    

首先在 `NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)` 这行代码中， `NODE_API_MODULE` 这个宏方法定义了原生模块的入口函数，当 Node.js 加载该模块时，将执行 Init 方法，`NODE_GYP_MODULE_NAME` 宏展开后为配置文件 `binding.gyp` 中的 `target_name`。

`Init` 方法是原生模块的入口函数，这个函数包含两个参数（Node.js 调用此函数时会输入这两个参数），第一个参数是 JavaScript 运行时环境对象，第二个是模块的导出对象（也就是 `module.exports`），我们可以给这个对象设置属性以导出我们想要暴露给外部的内容，此处我们导出了 hello 方法，当测试代码执行`obj.hello()`语句时，原生模块内的 Hello 方法将被调用。入口函数 Init 退出时应把 exports 对象返回给 Node.js。

Hello 方法执行时调用方会传入一个 `CallbackInfo` 类型的参数，它是一个由 Node.js 传入的对象，该对象包含 JavaScript 调用此方法时的输入参数，可以通过这个对象的 `Env` 方法获取 JavaScript 运行时环境对象。

`String` 对象的静态方法 `New` 创建一个 JavaScript 字符串，它的第一个参数是 JavaScript 运行时环境对象，也就是说，创建 JavaScript 字符串时要指明这个字符串被使用的环境。

这个示例代码并不具备什么特殊的功能，只做了简单的数据输出，接下来我们就通过几个示例来了解更多 C++ 语言开发 Node.js 原生模块的细节。

输入参数、返回值与异常信息
-------------

首先在 Init 方法中增加如下语句，为我们的原生模块导出一个新方法：add。

    exports.Set(Napi::String::New(env, "add"), Napi::Function::New(env, Add));
    

这个 add 方法指向原生代码的 Add 方法，Add 方法的实现代码如下所示：

    Napi::Value Add(const Napi::CallbackInfo& info)
    {
        Napi::Env env = info.Env();
        //判断参数个数，如果参数个数小于2则抛出异常    
        if (info.Length() < 2)
        {
            Napi::TypeError::New(env, "Wrong arguments numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
        double result = 0;
        //遍历所有输入参数
        for (int i = 0; i < info.Length(); i++)
        {
            //如果输入参数类型不是数字类型，则抛出异常
            if (!info[i].IsNumber())
            {
                Napi::TypeError::New(env, "Wrong arguments type").ThrowAsJavaScriptException();
                return env.Null();
            }
            //格式化输入参数为浮点类型并累加
            double arg = info[i].As<Napi::Number>().DoubleValue();
            result += arg;
        }
        //把累加结果返回给调用者
        Napi::Number resultVal = Napi::Number::New(env, result);
        return resultVal;
    }
    

这个方法可以接收一系列的数字型参数，参数数量不小于 2，如果参数数量小于 2 则报 `Wrong arguments numbers` 的异常。如果某个参数类型不是数字类型，则报 `Wrong arguments type` 错误的异常。最终所有参数累加求和，并把结果返回给调用者。

在上面的代码中我们使用 `info.Length()` 获取参数数量，使用 `info[i]` 获取具体位置的参数，每个参数都是一个 `Napi::Value` 类型的对象，我们可以对参数执行 `IsNumber` 方法来判断参数对象内保存的值是否为数字类型，也可以对参数执行 `As<Napi::Number>()` 模板方法把参数转型成 `Napi::Number` 类型的对象，再调用 `Napi::Number` 对象上的 DoubleValue 方法把参数的值转化为 C++ 的 double 类型。 由于 JavaScript 只有一种数字类型 Number，所以调用者有可能传递了整型数字，也有可能传递了浮点型数字，为了方便我们这里把参数统一转型为浮点型数字再做运算。

运算完成之后，我们把运算结果存入了一个 `Napi::Number` 类型的对象中，并把这个对象返回给调用者。

接下来编译原生模块并补充一下测试代码以验证上述方法的准确性：

    console.log("add", obj.add(1, 2, 3, 4, 5, 6, 7, 8, 9)); //输出add 45
    // console.log("add", addon.add());
    // console.log("add", addon.add("aabb", "ddcc"));
    

测试代码中第一行会打印 add 45，第二行会报错：

    TypeError: Wrong arguments numbers
        at C:\Users\Administrator\Desktop\native\test\test.js:10:26
        at [_onLine] [as _onLine] (node:internal/readline/interface:423:7)
        at [_line] [as _line] (node:internal/readline/interface:886:18)
        at [_ttyWrite] [as _ttyWrite] (node:internal/readline/interface:1264:22)
        at ReadStream.onkeypress (node:internal/readline/interface:273:20)
        at ReadStream.emit (node:events:513:28)
        at emitKeys (node:internal/readline/utils:357:14)
        at emitKeys.next (<anonymous>)
        at ReadStream.onData (node:internal/readline/emitKeypressEvents:64:36)
        at ReadStream.emit (node:events:513:28)
    
    Node.js v18.12.1
    

第三行代码会报错：

    TypeError: Wrong arguments type
        at C:\Users\Administrator\Desktop\native\test\test.js:11:26
        at [_onLine] [as _onLine] (node:internal/readline/interface:423:7)
        at [_line] [as _line] (node:internal/readline/interface:886:18)
        at [_ttyWrite] [as _ttyWrite] (node:internal/readline/interface:1264:22)
        at ReadStream.onkeypress (node:internal/readline/interface:273:20)
        at ReadStream.emit (node:events:513:28)
        at emitKeys (node:internal/readline/utils:357:14)
        at emitKeys.next (<anonymous>)
        at ReadStream.onData (node:internal/readline/emitKeypressEvents:64:36)
        at ReadStream.emit (node:events:513:28)
    
    Node.js v18.12.1
    

从测试代码的运行结果来看是符合我们的预期的。

异步方法
----

Node.js 框架有自己内置的异步机制，接下来我们就介绍如何在原生模块中使用 Node.js 内置的异步机制完成异步任务。

首先再为我们的原生模块暴露一个方法：asyncMethod，如下代码所示：

    exports.Set(Napi::String::New(env, "asyncMethod"), Napi::Function::New(env, AsyncMethod));
    

这个方法对应的 C++ 方法实现代码为：

    //#include "MyWorker.h" //引入自定义异步处理对象头文件
    
    Napi::Value AsyncMethod(const Napi::CallbackInfo& info)
    {
        Napi::Env env = info.Env();
        //接收Object类型的参数
        Napi::Object runInfo = info[0].As<Napi::Object>();
        //此Object类型的参数必定包含timeSpan和callBack两个属性
        if (runInfo.Get("timeSpan").IsNothing() || runInfo.Get("callBack").IsNothing()) {
            Napi::TypeError::New(env, "Wrong arguments Type").ThrowAsJavaScriptException();
            return env.Null();
        }
        //timeSpan属性为数字类型
        int timeSpan = runInfo.Get("timeSpan").Unwrap().As<Napi::Number>();
        //callBack属性为回调方法类型
        Napi::Function callback = runInfo.Get("callBack").Unwrap().As<Napi::Function>();
        //实例化自定义的异步处理对象，把timeSpan和callBack传递给异步处理对象
        MyWorker* asyncWorker = new MyWorker(callback, timeSpan);
        //开始执行异步任务
        asyncWorker->Queue();
        //返回一个对象，此对象包含msg属性，msg属性的值为字符串please wait...
        Napi::Object obj = Napi::Object::New(env);
        obj.Set(Napi::String::New(env, "msg"), Napi::String::New(env, "please wait..."));
        return obj;
    };
    

这个方法接收一个 Object 类型的参数，参数中必须包含 `timeSpan` 和 `callBack` 两个属性，如果不包含这两个属性的话，会抛出异常：Wrong arguments Type。

`timeSpan` 是异步方法的执行时间，`callBack` 是异步方法的回调函数，这两个数据被传递给我们自定义的一个对象：`asyncWorker`， 此对象继承自`Napi::AsyncWorker`类型，实现代码如下所示：

    //头文件 src\MyWorker.h
    #pragma once
    #include <napi.h>
    class MyWorker : public Napi::AsyncWorker
    {
    public:
        MyWorker(Napi::Function &callback, int runTime);
        virtual ~MyWorker(){};
        void Execute();
        void OnOK();
    private:
        int runTime;
    };
    

    //实现文件 src\MyWorker.cc
    #include "MyWorker.h"
    #include <chrono>
    #include <thread>
    
    
    //构造函数，初始化列表中初始化基类AsyncWorker对象
    MyWorker::MyWorker(Napi::Function &callback, int runTime)
        : AsyncWorker(callback), runTime(runTime){};
    
    
    //执行异步方法，此方法执行完成后会调用OnOK方法
    void MyWorker::Execute()
    {
        std::this_thread::sleep_for(std::chrono::seconds(runTime));
        if (runTime == 4)
        {
            SetError("failed after 'working' 4 seconds.");
        }
    };
    
    //异步方法执行完成
    void MyWorker::OnOK()
    {
        //创建一个数组对象
        Napi::Array arr = Napi::Array::New(Env(),3);
        arr.Set(Napi::Number::New(Env(), 0), Napi::String::New(Env(), "test1"));
        arr.Set(Napi::Number::New(Env(), 1), Napi::String::New(Env(), "test1"));
        arr.Set(Napi::Number::New(Env(), 2), Napi::Number::New(Env(), 123));
        //把数组对象传递给回调方法
        Callback().Call({Env().Null(), arr});
    };
    

当 asyncWorker 对象调用了 `Napi::AsyncWorker` 基类定义的 `Queue` 方法之后，Node.js 框架会检查当前是否有可用的线程，如果有，则调用 asyncWorker 对象的 `Execute` 方法，如果没有则等待。

在执行 `Execute` 方法时，我们使此线程等待了指定的时间（runTime），这个时间是调用者指定的，如果调用者指定的时间为 4 秒钟的话，则设置一个异常信息。

当 Execute 方法执行完成后，Node.js 框架会调用 asyncWorker 对象的 `OnOK` 方法或 `OnError` 方法，如果 Execute 方法执行时通过 `SetError` 方法设置了异常信息，则调用 `OnError` 方法（这里我们没有实现这个方法，Node.js 将执行基类的实现逻辑）。

如果没有异常信息，则调用 `OnOK` 方法，此时我们执行了回调函数，并向回调函数传递了一个数组对象。OnOK 方法或 OnError 方法中的任一个执行完成后，asyncWorker 对象将被销毁。

由于 asyncWorker 对象的 Queue 方法是异步执行的不会阻塞，所以我们在触发异步线程任务之后，马上给调用者返回了一个对象，这个对象只有一个 `msg` 属性，值为字符串：`please wait...`（此处并没有实际意义，只是为了演示如何使用 C++ 代码创建并返回 JavaScript 对象）。

添加了新类型的头文件和实现文件之后，我们要在 `binding.gyp` 的 `sources` 配置节中配置这两个文件，如下代码所示：

    "sources": [ "src/main.cc", "src/MyWorker.cc","src/MyWorker.h"],
    

再为 main.cc 引入 MyWorker 的头文件 `#include "MyWorker.h"`。

然后重新执行 `node-gyp configure` 指令以配置 Visual Studio 解决方案，让解决方案包含这两个文件。完成这些工作后重新编译项目，生成新的原生模块。

接下来我们撰写测试异步方法的代码：

    let param = {
      timeSpan: 6,
      callBack: (err, result) => {
        if (err) {
          console.log("callback an error: ", err);
        } else {
          console.log("callback array:" + result);
        }
      },
    };
    let result = obj.asyncMethod(param);
    console.log("asyncMethod", result);
    param.timeSpan = 4;
    result = obj.asyncMethod(param);
    console.log("asyncMethod", result);
    

在这段测试代码中，我们两次调用了 asyncMethod 方法，第一次要求异步方法执行 6 秒钟，第二次要求异步方法执行 4 秒钟（执行 4 秒钟时会触发异常，我们就是为了看这个异常信息）。

运行测试代码后输出：

    asyncMethod { msg: 'please wait...' }
    asyncMethod { msg: 'please wait...' }
    callback an error:  [Error: failed after 'working' 4 seconds.]
    callback array:test1,test1,123
    

从输出结果看，asyncMethod 方法是异步执行的，而且 4 秒钟的异步调用先执行，也确实打印了错误信息，6 秒钟的异步调用后执行，打印了出了我们在 C++ 代码中返回的对象，说明测试结果符合预期。

兼容多个系统
------

我们可以为工程添加预处理器，来为不同的操作系统提供不同的编译条件，但更好的办法是使用 node-gyp 的配置文件来为不同的系统设置不同的编译选项，如下代码所示：

    "targets": [
    {
        //....
        "conditions": [
                [
                    'OS=="mac"',
                    {
                        "sources": ["YourCode.mm"],
                        "link_settings": {
                            "libraries": ["-framework Cocoa", "-framework CoreFoundation"]
                        },
                        "xcode_settings": {
                            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                            "CLANG_ENABLE_OBJC_ARC": "YES",
                            "OTHER_CFLAGS": ["-ObjC++", "-std=c++17"]
                        }
                    }
                ],
                [
                    'OS=="win"',
                    {
                        "sources": ["YourCode.cc"],
                        "libraries": ["Shlwapi.lib", "Shcore.lib"],
                        "msvs_settings": {
                            "VCCLCompilerTool": {
                                "AdditionalOptions": ["/std:c++17"]
                            }
                        }
                    }
                ]
            ]
    }]
    

上述配置项中 conditions 是编译条件数组，数组中存在两个配置项，一个是为 Mac 操作系统设置的配置项，一个是为 Windows 操作系统设置的配置项，你可以通过这些配置项为工程添加不同的源代码（YourCode.cc、YourCode.mm）、依赖库以及开发工具编译选项。

总结
--

我们通过本章的内容介绍了一些开发 Node.js 原生模块的进阶知识。

首先我们介绍了在原生模块中接收 JavaScript 传入参数以及把原生模块的数据返回给 JavaScript 调用者的知识（还包括原生模块制造异常、JavaScript 接收异常的知识哦）。

接着我们讲解了如何为原生模块实现异步方法（要实现一个继承自 `Napi::AsyncWorker` 的自定义类型），最后还分析了如何让原生模块兼容不同的操作系统（在 node-gyp 的配置文件配置条件编译选项）。

当然这两节内容无法涵盖 Node.js 原生模块开发的所有知识，如果大家要开发更复杂的 Node.js 原生模块，推荐大家深入学习 [Node-API](https://nodejs.org/dist/latest/docs/api/n-api.html#node-api "https://nodejs.org/dist/latest/docs/api/n-api.html#node-api") 和 [node-addon-api](https://github.com/nodejs/node-addon-api "https://github.com/nodejs/node-addon-api") 的官方文档。