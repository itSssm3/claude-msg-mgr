package models

import (
	"encoding/json"
	"strings"
	"time"
)

// MessageType enumerates all known JSONL entry types.
type MessageType string

const (
	TypeUser                MessageType = "user"
	TypeAssistant           MessageType = "assistant"
	TypeQueueOperation      MessageType = "queue-operation"
	TypeAttachment          MessageType = "attachment"
	TypeFileHistorySnapshot MessageType = "file-history-snapshot"
	TypeLastPrompt          MessageType = "last-prompt"
)

// ContentBlock represents a single block in message.content array.
type ContentBlock struct {
	Type      string                 `json:"type"`                  // "text", "thinking", "tool_use", "tool_result"
	Text      string                 `json:"text,omitempty"`        // for type="text"
	Thinking  string                 `json:"thinking,omitempty"`    // for type="thinking"
	ToolUseID string                 `json:"tool_use_id,omitempty"` // for type="tool_result"
	Name      string                 `json:"name,omitempty"`        // for type="tool_use"
	Input     map[string]interface{} `json:"input,omitempty"`       // for type="tool_use"
	Content   ContentBlocks          `json:"content,omitempty"`     // for type="tool_result" (string or array)
	IsError   bool                   `json:"is_error,omitempty"`    // for type="tool_result"
}

// ContentBlocks is a custom type that unmarshals from either a string
// (user's plain text input) or a []ContentBlock array (assistant/tool output).
type ContentBlocks []ContentBlock

func (c *ContentBlocks) UnmarshalJSON(data []byte) error {
	// Check if it's a JSON string (plain text user input)
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		*c = []ContentBlock{{Type: "text", Text: s}}
		return nil
	}
	// Otherwise unmarshal as array of ContentBlock
	var blocks []ContentBlock
	if err := json.Unmarshal(data, &blocks); err != nil {
		return err
	}
	*c = blocks
	return nil
}

// TextContent concatenates all text-type blocks into a single string.
// Non-text blocks (images, etc.) are summarized as placeholders.
func (c ContentBlocks) TextContent() string {
	var parts []string
	for _, b := range c {
		switch b.Type {
		case "text":
			if b.Text != "" {
				parts = append(parts, b.Text)
			}
		case "image":
			parts = append(parts, "[image]")
		default:
			if b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
	}
	return strings.Join(parts, "\n")
}

// MessagePayload is the nested message object for user/assistant types.
type MessagePayload struct {
	ID      string        `json:"id,omitempty"`
	Type    string        `json:"type,omitempty"` // "message"
	Role    string        `json:"role"`           // "user" or "assistant"
	Content ContentBlocks `json:"content"`
	Model   string        `json:"model,omitempty"`
	Usage   *UsageStats   `json:"usage,omitempty"`
}

// UsageStats holds token usage information.
type UsageStats struct {
	InputTokens              int `json:"input_tokens"`
	OutputTokens             int `json:"output_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
}

// AttachmentPayload represents attachment data.
type AttachmentPayload struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
}

// FileHistorySnapshot represents a file history snapshot entry.
type FileHistorySnapshot struct {
	MessageID          string                 `json:"messageId"`
	TrackedFileBackups map[string]interface{} `json:"trackedFileBackups"`
	Timestamp          time.Time              `json:"timestamp"`
}

// JSONLEntry represents a single line in the JSONL file.
type JSONLEntry struct {
	// Common fields
	UUID       string      `json:"uuid"`
	ParentUUID *string     `json:"parentUuid"`
	Type       MessageType `json:"type"`
	Timestamp  time.Time   `json:"timestamp"`
	SessionID  string      `json:"sessionId"`
	CWD        string      `json:"cwd"`

	// User/Assistant specific
	Message *MessagePayload `json:"message,omitempty"`

	// Attachment specific
	Attachment *AttachmentPayload `json:"attachment,omitempty"`

	// Queue operation specific
	Operation string `json:"operation,omitempty"`

	// File history snapshot
	Snapshot *FileHistorySnapshot `json:"snapshot,omitempty"`

	// Last prompt
	LastPrompt string `json:"lastPrompt,omitempty"`

	// Other metadata
	IsSidechain    bool   `json:"isSidechain"`
	PromptID       string `json:"promptId,omitempty"`
	UserType       string `json:"userType,omitempty"`
	Entrypoint     string `json:"entrypoint,omitempty"`
	Version        string `json:"version,omitempty"`
	GitBranch      string `json:"gitBranch,omitempty"`
	Slug           string `json:"slug,omitempty"`
	PermissionMode string `json:"permissionMode,omitempty"`
}

// ToolInfo holds details about a single tool_use or tool_result block.
type ToolInfo struct {
	Type      string                 `json:"type"`      // "tool_use" | "tool_result"
	Name      string                 `json:"name"`      // tool name (tool_use only)
	Input     map[string]interface{} `json:"input"`     // tool arguments (tool_use only)
	Content   string                 `json:"content"`   // result text (tool_result only)
	ToolUseID string                 `json:"toolUseId"` // correlation ID
	IsError   bool                   `json:"isError"`   // result was an error
}

// DisplayMessage is a flattened structure for frontend consumption.
type DisplayMessage struct {
	UUID       string     `json:"uuid"`
	ParentUUID *string    `json:"parentUuid"`
	Type       string     `json:"type"` // "user" | "assistant"
	Role       string     `json:"role"`
	Text       string     `json:"text"`     // Extracted text content
	Thinking   string     `json:"thinking"` // Extracted thinking content
	Model      string     `json:"model"`
	Timestamp  time.Time  `json:"timestamp"`
	TokenCount int        `json:"tokenCount"`
	HasTools   bool       `json:"hasTools"`
	ToolCount  int        `json:"toolCount"`
	Tools      []ToolInfo `json:"tools"` // Detailed tool info
}

// ProjectInfo represents a discovered project.
type ProjectInfo struct {
	Name          string    `json:"name"`
	DisplayPath   string    `json:"displayPath"`
	SessionCount  int       `json:"sessionCount"`
	TotalMessages int       `json:"totalMessages"`
	LastModified  time.Time `json:"lastModified"`
}

// SearchResult represents a single search hit.
type SearchResult struct {
	ProjectName string    `json:"projectName"`
	SessionID   string    `json:"sessionId"`
	MessageUUID string    `json:"messageUuid"`
	Type        string    `json:"type"`
	Text        string    `json:"text"`
	Timestamp   time.Time `json:"timestamp"`
}
