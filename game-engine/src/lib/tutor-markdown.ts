interface MarkdownNode {
  type: string
  value?: string
  children?: MarkdownNode[]
}

function restoreLooseStrong(parent: MarkdownNode): void {
  if (!parent.children) return

  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index]
    if (child.type !== 'text' || !child.value?.includes('**')) {
      restoreLooseStrong(child)
      continue
    }

    const parts: MarkdownNode[] = []
    const expression = /\*\*([^*\n]+?)\*\*/g
    let cursor = 0
    let match = expression.exec(child.value)

    while (match) {
      if (match.index > cursor) {
        parts.push({ type: 'text', value: child.value.slice(cursor, match.index) })
      }
      parts.push({ type: 'strong', children: [{ type: 'text', value: match[1] }] })
      cursor = match.index + match[0].length
      match = expression.exec(child.value)
    }

    if (!parts.length) continue
    if (cursor < child.value.length) {
      parts.push({ type: 'text', value: child.value.slice(cursor) })
    }
    parent.children.splice(index, 1, ...parts)
    index += parts.length - 1
  }
}

/** Restores AI emphasis that CommonMark leaves literal around CJK punctuation. */
export function remarkTutorLooseStrong() {
  return (tree: MarkdownNode) => restoreLooseStrong(tree)
}
