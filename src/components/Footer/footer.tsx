"use client";
import React, { FC, useEffect, useState } from "react";
import styles from "./footer.module.css";
import moment from "moment";
interface MyComponentProps {
  title: string;
  className: string;
}

const Header: FC<MyComponentProps> = ({ title, className }) => {
  const [blogStartTime, setBlogStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  // useEffect(() => {
  //   // 设置博客开始时间（这里假设是在组件挂载时）
  //   setBlogStartTime(moment("2020-03-05T21:07:28Z"));

  //   // 每秒更新已过去的时间
  //   const interval = setInterval(() => {
  //     const now = moment();
  //     const duration = moment.duration(now.diff(blogStartTime));
  //     setElapsedTime(
  //       duration.asHours() +
  //         "小时 " +
  //         duration.minutes() +
  //         "分 " +
  //         duration.seconds() +
  //         "秒"
  //     );
  //   }, 1000);

  //   // 清除定时器（在组件卸载时）
  //   return () => clearInterval(interval);
  // }, [blogStartTime]);

  return (
    <footer className={className}>
      朝阳 ©{new Date().getFullYear()} 博客已运行{" "}
      {elapsedTime}
    </footer>
  );
};

export default Header;
