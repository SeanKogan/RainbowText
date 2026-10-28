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
