import {Article} from '@/src/types/list.type'

const fs = require('fs').promises;
const path = require('path');
type Directory = {
  label: string,
  key: string,
  children: {
    label: string,
    key: string
  }
}
export  const readDirectory = async(dirPath:string) =>{
  try {
    const entries = await fs.readdir(dirPath);
    const result = [];

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stats = await fs.stat(entryPath);

      if (stats.isDirectory()) {
        const children:{label:string}[]= await readDirectory(entryPath);
        result.push({ label: entry, children ,key:entry});
      } else {
        result.push({ label: entry ,key:entry});
      }
    }

    return result;
  } catch (error) {
    console.error(`Error reading directory: ${dirPath}`, error);
    return [];
  }
}

// 用法示例
const generateRandomString = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

export const findParentLabel = (articles: Article[], targetKey: string): string[] => {
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

