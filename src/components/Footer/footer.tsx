"use client";
import React, { FC, useEffect, useState } from "react";
import styles from "./footer.module.css";
import moment from "moment";
interface MyComponentProps {
  title: string;
  className: string;
}

const Header: FC<MyComponentProps> = ({ title, className }) => {
// const [runtime_span,setRuntime] = useState('')
  
//   const show_runtime = () => {
//     X = new Date("10/24/2019 10:52:50");
//     Y = new Date();
//     T = Y.getTime() - X.getTime();
//     M = 24 * 60 * 60 * 1000;
//     a = T / M;
//     A = Math.floor(a);
//     b = (a - A) * 24;
//     B = Math.floor(b);
//     c = (b - B) * 60;
//     C = Math.floor((b - B) * 60);
//     D = Math.floor((c - C) * 60);
//     console.log("网站已在风雨中运行:" + A + "天" + B + "小时" + C + "分" + D + "秒",'"网站已在风雨中运行:" + A + "天" + B + "小时" + C + "分" + D + "秒"')
//     setRuntime(() => "网站已在风雨中运行:" + A + "天" + B + "小时" + C + "分" + D + "秒")
//     // runtime_span =
//     //   "网站已在风雨中运行:" + A + "天" + B + "小时" + C + "分" + D + "秒";
//   };
//   setTimeout(() => show_runtime, 1000);

  return (
    <footer className={className}>
      朝阳 ©{new Date().getFullYear()} 博客已运行{" "}
      {/* <span id="runtime_span">{runtime_span}</span> */}
    </footer>
  );
};

export default Header;
