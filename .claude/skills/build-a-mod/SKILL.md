---
name: build-a-mod
description: Build a Claude Code mod (a plugin of function hooks) - a live pane, a band above the prompt, a status line entry, a toast, a slash command, or a guard that blocks or rewrites tool calls and prompts. Use when someone asks to "make a mod", add something live to the Claude Code screen, or react to what Claude does from inside the session.
---

# Build a Claude Code mod

This file works two ways:

- **As a skill:** keep it at `.claude/skills/build-a-mod/SKILL.md` in a project. Claude Code loads it when the request matches.
- **As a prompt:** paste the whole file into any agent CLI, then add one line saying what the mod should do.

Only **Claude Code** runs mods. Another agent (Codex, Gemini, Copilot) can write the files with this guide, but the mod is checked and run with the `claude` command.

---

## Step 0: get the exact API for the installed version

The mod API is early access and changes between Claude Code releases. Before writing code:

1. **Inside Claude Code:** load the built-in skill `plugin-authoring` (type `/plugin-authoring`, or call it through the Skill tool). It writes this build's full type file, `claude-code.d.ts` (~14,000 lines), and says where it is. Grep it for the name you need (`'tool.call'`, `Pane: {`, `AbovePrompt: {`) and read that declaration. It is the authority; this file is the map.
2. **Outside Claude Code:** run `claude --version`. This guide was written against **2.1.286**. On another version, write the mod, then let `claude plugin validate` tell you what moved.

---

## Step 1: turn the request into a shape

| The person asks for | Build this |
| --- | --- |
| a pane, panel, sidebar, live view | `$.ui.open({ id, title })`, drawn by `on('ui.render', { component: 'Pane', requestId: id }, ...)` |
| a row or chart above the prompt | `on('ui.render', { component: 'AbovePrompt' }, ...)` returning a tree, or `next(e)` to show nothing |
| a status line entry | `$.ui.status(text)` from any hook; `undefined` clears it |
| a pop-up notice | `$.ui.toast(text)` from any hook |
| block, change or watch a tool call | `on('tool.call', { tool: 'Bash' }, ...)`: return `{ deny: 'reason' }`, call `next({ ...e, command })`, or `await next(e)` and look at the result |
| change or react to a prompt | `on('prompt.submit', ...)`: `next({ ...e, text })` |
| a slash command | `await $.command.register({ name, description })` in `session.start`, answered by `on('command.run', { command: '<name>' }, ...)` returning `{ text }` |
| work on a timer | `$.clock.every(...)` / `$.clock.after(...)`, started from `session.start` |
| a tool the model can call | `$.tool.register(...)` plus a `tool.call` hook on `mcp__<plugin>__<name>` |
| run a host command, read a file | `$.process.run({ argv })`, `$.fs` |
| remember something | `$.state` for this session, `$.store` across sessions |

If the request is vague, pick the smallest shape that shows the result, and say what you picked.

---

## Step 2: write four files

Put the mod in its own folder, `<mod-name>/`:

```
<mod-name>/
├── .claude-plugin/plugin.json   name, version, description, types
├── hooks/hooks.json             { "modules": ["./register.tsx"] }
├── hooks/register.tsx           the mod itself
└── types/index.d.ts             only if the mod keeps values in $.state
```

**.claude-plugin/plugin.json**

```json
{
  "name": "<mod-name>",
  "version": "0.1.0",
  "description": "<one line>",
  "types": "./types/index.d.ts"
}
```

Leave out `"types"` when there is no state file.

**hooks/hooks.json**

```json
{ "modules": ["./register.tsx"] }
```

**types/index.d.ts** declares every `$.state` value under the mod's name:

```ts
export type Counts = Record<string, number>

declare module 'claude-code' {
  interface PluginState {
    '<mod-name>': { counts: Counts; isHidden: boolean }
  }
}
```

Do **not** use `claude plugin init`: it makes a different kind of plugin (shell-command hooks).

---

## Step 3: the rules the module must follow

1. **Export `register(on, options)`.** `on(event, matcher?, hook)` adds a hook. Every hook is `($, e, next)`.
2. **Call `next(e)` unless you mean to stop the event.** `next(e)` runs everything beneath you and the engine's own behaviour. Returning without it answers for the engine.
3. **No Node, no DOM.** No `fs`, `child_process`, `window`. Everything outside goes through `$`.
4. **Elements come from the surface:** `const { Box, Text, Button } = $.ui.resolve(e)`. There are no global `Box` or `Text`. JSX compiles against `h`.
5. **Drawing state lives in `$.state`, not module variables.** A reload re-runs `register` and wipes module variables. Use `atom`, `read`, `update` from `'claude-code'`.
6. **A render hook never writes.** Read with `read($, atom)` while drawing. Write with `update($, atom, fn)` from a button's `onPress` or another event. A write redraws whoever read it.
7. **`update` returns the new value**, so you can use it right away.
8. **The `command.run` matcher key is `command`**, not `name`: `{ command: 'tool-meter' }`.
9. **A pane opened without the person asking** (from `session.start` or a timer) only shows on terminals 144+ columns wide. A pane opened from a command or a button shows at any width.
10. **In a band, return `next(e)` when there is nothing to show** and when `e.props.hasSurvey` is true.
11. **Guards should name themselves.** A deny reason like `` `${$.plugin.name}: .env is protected` `` tells the person which mod stopped Claude.
12. **No secrets in the mod.** Read them at run time from the environment or AWS, never from a string in the file.

---

## Step 4: a worked example (tool-meter)

A bar chart above the prompt counting the tools Claude used this session, with Reset and Hide buttons, a status line entry, a toast every 10 calls, and a `/tool-meter` command. It loads, validates and was seen running on 2.1.286.

```tsx
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
```

A guard is even shorter. This one stops Claude editing any `.env` file:

```ts
import type { Register } from 'claude-code'

const PROTECTED = /(^|\/)\.env(\.|$)/

export const register: Register = on => {
  on('tool.call', { tool: 'Edit' }, ($, e, next) =>
    PROTECTED.test(e.file_path)
      ? { deny: `${$.plugin.name}: ${e.file_path} is protected here.` }
      : next(e),
  )
}
```

---

## Step 5: check it, then run it

1. **Validate.** From the mod folder:

   ```
   claude plugin validate .
   ```

   It must end with `✔ Validation passed`. A warning about missing `author` is fine. Read the "hooks:" and "calls:" lines: they must list every event and `$` call you meant to use. Fix every error and run it again.

2. **Run it in a new session:**

   ```
   claude --plugin-dir "<full path to the mod folder>"
   ```

   Then ask for something that fires the mod (for tool-meter: "list the files here and read one").

3. **If nothing shows:** look for a dim line in the transcript naming the mod, the event and the reason. For more detail start with `claude --debug --plugin-dir "<folder>"`. A tree that fails checks is replaced by the engine's own drawing and logged as `ui.render (<Component>) ... refused: <reason>`.

4. **Hot reload, inside a Claude Code session:** load the `plugin-authoring` skill and write the mod in the folder it names. Claude Code asks once "Enable hot reloading for this session?". After yes, every save reloads the mod when the reply ends.

---

## Step 6: report back

Tell the person, as a short list:

- what the mod shows or blocks, in their words;
- the folder and the one file to read (`hooks/register.tsx`);
- the exact command to run it;
- what you checked (validate passed; seen running, or not yet);
- what would mean it is broken, and what to send back if so.

Never say it works if you only ran `validate`. Validate proves the engine accepts the files, not that the screen shows what was meant.
