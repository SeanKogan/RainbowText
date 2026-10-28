// One /btw at a time: `text` is null while the answer is on its way.
export type SideQuestion = { id: number; question: string; text: string | null }

declare module 'claude-code' {
  interface PluginState {
    'reply-colors': { btw: Shaped<SideQuestion | null> }
  }
}
