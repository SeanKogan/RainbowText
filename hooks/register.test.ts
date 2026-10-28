import { test, expect } from 'claude-code/testing'

const TEXT = [
  'Plain paragraph with **bold**.',
  '',
  '1. Open https://claude.ai then click {{y:Share}} → {{o:Copy link}}',
  '{{r:Links are public.}} See [docs](https://example.com) and `Ctrl+A`.',
  '',
  '{{g:Summary: share, then paste.}}',
].join('\n')

for (const surface of ['terminal', 'desktop'] as const) {
  test(`colors a tagged reply on ${surface}`, async $ => {
    const el: any = await $.ui.render({
      surface,
      component: 'AssistantMessage',
      requestId: 'm1',
      props: { text: TEXT, isFirstOfReply: true },
    } as any)
    const s = JSON.stringify(el)
    expect(s.includes('#facc15')).toBe(true)
    expect(s.includes('#ef4444')).toBe(true)
    expect(s.includes('https://claude.ai')).toBe(true)
    expect(s.includes('{{')).toBe(false)
  })
}

test('leaves an untagged reply alone', async ($, on) => {
  let reached = false
  on('ui.render', ($, e: any) => { reached = true; const { Text } = $.ui.resolve(e) as any; return h(Text, null, 'engine') as any })
  const el: any = await $.ui.render({
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm2',
    props: { text: 'Just **text**.', isFirstOfReply: true },
  } as any)
  expect(reached).toBe(true)
  expect(JSON.stringify(el ?? null).includes('#facc15')).toBe(false)
})

test('tells Claude about the tags', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }) as any)
  const { sections } = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
  expect(sections.some(x => x.id === 'reply-colors:guide' && x.text.includes('{{y:'))).toBe(true)
})

const render = ($: any, text: string) =>
  $.ui.render({ surface: 'terminal', component: 'AssistantMessage', requestId: 'm', props: { text, isFirstOfReply: true } } as any)

test('keeps a table with a link or tag as a table', async $ => {
  const el: any = await render($, '| Col | Link |\n| --- | --- |\n| {{y:a}} | https://x.com |')
  expect(el.children[0].type).toBe('Markdown')
  expect(el.children[0].props.text.includes('**a**')).toBe(true)
})

test('keeps a code fence right after a line whole', async $ => {
  const el: any = await render($, 'Run {{y:this}}:\n```\nnpm test https://z.com\n```')
  const md = el.children.find((c: any) => c.type === 'Markdown')
  expect(md.props.text.startsWith('```')).toBe(true)
  expect(JSON.stringify(el).includes('#facc15')).toBe(true)
})

test('colors a command output row, like a /btw answer', async $ => {
  const el: any = await $.ui.render({
    surface: 'terminal',
    component: 'CommandOutput',
    requestId: 'c1',
    props: { command: 'btw', args: 'q', text: 'Click {{y:Share}} at https://x.com', isErrored: false },
  } as any)
  const s = JSON.stringify(el)
  expect(s.includes('#facc15')).toBe(true)
  expect(s.includes('{{')).toBe(false)
})

const tick = () => new Promise(r => setTimeout(r, 10))

const PANE = {
  plugin: 'reply-colors',
  component: 'Pane',
  requestId: 'btw',
  props: { title: '/btw', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('answers /btw in a colored pane, outside the transcript', async ($, on) => {
  let asked = ''
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('clock.after', () => ({ value: undefined }) as any)
  on('session.turns', () => ({ value: 0 }) as any)
  on('model.fork', ($, e: any) => { asked = e.prompt; return { value: { isAnswered: true, text: 'It is {{g:done}}.', usage: {} } } as any })
  const r: any = await $.command.run({ command: 'btw', args: 'is it done?' })
  expect(r.text).toBe(undefined)
  for (let i = 0; i < 50 && !asked; i++) await tick()
  await tick()
  expect(asked.endsWith('is it done?')).toBe(true)
  expect(asked.includes('side question')).toBe(true)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as any)
  expect((await ui.find({ type: 'Text', text: /^done$/ }))?.text).toBe('done')
  expect(JSON.stringify(await ui.find({ type: 'Text', text: /^done$/ })).includes('#22c55e')).toBe(true)
  await ui.unmount()
})

test('a /btw before the first turn asks the model without a fork', async ($, on) => {
  let completed = ''
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('clock.after', () => ({ value: undefined }) as any)
  on('session.turns', () => ({ value: 0 }) as any)
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork', usage: {} } }) as any)
  on('session.model', () => ({ value: 'claude-haiku-5-5' }) as any)
  on('model.complete', ($, e: any) => { completed = e.model; return { value: { isAnswered: true, text: '{{y:4}}', usage: {} } } as any })
  await $.command.run({ command: 'btw', args: '2+2?' })
  for (let i = 0; i < 50 && !completed; i++) await tick()
  expect(completed).toBe('claude-haiku-5-5')
})

test('an empty /btw is left to the engine', async ($, on) => {
  let reached = false
  on('command.run', () => { reached = true; return { text: 'usage' } })
  await $.command.run({ command: 'btw', args: '' })
  expect(reached).toBe(true)
})

test('a resumed session before its first turn hands /btw to the engine', async ($, on) => {
  let reached = false
  on('session.turns', () => ({ value: 3 }) as any)
  on('command.run', () => { reached = true; return { text: 'engine' } })
  await $.command.run({ command: 'btw', args: 'what did we say?' })
  expect(reached).toBe(true)
})
