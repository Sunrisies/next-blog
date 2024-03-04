const findLabelByKey = (data, targetKey) => {
  for (const item of data) {
    if (item.key === targetKey) {
      // If the current item matches the target key, return its own label
      return item.label;
    }

    if (item.children) {
      // Check if the target key is present in the children
      const childMatch = item.children.find(child => child.key === targetKey);
      if (childMatch) {
        // If a child matches the target key, return the label of the current item (parent)
        return item.label;
      }

      // Recursively search in children
      const foundLabel = findLabelByKey(item.children, targetKey);
      if (foundLabel) {
        return foundLabel;
      }
    }
  }

  return null;
};

const data = [
  {
    "label": "第一篇文章",
    "children": [
      {
        "label": "out.md",
        "key": "out.md"
      }
    ],
    "key": "第一篇文章"
  },
  {
    "label": "第二篇文章",
    "children": [
      {
        "label": "qweqwe.md",
        "key": "qweqwe.md"
      },
      {
        "label": "two.md",
        "key": "two.md"
      }
    ],
    "key": "第二篇文章"
  }
];

const labelForOutMd = findLabelByKey(data, "out.md");
console.log(labelForOutMd); // 输出：第一篇文章

const labelForQweqweMd = findLabelByKey(data, "qweqwe.md");
console.log(labelForQweqweMd); // 输出：第二篇文章

const labelForTwoMd = findLabelByKey(data, "two.md");
console.log(labelForTwoMd); // 输出：第二篇文章
