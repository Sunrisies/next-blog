'use client'
import Image from "next/image";
import styles from "./home.module.scss";
import React, { useEffect, useState,useRef } from "react";
import { Avatar, List, message } from "antd";
import VirtualList from "rc-virtual-list";

interface UserItem {
  email: string;
  gender: string;
  name: {
    first: string;
    last: string;
    title: string;
  };
  nat: string;
  picture: {
    large: string;
    medium: string;
  };
  thumbnail: string;
}

const fakeDataUrl =
  'https://randomuser.me/api/?results=20&inc=name,gender,email,nat,picture&noinfo';
// const ContainerHeight = 700;
export default function Home() {
  const homeContainerRef = useRef<any>(null);  
  const [ContainerHeight, setContainerHeight] = useState(0);  
  const [data, setData] = useState<UserItem[]>([]);
  const appendData = () => {
    fetch(fakeDataUrl)
      .then((res) => res.json())
      .then((body) => {
        setData(data.concat(body.results));
        message.success(`${body.results.length} more items loaded!`);
      });
  };

  useEffect(() => {
    appendData();
    if (homeContainerRef.current) {  
      console.log(homeContainerRef.current,'homeContainerRef.current')
      setContainerHeight(homeContainerRef.current.offsetHeight);  
    }  
  }, []);

  const onScroll = (e: React.UIEvent<HTMLElement, UIEvent>) => {
    // Refer to: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#problems_and_solutions
    if (Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - ContainerHeight) <= 1) {
      appendData();
    }
  };
  return (
    <div ref={homeContainerRef} className={styles.homeContainer}>
      <List>
      <VirtualList
        data={data}
        height={ContainerHeight}
        itemHeight={47}
        itemKey="email"
        onScroll={onScroll}
      >
        {(item: UserItem) => (
          <div className={styles.listItem}>
            <div>
            {item.email}
            </div>
            <div>{item.gender}</div>
            <div>{item.nat}</div>
            <div>{item.thumbnail}</div>
            <div>首页数据</div>
            </div>
        )}
      </VirtualList>
    </List>
    </div>
  );
}
