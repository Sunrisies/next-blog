'use client'
import styles from '../../app/home.module.scss'
import {useRouter} from 'next/navigation'
import React, { useEffect, useState, useRef } from 'react'
import { Avatar, List, message } from 'antd'
import VirtualList from 'rc-virtual-list'

type Directory = {
  label: string
  key: string
  children: {
    label: string
    key: string
  }
}
interface UserItem {
  email: string
  gender: string
  name: {
    first: string
    last: string
    title: string
  }
  nat: string
  picture: {
    large: string
    medium: string
  }
  thumbnail: string
}
const fakeDataUrl = 'https://randomuser.me/api/?results=20&inc=name,gender,email,nat,picture&noinfo'
const ContainerHeight = 700
export default function Home({ list }: { list: Directory }) {
  const homeContainerRef = useRef<any>(null)
  const [ContainerHeight, setContainerHeight] = useState(0)
  const router = useRouter()
  useEffect(() => {
    if (homeContainerRef.current) {
      console.log(homeContainerRef.current, 'homeContainerRef.current')
      setContainerHeight(homeContainerRef.current.offsetHeight)
    }
  }, [])

  const onScroll = (e: React.UIEvent<HTMLElement, UIEvent>) => {
    // Refer to: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#problems_and_solutions
    if (Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - ContainerHeight) <= 1) {
    }
  }
  const handleClick = (item: Directory) => {
    router.push(`/article?id=${item.key}`)
    console.log(item, 'item clicked')
  }
  return (
    <div ref={homeContainerRef} className={styles.homeContainer}>
      <List>
        <VirtualList data={list} height={ContainerHeight} itemHeight={47} itemKey="key" onScroll={onScroll}>
          {(item: Directory) => (
            <div className={styles.listItem} onClick={() => handleClick(item)}>
              <div>{item.label}</div>
              <div>首页数据</div>
            </div>
          )}
        </VirtualList>
      </List>
    </div>
  )
}
