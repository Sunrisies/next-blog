import React, { FC } from 'react'
import styles from './footer.module.css'
interface MyComponentProps {
  title: string
  className: string
}
const Header: FC<MyComponentProps> = ({ title, className }) => {
  return (
    <footer className={className}>
      <div>{title}</div>Ant Design ©{new Date().getFullYear()} Created by Ant UED
    </footer>
  )
}

export default Header
