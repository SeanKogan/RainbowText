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

// The engine's /btw draws its answer in an overlay no plugin can restyle, so the
// plugin asks the same side question itself and the answer lands in a row it colors.
const SIDE = `<system-reminder>This is a side question from the user. You must answer this question directly in a single response.

IMPORTANT CONTEXT:
- You are a separate, lightweight agent spawned to answer this one question
- The main agent is NOT interrupted - it continues working independently in the background
- You share the conversation context but are a completely separate instance
- Do NOT reference being interrupted or what you were "previously doing" - that framing is incorrect

CRITICAL CONSTRAINTS:
- You have NO tools available - you cannot read files, run commands, search, or take any actions
- This is a one-off response - there will be no follow-up turns
- You can ONLY provide information based on what you already know from the conversation context
- NEVER say things like "Let me try...", "I'll now...", "Let me check...", or promise to take any action
- If you don't know the answer, say so - do not offer to look it up or investigate

Simply answer the question with the information you have.</system-reminder>

`

const isFancy = (s: string) => /\{\{[yorg]:|https?:\/\//.test(s)

// Paragraphs split on blank lines; each code fence is a block of its own.
function blocks(text: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  let inFence = false
  const flush = () => {
    if (cur.length) out.push(cur.join('\n'))
    cur = []
  }
  for (const line of text.split('\n')) {
    const isFence = line.trimStart().startsWith('```')
    if (isFence && !inFence) flush()
    if (inFence || isFence || line.trim() !== '') cur.push(line)
    else flush()
    if (isFence) {
      inFence = !inFence
      if (!inFence) flush()
    }
  }
  flush()
  return out
}

const isTable = (b: string) => b.split('\n').every(l => l.trimStart().startsWith('|'))

// Tags can't be colored inside a table the engine draws, so they fall back to bold.
const untag = (b: string) => b.replace(/\{\{[yorg]:([\s\S]*?)\}\}/g, '**$1**')

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return { sections: [...sections, { id: 'reply-colors:guide', text: GUIDE, scope: 'session' }] }
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const text: string = e.props.text
    return isFancy(text) ? draw($, e, text) : next(e)
  })

  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => {
    const text: string = e.props.text
    return isFancy(text) && !e.props.isErrored ? draw($, e, text) : next(e)
  })

  on('command.run', { command: 'btw' }, async ($, e, next) => {
    const question = e.args.trim()
    if (!question) return next(e)
    $.ui.status('btw: answering…')
    try {
      const r = await $.model.fork({ prompt: SIDE + question })
      // Nothing to fork yet, or the API failed: the engine's own /btw takes it.
      return r.isAnswered ? { text: r.text } : next(e)
    } finally {
      $.ui.status(undefined)
    }
  }).catch(($, e, next) => next(e))
}

function draw($: any, e: any, text: string) {
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
    } else if (isTable(b)) {
      rows.push(<Markdown key={`m${k++}`} text={untag(b)} />)
    } else {
      for (const l of b.split('\n')) rows.push(line(l))
    }
  })

  return <Box flexDirection="column">{rows}</Box>
}
