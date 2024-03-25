import Menu from '@/src/components/menu'
import Me from '@/src/components/markdown'
import { readMarkdownFile } from '@/src/utils/markdown'
import path from 'node:path'
import fs from 'node:fs'
interface searchParamsInterface {
  id:string
}
export default async ({ searchParams }: { searchParams: searchParamsInterface }) => {
  console.log(searchParams, 'searchParams')
  const books = fs.readFileSync(path.join(process.cwd(), 'src', 'mdx',searchParams.id), 'utf8')
  
  return (
    <>
      <div>文章详情</div>
      <Me books={books}></Me>
    </>
  )
}
