# What mods can do for a team

A mod is a small TypeScript plugin that runs **inside** a Claude Code session. It can see every tool call and prompt, block or change them, and draw live things on the screen. Built and shown working here: **tool-meter**. Everything else on this page is an idea, not yet built.

To build any of these, give an agent CLI the skill at [`.claude/skills/build-a-mod/SKILL.md`](../.claude/skills/build-a-mod/SKILL.md) and one line saying which idea.

Names below are made up: Acme is the company, Initech the employer, `acme-sso` the AWS profile.

---

## The five ways a mod helps

| Way | What it does | API it uses |
| --- | --- | --- |
| **See** | shows what is happening without asking Claude | `ui.render` (band, pane), `$.ui.status`, `$.ui.toast` |
| **Guard** | stops a bad action before it runs | `tool.call` returning `{ deny }` |
| **Steer** | changes a prompt or a command before it runs | `next({ ...e, text })`, `next({ ...e, command })` |
| **Automate** | does routine work on a command or a timer | `$.command.register`, `$.clock.every`, `$.process.run`, `$.prompt.submit` |
| **Extend** | gives Claude a new tool or helper agent | `$.tool.register`, `$.agent.register` |

---

## 1. See: make the session visible

- **Tool meter** (built). A bar chart of the tools Claude used this session. Shows at a glance whether Claude is reading, editing or running commands, and whether it is stuck in a loop.
- **Context and cost meter.** A band showing how full the context window is and the session's cost, from `$.session.usage()`. A toast at 80% so you can compact before quality drops.
- **Deploy watch pane.** A `/deploys` command opens a pane listing dev and prod: image tag, running count, last deploy time. Refreshed every minute by `$.process.run` with `aws ecs describe-services --profile acme-sso`.
- **Lane band.** One row above the prompt: current branch, worktree path, and whether another session is running a build or holding a port. Stops two agents racing on the same machine.
- **Ticket band.** The ticket being worked on and its acceptance criteria, so neither you nor Claude drifts off-task.
- **Long-turn alert.** A toast when a reply took over two minutes or used more than 30 tools, so you check on it.

## 2. Guard: stop the mistakes that already happened once

Each of these exists today only as a line in an instruction file, or as a shell hook. A mod makes it a hard stop with a clear reason on screen.

- **Secrets guard.** Deny Read, Edit and Write on `.env`, `token.md` and identity-document folders. Deny Bash commands that `cat` or `grep` them.
- **AWS profile guard.** Deny any `aws` command that does not say `--profile acme-sso` in full. Stops a command landing in the employer's or a client's account.
- **Wrong-folder deploy guard.** Deny a deploy script run with `--apply` when the current folder is not that project's own.
- **Commit identity guard.** Deny `git commit` when `git var GIT_COMMITTER_IDENT` shows an `@initech.com` address.
- **Docker guard.** Deny `docker image prune -a`, which deletes a 10 GB base image that takes ages to pull back.
- **Run-only-in-cloud guard.** Deny starting a service locally when the team rule says it only runs on AWS.
- **Main-branch guard.** Deny `git push --force` and any push to `main` that skipped the tests.
- **Read-before-edit gate.** Deny the first Edit in a project until Claude has read that project's knowledge graph or notes.

## 3. Steer: change what goes in

- **Prompt helpers.** When a prompt says "deploy", add the team's deploy checklist to it before Claude reads it.
- **Command clean-up.** Trim, quote or add safe flags to Bash commands (for example `--dry-run` first on anything with `--apply`).
- **Output-format check.** After each reply, check for long paragraphs and toast "reply has a 6-line paragraph" when the team asked for lists.
- **Language or style rules.** Add "answer in plain words" to every prompt for a reader who asked for it.

## 4. Automate: routine work without asking

- **Slash commands for routine checks:** `/deploys`, `/disk` (shows `df -h` and Docker space), `/whoami-aws`, `/checkpoint` (writes a session checkpoint file).
- **Wake on finish.** A timer polls a CI run or a deploy, then `$.prompt.submit` starts a turn: "the deploy finished, verify it on dev".
- **Clean-up after deploy.** When a deploy command succeeds, run the Docker clean-up step automatically.
- **Session log.** On `turn.complete`, write tool counts and timings to `$.store`, for a weekly "where did the time go" view.

## 5. Extend: new abilities for Claude

- **Team tools.** Register a `graph_find` tool so Claude can query the team's knowledge graph directly, instead of running a script by hand.
- **Helper agents.** Register a "reviewer" agent type with a fixed prompt and read-only tools, which Claude can call on its own work.

---

## Mods compared with the other ways to change Claude Code

- **Instruction files** (AGENTS.md, CLAUDE.md): Claude reads them and usually follows them. Nothing stops a slip.
- **Skills:** instructions Claude loads when a task matches. Same limit: advice, not enforcement.
- **Shell hooks in settings.json:** run a script at set moments and can block. No screen of their own, one process per call.
- **MCP servers:** give Claude new tools. They cannot see or stop what Claude does.
- **Mods:** see every event, block or rewrite it, draw on the screen, keep state, run timers. One TypeScript file, reloaded on save.

Use a mod when you need **enforcement you can see**, or **live information on screen**. Use an instruction file when advice is enough.

---

## Limits to know

- **Claude Code only.** Other agent CLIs cannot run mods.
- **Early access.** The API changes between releases. Run `claude plugin validate` after each Claude Code update.
- **One machine.** A mod loads with `claude --plugin-dir <folder>`, so each person runs it themselves. To share, put the folder in a repo and give the command.
- **No Node.** A mod can't `import fs`. Files and commands go through `$.fs` and `$.process`.
