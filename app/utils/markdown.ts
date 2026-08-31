import { marked } from 'marked'

/**
 * Configure marked with GFM (GitHub Flavored Markdown) and line breaks.
 */
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * Convert Markdown string to clean semantic HTML.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return ''
  try {
    const html = marked.parse(markdown, { async: false }) as string
    return html.trim()
  } catch (error) {
    console.error('Failed to parse markdown to html:', error)
    return markdown
  }
}

/**
 * Check whether a string appears to be Markdown formatted text.
 */
export function isMarkdownContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  // Check for common markdown syntax indicators
  const mdPatterns = [
    /^#{1,6}\s+/m, // Headings: # H1
    /^\s*[-*+]\s+/m, // Unordered lists: - item
    /^\s*\d+\.\s+/m, // Ordered lists: 1. item
    /^\s*>\s+/m, // Blockquotes: > quote
    /```[\s\S]*?```/, // Code blocks
    /`[^`\n]+`/, // Inline code
    /\[[^\]]+\]\([^)]+\)/, // Links: [text](url)
    /!\[[^\]]*\]\([^)]+\)/, // Images: ![alt](url)
    /\*\*[^*]+\*\*/, // Bold: **text**
    /~~[^~]+~~/, // Strike: ~~text~~
    /\|.+\|.+\|\n\|[-:\s|]+\|/m, // Tables
    /^---$/m, // Horizontal rules
  ]
  return mdPatterns.some((pattern) => pattern.test(text))
}

/**
 * Helper to convert DOM nodes into Markdown recursively.
 */
function nodeToMarkdown(
  node: Node,
  listContext: { depth: number; ordered: boolean; index: number } = { depth: 0, ordered: false, index: 1 },
): string {
  if (node.nodeType === 3) {
    // Node.TEXT_NODE
    return node.nodeValue || ''
  }
  if (node.nodeType !== 1) {
    // Node.ELEMENT_NODE
    return ''
  }

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes)

  const getChildrenMarkdown = (ctx = listContext) => {
    return children.map((c) => nodeToMarkdown(c, ctx)).join('')
  }

  switch (tag) {
    case 'h1':
      return `# ${getChildrenMarkdown().trim()}\n\n`
    case 'h2':
      return `## ${getChildrenMarkdown().trim()}\n\n`
    case 'h3':
      return `### ${getChildrenMarkdown().trim()}\n\n`
    case 'h4':
      return `#### ${getChildrenMarkdown().trim()}\n\n`
    case 'h5':
      return `##### ${getChildrenMarkdown().trim()}\n\n`
    case 'h6':
      return `###### ${getChildrenMarkdown().trim()}\n\n`
    case 'p': {
      const content = getChildrenMarkdown().trim()
      return content ? `${content}\n\n` : ''
    }
    case 'strong':
    case 'b': {
      const text = getChildrenMarkdown().trim()
      return text ? `**${text}**` : ''
    }
    case 'em':
    case 'i': {
      const text = getChildrenMarkdown().trim()
      return text ? `*${text}*` : ''
    }
    case 's':
    case 'del':
    case 'strike': {
      const text = getChildrenMarkdown().trim()
      return text ? `~~${text}~~` : ''
    }
    case 'code': {
      if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
        return el.textContent || ''
      }
      const inlineText = el.textContent || ''
      return inlineText ? `\`${inlineText}\`` : ''
    }
    case 'pre': {
      const codeNode = el.querySelector('code')
      let lang = ''
      if (codeNode) {
        const className = codeNode.getAttribute('class') || ''
        const match = className.match(/language-([a-zA-Z0-9_-]+)/)
        if (match && match[1]) lang = match[1]
      }
      const codeContent = codeNode ? (codeNode.textContent || '') : (el.textContent || '')
      return `\`\`\`${lang}\n${codeContent.replace(/\n+$/, '')}\n\`\`\`\n\n`
    }
    case 'blockquote': {
      const text = getChildrenMarkdown().trim()
      const lines = text.split('\n')
      return lines.map((line) => `> ${line}`).join('\n') + '\n\n'
    }
    case 'ul': {
      return (
        children
          .map((c) => nodeToMarkdown(c, { depth: listContext.depth + 1, ordered: false, index: 1 }))
          .join('') + (listContext.depth === 0 ? '\n' : '')
      )
    }
    case 'ol': {
      let idx = 1
      return (
        children
          .map((c) => {
            if (c.nodeType === 1 && (c as HTMLElement).tagName.toLowerCase() === 'li') {
              return nodeToMarkdown(c, { depth: listContext.depth + 1, ordered: true, index: idx++ })
            }
            return nodeToMarkdown(c, { depth: listContext.depth + 1, ordered: true, index: idx })
          })
          .join('') + (listContext.depth === 0 ? '\n' : '')
      )
    }
    case 'li': {
      const indent = '  '.repeat(Math.max(0, listContext.depth - 1))
      const prefix = listContext.ordered ? `${listContext.index}. ` : '- '
      const inlineParts: string[] = []
      const sublistParts: string[] = []
      for (const child of children) {
        const cTag = child.nodeType === 1 ? (child as HTMLElement).tagName.toLowerCase() : ''
        if (cTag === 'ul' || cTag === 'ol') {
          sublistParts.push(
            nodeToMarkdown(child, { depth: listContext.depth, ordered: cTag === 'ol', index: 1 }),
          )
        } else {
          inlineParts.push(nodeToMarkdown(child, listContext))
        }
      }
      const text = inlineParts.join('').trim()
      const sub = sublistParts.join('')
      return `${indent}${prefix}${text}\n${sub}`
    }
    case 'hr':
      return '---\n\n'
    case 'br':
      return '\n'
    case 'a': {
      const href = el.getAttribute('href') || ''
      const text = getChildrenMarkdown().trim()
      return text ? `[${text}](${href})` : href
    }
    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt') || ''
      return `![${alt}](${src})`
    }
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr'))
      if (rows.length === 0) return ''
      let res = ''
      const matrix = rows.map((r) =>
        Array.from(r.querySelectorAll('th, td')).map((cell) =>
          (cell.textContent || '').trim().replace(/\|/g, '\\|'),
        ),
      )
      if (matrix.length > 0) {
        const header = matrix[0] || []
        res += `| ${header.join(' | ')} |\n`
        res += `| ${header.map(() => '---').join(' | ')} |\n`
        for (let i = 1; i < matrix.length; i++) {
          const row = matrix[i] || []
          res += `| ${row.join(' | ')} |\n`
        }
        res += '\n'
      }
      return res
    }
    default:
      return getChildrenMarkdown()
  }
}

