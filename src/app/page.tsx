import HomeMain from '../components/HomeMain/Home'
import { readDirectory } from '../utils/index'
import path from 'node:path'
const srcDirectory = path.join(process.cwd(), 'src', 'mdx')
//


export default async  ()=> {
 const list =  await readDirectory(srcDirectory)
 console.log(list)

  return (
      <HomeMain list={list} ></HomeMain>
  
  )
}
