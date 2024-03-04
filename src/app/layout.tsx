import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Head from 'next/head';

import { AntdRegistry } from '@ant-design/nextjs-registry'
import Header from '@/src/components/Header/header'
import Footer from '@/src/components/Footer/footer'
import './globals.css'
import styles from './globals.module.scss'
import BlogIcon from '@/src/static/blog.svg'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh">
      <Head>
        <link rel="icon" href="BlogIcon" />
        {/* 其他头部元素 */}
      </Head>
      <body className={inter.className}>
        <AntdRegistry>
          <div className={styles.main}>
            <Header className={styles.header}></Header>
            <div className={styles.container}>
              {children}
            </div>
            <Footer className={styles.footer} title="尾部"></Footer>
          </div>
        </AntdRegistry>
      </body>
    </html>
  )
}