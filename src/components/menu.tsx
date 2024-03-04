'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FC } from 'react'
import { AppstoreOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Menu } from 'antd'
type MenuItem = Required<MenuProps>['items'][number]
type Article = {
  label: string
  children?: Article[]
  key: string
}

interface MenuInterfaces {
  tree: MenuProps['items'],
  className:string
}
type CombinedType = Article & MenuProps['items'];
const findParentLabel = (articles: Article[], targetKey: string): string[] => {
  const result: string[] = []

  function findParent(article: Article | undefined, key: string): void {
    if (article) {
      if (article.children) {
        for (const child of article.children) {
          if (child.key === key) {
            result.push(article.label, child.label)
          } else {
            findParent(child, key)
          }
        }
      }
    }
  }

  for (const article of articles) {
    findParent(article, targetKey)
  }

  return result
}
const findLabelByKey = (items: Article[], targetKey: string): string | null => {
  for (const item of items!) {
    if (item.key === targetKey) {
      return item.label
    }

    if (item.children) {
      const childMatch = item.children.find((child) => child.key === targetKey)
      if (childMatch) {
        return item.label
      }

      const foundLabel = findLabelByKey(item.children, targetKey)
      if (foundLabel) {
        return foundLabel
      }
    }
  }

  return null
}

const MenuPage: FC<MenuInterfaces> = ({ tree,className }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  let [defaultOpenKeys, setDefaultOpenKeys] = useState('')
  const onClick: MenuProps['onClick'] = (e) => router.push(`/list?id=${e.key}`)
  useEffect(() => {
    const one = findParentLabel(tree as Article[], searchParams.get('id') || '')
    console.log(one, 'one')
  }, [])

  return (
    <Menu
      className={className}
      onClick={onClick}
      style={{ width: 256 }}
      defaultSelectedKeys={[searchParams.get('id') || '']}
      defaultOpenKeys={[findLabelByKey(tree as Article[], searchParams.get('id') || '') || '']}
      mode="inline"
      items={tree}
    />
  )
}
export default MenuPage
