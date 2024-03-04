"use client";
import React, { FC, useState, useEffect } from "react";
import {
  AppstoreOutlined,
  MailOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Menu } from "antd";
import Image from "next/image";
import { AudioOutlined } from "@ant-design/icons";
import { Input, Space } from "antd";
import type { SearchProps } from "antd/es/input/Search";
import Blog from "@/src/static/blog.svg";
import { useRouter, useSearchParams } from "next/navigation";
import { produce } from "immer";
import { useImmer } from "use-immer";
import styles from "./header.module.scss";
interface HeaderProps {
  className?: string; // 可选的 className 属性
}
const { Search } = Input;

const items: MenuProps["items"] = [
  {
    label: "首页",
    key: "home",
    icon: <MailOutlined />,
  },
  {
    label: "归档",
    key: "file",
    icon: <MailOutlined />,
  },
  {
    label: "标签",
    key: "label",
    icon: <MailOutlined />,
  },
  {
    label: "作品",
    key: "works",
    icon: <MailOutlined />,
  },
  {
    label: "关于",
    key: "about",
    icon: <MailOutlined />,
  },
];
const Header: FC<HeaderProps> = ({ className }) => {
  const [current, setCurrent] = useState("");
  const router = useRouter();
  const onClick: MenuProps["onClick"] = (e) => {
    // setCurrent(
    //   produce(()=>
    //     e.key
    //   )
    // );
    // setCurrent(
    //   produce(current => {
    //     // 在这里更新 current 的值，使用 e.key
    //     current = e.key;
    //     // 如果需要，您可以添加其他逻辑来修改 current
    //     // 例如：current.someProperty = newValue;
    //     return current; // 返回更新后的 current
    //   })
    // );
    if (e.key === "home") {
      router.push("/");
      return;
    }
    router.push(e.key);
    console.log(current, "current", e.key);
  };

  // useEffect(() => {
  //   let path = current;
  //   if (current === "home") {
  //     router.push("/");
  //     return;
  //   }
  //   router.push(path);
  // }, [current]);
  const onSearch: SearchProps["onSearch"] = (value, _e, info) =>
    console.log(info?.source, value);
  return (
    <header className={`${className} ${styles.root}`}>
      <div className={styles.icon}>
        <Image src={Blog} alt="Picture of the author" width={20} height={20} />
      </div>
      <div className={styles.navbar}>
        <Menu
          onClick={onClick}
          selectedKeys={[current]}
          mode="horizontal"
          items={items}
          style={{ height: "100%" }}
        />
        ;
      </div>
      <Search
        className={styles.search}
        placeholder="搜索本站文章"
        allowClear
        onSearch={onSearch}
      />
      <div className={styles.login}>登录</div>
    </header>
  );
};

export default Header;
