import path from 'path'
import { readDirectory,findParentLabel } from '@/src/utils/index'
import {readMarkdownFile} from '@/src/utils/markdown'
import Menu from '@/src/components/menu'
import styles from './page.module.scss'
import Me from '@/src/components/markdown'
export const dynamic = 'force-dynamic'
import {Article} from '@/src/types/list.type'
const srcDirectory = path.join(process.cwd(), 'src', 'md')
type Directory = {
  title: string
  children: {
    title: string
  }
}

interface searchParamsInterface {
  id:string
}
export default async ({searchParams}:{searchParams:searchParamsInterface}) => {
  let tree = await readDirectory(srcDirectory)
  const [first, second] = findParentLabel(tree as Article[], searchParams.id)
  console.log(first,'path',second)
  let books 
  if(first && second){
    books = readMarkdownFile(path.join(process.cwd(), 'src', 'md', first, second))
  }
  
  return (
    <div className={styles.root}>
      <nav>
          <Menu tree={tree} className={styles.menu} />
      </nav>
      <div className={styles.renderMarkdown}>
        <Me books={books}></Me> 
      </div>
    </div>
  )
}
