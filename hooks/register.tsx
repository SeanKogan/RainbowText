import type { Register } from 'claude-code'

const COLORS: Record<string, string> = {
  y: '#facc15',
  o: '#fb923c',
  r: '#ef4444',
  g: '#22c55e',
}
const BLUE = '#60a5fa'

// {{y:text}}, **bold**, `code`, [label](https://...), bare https://...
const TOKEN =
  /\{\{([yorg]):([\s\S]*?)\}\}|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g

const GUIDE = `# Reply colors
Your replies are drawn in color by the reply-colors plugin. Wrap a few key words per reply in tags:
- {{y:text}} yellow: the main highlight (a button, a key term)
- {{o:text}} orange: a second highlight, when yellow is already used nearby
- {{r:text}} red: needs extra care (risky, irreversible, a warning)
- {{g:text}} green: summary sentences only
Write links as bare https:// URLs; they are drawn blue and clickable. Never put tags inside code blocks or inline code.`

const isFancy = (s: string) => /\{\{[yorg]:|https?:\/\//.test(s)

// Paragraphs split on blank lines, code fences kept whole.
function blocks(text: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  let inFence = false
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence
    if (!inFence && line.trim() === '' && cur.length) {
      out.push(cur.join('\n'))
      cur = []
    } else if (inFence || line.trim() !== '') {
      cur.push(line)
    }
  }
  if (cur.length) out.push(cur.join('\n'))
  return out
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return { sections: [...sections, { id: 'reply-colors:guide', text: GUIDE, scope: 'session' }] }
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const text: string = e.props.text
    if (!isFancy(text)) return next(e)

    const { Box, Text, Link, Markdown } = $.ui.resolve(e)
    let k = 0

    const inline = (s: string, color?: string, bold?: boolean): any[] => {
      const parts: any[] = []
      let last = 0
      for (const m of s.matchAll(TOKEN)) {
        const i = m.index ?? 0
        if (i > last) parts.push(<Text key={`t${k++}`} color={color} bold={bold}>{s.slice(last, i)}</Text>)
        if (m[1]) parts.push(...inline(m[2], COLORS[m[1]], true))
        else if (m[3]) parts.push(...inline(m[3], color, true))
        else if (m[4]) parts.push(<Text key={`t${k++}`} color={color ?? 'permission'}>{m[4]}</Text>)
        else if (m[7]) {
          // Bare URL: plain text, which the terminal makes clickable itself, so it shows once.
          parts.push(<Text key={`t${k++}`} color={BLUE} underline>{m[7]}</Text>)
        } else {
          parts.push(
            <Text key={`t${k++}`} color={BLUE} underline>
              <Link href={m[6]} label={m[5]} />
            </Text>,
          )
        }
        last = i + m[0].length
      }
      if (last < s.length) parts.push(<Text key={`t${k++}`} color={color} bold={bold}>{s.slice(last)}</Text>)
      return parts
    }

    const line = (raw: string) => {
      let s = raw
      let bold = false
      const heading = s.match(/^#{1,6}\s+(.*)$/)
      if (heading) { s = heading[1]; bold = true }
      s = s.replace(/^(\s*)[-*]\s+/, '$1• ')
      return <Text key={`l${k++}`} bold={bold}>{inline(s, undefined, bold)}</Text>
    }

    const rows: any[] = []
    blocks(text).forEach((b, i) => {
      if (i > 0) rows.push(<Text key={`gap${k++}`}> </Text>)
      if (!isFancy(b) || b.trimStart().startsWith('```')) {
        rows.push(<Markdown key={`m${k++}`} text={b} />)
      } else {
        for (const l of b.split('\n')) rows.push(line(l))
      }
    })

    return <Box flexDirection="column">{rows}</Box>
  })
}
