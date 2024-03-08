'use client'
import MDEditor from '@uiw/react-md-editor'
import { FC, useState } from 'react'
type Component = {
  books:any
}

const MarkdownPage: FC<Component> = ({books}) => {
  const [value, setValue] = useState(books)
  return (
    <>
      {/* <MDEditor value={value} onChange={setValue} /> */}
      <MDEditor.Markdown source={books} style={{ whiteSpace: 'pre-wrap' }} />
    </>
  )
}
export default MarkdownPage
