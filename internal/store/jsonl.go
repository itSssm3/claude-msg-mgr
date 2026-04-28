package store

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"claude-msg-mgr/internal/models"
)

// ReadMessagesStream parses a JSONL file using streaming.
// Uses bufio.Scanner with custom buffer for large lines.
func ReadMessagesStream(path string, filterTypes []models.MessageType) ([]models.JSONLEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	const maxCapacity = 10 * 1024 * 1024 // 10MB
	buf := make([]byte, maxCapacity)
	scanner.Buffer(buf, maxCapacity)

	var entries []models.JSONLEntry

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry models.JSONLEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			// Log and skip malformed lines
			fmt.Printf("WARN: skipping malformed JSONL line: %v\n", err)
			continue
		}

		if len(filterTypes) > 0 {
			match := false
			for _, ft := range filterTypes {
				if entry.Type == ft {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		}

		entries = append(entries, entry)
	}

	return entries, scanner.Err()
}

// ReadAllEntries reads all entries from a JSONL file without filtering.
func ReadAllEntries(path string) ([]models.JSONLEntry, error) {
	return ReadMessagesStream(path, nil)
}

// WriteMessagesAtomic writes entries back to JSONL atomically.
// Uses write-to-temp + rename pattern to prevent corruption.
func WriteMessagesAtomic(path string, entries []models.JSONLEntry) error {
	dir := filepath.Dir(path)
	tempFile, err := os.CreateTemp(dir, "*.tmp")
	if err != nil {
		return err
	}
	tempPath := tempFile.Name()

	writer := bufio.NewWriter(tempFile)
	for _, entry := range entries {
		data, err := json.Marshal(entry)
		if err != nil {
			tempFile.Close()
			os.Remove(tempPath)
			return err
		}
		if _, err := writer.Write(data); err != nil {
			tempFile.Close()
			os.Remove(tempPath)
			return err
		}
		if err := writer.WriteByte('\n'); err != nil {
			tempFile.Close()
			os.Remove(tempPath)
			return err
		}
	}

	if err := writer.Flush(); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return err
	}
	if err := tempFile.Sync(); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return err
	}
	if err := tempFile.Close(); err != nil {
		os.Remove(tempPath)
		return err
	}

	return os.Rename(tempPath, path)
}

// DeleteMessageWithRepair removes a message and fixes parentUuid chain.
func DeleteMessageWithRepair(entries []models.JSONLEntry, targetUUID string) ([]models.JSONLEntry, error) {
	indexByUUID := make(map[string]int)
	childrenByParent := make(map[string][]string)

	for i, e := range entries {
		if e.UUID != "" {
			indexByUUID[e.UUID] = i
		}
		if e.ParentUUID != nil && *e.ParentUUID != "" {
			parent := *e.ParentUUID
			childrenByParent[parent] = append(childrenByParent[parent], e.UUID)
		}
	}

	targetIdx, ok := indexByUUID[targetUUID]
	if !ok {
		return nil, fmt.Errorf("message %s not found", targetUUID)
	}

	target := entries[targetIdx]
	var targetParent *string
	if target.ParentUUID != nil {
		targetParent = target.ParentUUID
	}

	// Repoint all direct children to target's parent
	children := childrenByParent[targetUUID]
	for _, childUUID := range children {
		if childIdx, ok := indexByUUID[childUUID]; ok {
			entries[childIdx].ParentUUID = targetParent
		}
	}

	// Remove target from slice
	result := make([]models.JSONLEntry, 0, len(entries)-1)
	for i, e := range entries {
		if i != targetIdx {
			result = append(result, e)
		}
	}

	return result, nil
}

// DeleteMessagesWithRepair removes multiple messages and repairs parentUuid chain.
func DeleteMessagesWithRepair(entries []models.JSONLEntry, targetUUIDs []string) ([]models.JSONLEntry, error) {
	toDelete := make(map[string]bool, len(targetUUIDs))
	for _, uuid := range targetUUIDs {
		toDelete[uuid] = true
	}

	indexByUUID := make(map[string]int)
	childrenByParent := make(map[string][]string)

	for i, e := range entries {
		if e.UUID != "" {
			indexByUUID[e.UUID] = i
		}
		if e.ParentUUID != nil && *e.ParentUUID != "" {
			parent := *e.ParentUUID
			childrenByParent[parent] = append(childrenByParent[parent], e.UUID)
		}
	}

	for _, uuid := range targetUUIDs {
		if _, ok := indexByUUID[uuid]; !ok {
			return nil, fmt.Errorf("message %s not found", uuid)
		}
	}

	for _, uuid := range targetUUIDs {
		targetIdx := indexByUUID[uuid]
		target := entries[targetIdx]
		var targetParent *string
		if target.ParentUUID != nil {
			targetParent = target.ParentUUID
		}

		children := childrenByParent[uuid]
		for _, childUUID := range children {
			if toDelete[childUUID] {
				continue
			}
			if childIdx, ok := indexByUUID[childUUID]; ok {
				entries[childIdx].ParentUUID = targetParent
			}
		}
	}

	result := make([]models.JSONLEntry, 0, len(entries)-len(targetUUIDs))
	for _, e := range entries {
		if !toDelete[e.UUID] {
			result = append(result, e)
		}
	}

	return result, nil
}

// UpdateMessageText edits the text content of a user or assistant message.
func UpdateMessageText(entries []models.JSONLEntry, targetUUID string, newText string) ([]models.JSONLEntry, error) {
	found := false
	for i := range entries {
		if entries[i].UUID != targetUUID {
			continue
		}
		if entries[i].Message == nil {
			return nil, fmt.Errorf("message %s has no message payload", targetUUID)
		}

		// Update text content blocks
		for j := range entries[i].Message.Content {
			if entries[i].Message.Content[j].Type == "text" {
				entries[i].Message.Content[j].Text = newText
				found = true
				break
			}
		}
		break
	}

	if !found {
		return nil, fmt.Errorf("message %s not found or has no text content", targetUUID)
	}
	return entries, nil
}

// ToDisplayMessages converts JSONLEntries to DisplayMessages for frontend.
func ToDisplayMessages(entries []models.JSONLEntry) []models.DisplayMessage {
	var result []models.DisplayMessage
	for _, e := range entries {
		if e.Type != models.TypeUser && e.Type != models.TypeAssistant {
			continue
		}
		if e.Message == nil {
			continue
		}

		dm := models.DisplayMessage{
			UUID:      e.UUID,
			ParentUUID: e.ParentUUID,
			Type:      string(e.Type),
			Role:      e.Message.Role,
			Model:     e.Message.Model,
			Timestamp: e.Timestamp,
		}

		if e.Message.Usage != nil {
			dm.TokenCount = e.Message.Usage.InputTokens + e.Message.Usage.OutputTokens
		}

		for _, block := range e.Message.Content {
			switch block.Type {
			case "text":
				dm.Text = block.Text
			case "thinking":
				dm.Thinking = block.Thinking
			case "tool_use", "tool_result":
				dm.HasTools = true
				dm.ToolCount++
				tool := models.ToolInfo{
					Type:      block.Type,
					Name:      block.Name,
					Input:     block.Input,
					Content:   block.Content.TextContent(),
					ToolUseID: block.ToolUseID,
					IsError:   block.IsError,
				}
				dm.Tools = append(dm.Tools, tool)
			}
		}

		result = append(result, dm)
	}
	return result
}
