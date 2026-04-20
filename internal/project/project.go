package project

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"claude-msg-mgr/internal/models"
	"claude-msg-mgr/internal/store"
)

// safeJoin joins base with name and verifies the result is still under base.
// Returns an error if the joined path escapes the base directory (path traversal).
func safeJoin(base, name string) (string, error) {
	joined := filepath.Join(base, name)
	rel, err := filepath.Rel(base, joined)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("invalid path: %q escapes base directory", name)
	}
	return joined, nil
}

// GetClaudeProjectsDir resolves ~/.claude/projects across platforms.
func GetClaudeProjectsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".claude", "projects"), nil
}

// Manager handles project discovery and manipulation.
type Manager struct {
	projectsDir string
}

// NewManager creates a new project manager.
func NewManager() (*Manager, error) {
	dir, err := GetClaudeProjectsDir()
	if err != nil {
		return nil, err
	}
	return &Manager{projectsDir: dir}, nil
}

// ListProjects discovers all projects with metadata.
func (m *Manager) ListProjects() ([]models.ProjectInfo, error) {
	entries, err := os.ReadDir(m.projectsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.ProjectInfo{}, nil
		}
		return nil, err
	}

	var projects []models.ProjectInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		projectPath := filepath.Join(m.projectsDir, name)

		// Count JSONL files and messages
		files, err := os.ReadDir(projectPath)
		if err != nil {
			continue
		}

		sessionCount := 0
		totalMessages := 0
		var lastMod time.Time

		for _, f := range files {
			if f.IsDir() || filepath.Ext(f.Name()) != ".jsonl" {
				continue
			}
			sessionCount++

			info, err := f.Info()
			if err == nil && info.ModTime().After(lastMod) {
				lastMod = info.ModTime()
			}

			// Count messages in file
			jsonlPath := filepath.Join(projectPath, f.Name())
			msgs, err := store.ReadMessagesStream(jsonlPath, []models.MessageType{
				models.TypeUser,
				models.TypeAssistant,
			})
			if err == nil {
				totalMessages += len(msgs)
			}
		}

		projects = append(projects, models.ProjectInfo{
			Name:          name,
			DisplayPath:   UnescapePath(name),
			SessionCount:  sessionCount,
			TotalMessages: totalMessages,
			LastModified:  lastMod,
		})
	}

	// Sort by last modified descending (most recent first)
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].LastModified.After(projects[j].LastModified)
	})

	return projects, nil
}

// ListSessions returns all JSONL session files in a project, sorted by modification time (newest first).
func (m *Manager) ListSessions(projectName string) ([]string, error) {
	projectPath, err := safeJoin(m.projectsDir, projectName)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(projectPath)
	if err != nil {
		return nil, err
	}

	type sessionFile struct {
		id    string
		mtime time.Time
	}

	var files []sessionFile
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsonl" {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, sessionFile{
			id:    strings.TrimSuffix(entry.Name(), ".jsonl"),
			mtime: info.ModTime(),
		})
	}

	// Sort by modification time descending
	sort.Slice(files, func(i, j int) bool {
		return files[i].mtime.After(files[j].mtime)
	})

	sessions := make([]string, len(files))
	for i, f := range files {
		sessions[i] = f.id
	}
	return sessions, nil
}

// GetSessionPath returns the full path to a session JSONL file.
// Returns an error string placeholder on invalid input; callers should use SafeSessionPath.
func (m *Manager) GetSessionPath(projectName, sessionID string) string {
	return filepath.Join(m.projectsDir, projectName, sessionID+".jsonl")
}

// SafeSessionPath returns the full path to a session JSONL file,
// validating that both projectName and sessionID stay within projectsDir.
func (m *Manager) SafeSessionPath(projectName, sessionID string) (string, error) {
	projectPath, err := safeJoin(m.projectsDir, projectName)
	if err != nil {
		return "", err
	}
	sessionPath, err := safeJoin(projectPath, sessionID+".jsonl")
	if err != nil {
		return "", err
	}
	return sessionPath, nil
}

// RenameProject renames a project folder (re-escapes new path).
func (m *Manager) RenameProject(oldName, newPath string) (string, error) {
	newName := EscapePath(newPath)
	if newName == "" {
		return "", fmt.Errorf("invalid path: %s", newPath)
	}

	oldPath, err := safeJoin(m.projectsDir, oldName)
	if err != nil {
		return "", err
	}
	newFullPath, err := safeJoin(m.projectsDir, newName)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(newFullPath); err == nil {
		return "", fmt.Errorf("target already exists: %s", newName)
	}

	return newName, os.Rename(oldPath, newFullPath)
}

// DeleteProject removes a project folder and all its sessions.
func (m *Manager) DeleteProject(name string) error {
	path, err := safeJoin(m.projectsDir, name)
	if err != nil {
		return err
	}
	return os.RemoveAll(path)
}

// CopyProject copies all JSONL files to a new project name.
func (m *Manager) CopyProject(sourceName, targetPath string) (string, error) {
	targetName := EscapePath(targetPath)
	if targetName == "" {
		return "", fmt.Errorf("invalid path: %s", targetPath)
	}

	sourcePath, err := safeJoin(m.projectsDir, sourceName)
	if err != nil {
		return "", err
	}
	targetFullPath, err := safeJoin(m.projectsDir, targetName)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(targetFullPath); err == nil {
		return "", fmt.Errorf("target already exists: %s", targetName)
	}

	if err := os.MkdirAll(targetFullPath, 0755); err != nil {
		return "", err
	}

	entries, err := os.ReadDir(sourcePath)
	if err != nil {
		return "", err
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsonl" {
			continue
		}

		src := filepath.Join(sourcePath, entry.Name())
		dst := filepath.Join(targetFullPath, entry.Name())

		data, err := os.ReadFile(src)
		if err != nil {
			return "", err
		}
		if err := os.WriteFile(dst, data, 0644); err != nil {
			return "", err
		}
	}

	return targetName, nil
}

// EscapePath converts a filesystem path to Claude Code's escaped folder name.
func EscapePath(path string) string {
	normalized := filepath.ToSlash(path)
	if len(normalized) > 1 && normalized[1] == ':' {
		normalized = normalized[0:1] + normalized[2:]
	}
	normalized = strings.ReplaceAll(normalized, "/", "--")
	normalized = strings.ReplaceAll(normalized, "\\", "--")
	return strings.ToLower(normalized)
}

// UnescapePath converts escaped folder name back to display path.
func UnescapePath(escaped string) string {
	sep := string(filepath.Separator)
	path := strings.ReplaceAll(escaped, "--", sep)

	if runtime.GOOS == "windows" && len(path) > 1 {
		c := path[0]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') {
			// Check if second char is separator
			if path[1] == sep[0] || path[1] == '/' || path[1] == '\\' {
				path = string(c) + ":" + path[1:]
			}
		}
	}
	return path
}
