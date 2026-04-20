# Claude Code Message Manager

[English](README.md) | [中文](README.zh-CN.md)

A desktop GUI tool for browsing, searching, editing, and managing Claude Code conversation history.

## Features

- **Browse** — List all projects and their sessions, view user/assistant conversation threads
- **Search** — Full-text search across all projects and sessions; click results to jump directly to the matching message
- **Edit** — Modify message text content in-place
- **Delete** — Remove individual messages or entire sessions/projects
- **Rename / Copy** — Migrate conversation history to a new project path
- **Visual Hierarchy** — Messages with actual text content are highlighted with blue (user) / purple (assistant) borders; thinking-only / tool-only messages are shown in gray
- **Message Collapse** — Long messages auto-fold; click to expand
- **Tool Details** — Expandable tool_use / tool_result blocks

## Download

Download the prebuilt binary from [Releases](../../releases), or build from source:

```bash
# Requires Go 1.21+ and Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails build
```

The binary will be at `build/bin/claude-msg-mgr`.

> If you are using a Linux distribution that does not have webkit2gtk-4.0 (such as Ubuntu 24.04), you will need to add `-tags webkit2_41`. — [Wails Docs](https://wails.io/docs/gettingstarted/building/)
>
> **Solution:** Download the `linux-amd64-webkit2_41` release asset, or build manually:
> ```bash
> wails build -tags webkit2_41
> ```

## Usage

1. Launch the app — it automatically reads from `~/.claude/projects/`
2. Select a project from the left sidebar, then a session from the dropdown
3. Click any message to edit, or the trash icon to delete
4. Use the search button (top-right) to search across all projects

> **Backup recommendation:** Before bulk edits, back up `~/.claude/projects/`.

## Data Source

Reads Claude Code's message history from:

```
~/.claude/projects/<project-name>/*.jsonl
```

Compatible with both VS Code extension and CLI entrypoints.

## License

MIT
