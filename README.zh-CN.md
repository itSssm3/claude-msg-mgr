# Claude Code 消息管理器

[English](README.md) | [中文](README.zh-CN.md)

用于浏览、搜索、编辑和管理 Claude Code 对话历史的桌面 GUI 工具。

## 功能

- **浏览** — 列出所有项目及其会话，查看 user/assistant 对话线程
- **搜索** — 跨所有项目和会话的全文搜索；点击结果直接跳转到对应消息
- **编辑** — 就地修改消息文本内容
- **删除** — 删除单条消息，或整个会话/项目
- **重命名 / 复制** — 将对话历史迁移到新项目路径
- **视觉层级** — 有实际文本内容的 user/assistant 消息以蓝色/紫色边框突出显示；纯 thinking / 纯 tool 消息以灰色低调呈现
- **消息折叠** — 长消息自动折叠，点击展开
- **Tool 详情** — 可展开查看 tool_use 参数和 tool_result 返回值

## 下载

从 [Releases](../../releases) 下载预编译二进制文件，或从源码构建：

```bash
# 需要 Go 1.21+ 和 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails build
```

构建产物位于 `build/bin/claude-msg-mgr`。

> If you are using a Linux distribution that does not have webkit2gtk-4.0 (such as Ubuntu 24.04), you will need to add `-tags webkit2_41`. — [Wails 文档](https://wails.io/docs/gettingstarted/building/)
>
> **解决方案：** 下载 `linux-amd64-webkit2_41` 版本，或自行编译：
> ```bash
> wails build -tags webkit2_41
> ```

## 使用

1. 启动应用 — 自动读取 `~/.claude/projects/`
2. 从左侧边栏选择项目，再从下拉框选择会话
3. 点击消息可编辑，点击垃圾桶图标可删除
4. 使用右上角搜索按钮跨项目搜索

> **建议：** 批量操作前请备份 `~/.claude/projects/`。

## 数据来源

读取 Claude Code 的消息历史目录：

```
~/.claude/projects/<项目名称>/*.jsonl
```

兼容 VS Code 扩展和 CLI 两种入口方式。

## 许可证

MIT
