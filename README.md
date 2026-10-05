# tool-meter

A small, visual **Claude Code mod**: a live bar chart above the prompt showing which tools Claude has used this session.

```
Tool meter (this session) [ Reset ] [ Hide ]
Bash     ████████████ 6
Read     ██████       3
Edit     ██           1
```

It also puts the last tool in the status line, pops up a notice every 10 tool calls, and adds a `/tool-meter` command that brings the chart back after you hide it.

The repo has a second job: it carries a **skill** that teaches any agent CLI how to build a mod of your own, and a page of **use cases** for what mods can do.

## What a mod is

A mod is a plugin of TypeScript function hooks that runs inside a Claude Code session. It can see every tool call and prompt, block or change them, and draw on the screen: a pane, a band above the prompt, a status line entry, a toast. It reloads when you save it.

## Try it

You need Claude Code (written against version 2.1.286; the mod API is early access).

```
git clone https://github.com/VerbodhDev/tool-meter.git
claude --plugin-dir ./tool-meter
```

Then ask Claude something that uses tools, for example "list the files here and read one". The chart appears above the prompt after the first tool call.

To check the files without running a session:

```
claude plugin validate ./tool-meter
```

## Build your own mod

Open Claude Code in this folder and ask for a mod, for example "make a mod that blocks git push --force". The skill in `.claude/skills/build-a-mod/` loads and guides it.

With another agent CLI, paste [SKILL.md](.claude/skills/build-a-mod/SKILL.md) into it and add one line saying what the mod should do. Only Claude Code can run the result.

## Reading order

1. [hooks/register.tsx](hooks/register.tsx): the mod itself, about 60 lines.
2. [docs/USE-CASES.md](docs/USE-CASES.md): about 25 ideas, grouped by what a mod can do: see, guard, steer, automate, extend.
3. [.claude/skills/build-a-mod/SKILL.md](.claude/skills/build-a-mod/SKILL.md): the step-by-step guide for building one.

## Folder map

```
tool-meter/
├── .claude-plugin/plugin.json        the mod's name, version and type contract
├── hooks/hooks.json                  points Claude Code at the module
├── hooks/register.tsx                the mod
├── types/index.d.ts                  the values the mod keeps in $.state
├── docs/USE-CASES.md                 what mods can do for a team
└── .claude/skills/build-a-mod/       the skill / prompt for building a mod
    └── SKILL.md
```

Claude Code writes `.claude-plugin/types/` and `tsconfig.json` on each machine when the mod loads. They are gitignored.
