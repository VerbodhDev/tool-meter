import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Counts } from '../types'

const counts = atom({ plugin: 'tool-meter', key: 'counts' } as const, {} as Counts)
const isHidden = atom({ plugin: 'tool-meter', key: 'isHidden' } as const, false)

const BAR_MAX = 12

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tool-meter', description: 'Show the tool meter again' })

    return next(e)
  })

  on('command.run', { command: 'tool-meter' }, async $ => {
    await update($, isHidden, () => false)

    return { text: 'Tool meter is showing above the prompt.' }
  })

  on('tool.call', async ($, e, next) => {
    const tool = e.tool.startsWith('mcp__') ? 'MCP' : e.tool
    const nextCounts = await update($, counts, c => ({ ...c, [tool]: (c[tool] ?? 0) + 1 }))
    const total = Object.values(nextCounts).reduce((a, b) => a + b, 0)

    $.ui.status(`🛠 ${tool} · ${total} tool calls`)
    if (total % 10 === 0) {
      $.ui.toast(`Claude has used ${total} tools this session`)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await read($, counts)
    const rows = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5)

    if (e.props.hasSurvey || rows.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const top = rows[0][1]

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="cyan">Tool meter </Text>
          <Text dimColor>(this session) </Text>
          <Button key="reset" label="Reset" onPress={() => update($, counts, () => ({}))} />
          <Text> </Text>
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
        </Box>
        {rows.map(([tool, n]) => (
          <Box key={tool}>
            <Text>{tool.padEnd(8)} </Text>
            <Text color="green">{'█'.repeat(Math.max(1, Math.round((n / top) * BAR_MAX)))}</Text>
            <Text dimColor> {n}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
