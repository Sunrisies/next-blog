import fs from 'fs';
import remark from 'remark';
import reactRender from 'remark-react';
// import { Processor, Node } from 'unified';

interface RemarkResult {
  contents: Node;
}

const readMarkdownFile = (filePath: string): string => {
  const fileContents = fs.readFileSync(filePath, 'utf8');
  return fileContents;
};


export { readMarkdownFile };
