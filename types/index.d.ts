export type Counts = Record<string, number>

declare module 'claude-code' {
  interface PluginState {
    'tool-meter': { counts: Counts; isHidden: boolean }
  }
}