/**
 * Fallback regex-based converter when DOMParser is not available.
 */
function regexHtmlToMarkdown(html: string): string {
  let md = html
  // Remove scripts and styles
  md = md.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  md = md.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')

  // Code blocks
  md = md.replace(/<pre[^>]*><code(?: class="language-([a-zA-Z0-9_-]+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, lang, code) => {
    return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n\n`
  })

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = content.replace(/<[^>]+>/g, '').trim().split('\n')
    return lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n'
  })

  // Basic inline formatting
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
  md = md.replace(/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~')
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  md = md.replace(/<img\s+[^>]*src="([^"]*)"(?:\s+alt="([^"]*)")?[^>]*>/gi, '![$2]($1)')
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  md = md.replace(/<[^>]+>/g, '') // Strip remaining tags
  return md.trim()
}

/**
 * Convert HTML string to clean Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return ''

  // If running in browser environment with DOMParser
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
      const container = doc.body.firstElementChild || doc.body
      const md = nodeToMarkdown(container)
      return md.replace(/\n{3,}/g, '\n\n').trim()
    } catch (e) {
      console.warn('DOMParser htmlToMarkdown failed, falling back to regex:', e)
    }
  }

  return regexHtmlToMarkdown(html).replace(/\n{3,}/g, '\n\n').trim()
}
