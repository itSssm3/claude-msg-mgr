package main

import (
	"context"
	"fmt"
	"os"

	"claude-msg-mgr/internal/models"
	"claude-msg-mgr/internal/project"
	"claude-msg-mgr/internal/search"
	"claude-msg-mgr/internal/store"
)

// App struct
type App struct {
	ctx      context.Context
	mgr      *project.Manager
	searcher *search.Engine
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	mgr, err := project.NewManager()
	if err != nil {
		panic(err)
	}
	a.mgr = mgr
	a.searcher = search.NewEngine(mgr)
}

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {
}

// --- Project Management ---

// GetProjects lists all projects with metadata
func (a *App) GetProjects() ([]models.ProjectInfo, error) {
	return a.mgr.ListProjects()
}

// GetProjectSessions lists all JSONL session files in a project
func (a *App) GetProjectSessions(projectName string) ([]string, error) {
	return a.mgr.ListSessions(projectName)
}

// RenameProject renames a project folder
func (a *App) RenameProject(oldName, newPath string) (string, error) {
	return a.mgr.RenameProject(oldName, newPath)
}

// CopyProject copies all JSONL files to a new project name
func (a *App) CopyProject(sourceName, targetPath string) (string, error) {
	return a.mgr.CopyProject(sourceName, targetPath)
}

// DeleteProject removes a project folder and all its sessions.
func (a *App) DeleteProject(name string) error {
	return a.mgr.DeleteProject(name)
}

// DeleteSession removes a session JSONL file.
func (a *App) DeleteSession(projectName, sessionID string) error {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return err
	}
	return os.Remove(path)
}

// --- Message Thread Operations ---

// GetMessages loads and parses a JSONL file, returns displayable message thread
func (a *App) GetMessages(projectName, sessionID string) ([]models.DisplayMessage, error) {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return nil, err
	}
	entries, err := store.ReadMessagesStream(path, []models.MessageType{
		models.TypeUser,
		models.TypeAssistant,
	})
	if err != nil {
		return nil, err
	}
	return store.ToDisplayMessages(entries), nil
}

// GetMessageRaw returns the full JSONLEntry for editing
func (a *App) GetMessageRaw(projectName, sessionID, messageUUID string) (*models.JSONLEntry, error) {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return nil, err
	}
	entries, err := store.ReadAllEntries(path)
	if err != nil {
		return nil, err
	}
	for i := range entries {
		if entries[i].UUID == messageUUID {
			return &entries[i], nil
		}
	}
	return nil, fmt.Errorf("message %s not found", messageUUID)
}

// UpdateMessageText edits the text content of a user or assistant message
func (a *App) UpdateMessageText(projectName, sessionID, messageUUID, newText string) error {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return err
	}
	entries, err := store.ReadAllEntries(path)
	if err != nil {
		return err
	}
	entries, err = store.UpdateMessageText(entries, messageUUID, newText)
	if err != nil {
		return err
	}
	return store.WriteMessagesAtomic(path, entries)
}

// DeleteMessage removes a message and repairs parentUuid chain
func (a *App) DeleteMessage(projectName, sessionID, messageUUID string) error {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return err
	}
	entries, err := store.ReadAllEntries(path)
	if err != nil {
		return err
	}
	entries, err = store.DeleteMessageWithRepair(entries, messageUUID)
	if err != nil {
		return err
	}
	return store.WriteMessagesAtomic(path, entries)
}

// SaveMessages writes the modified message list back to JSONL atomically
func (a *App) SaveMessages(projectName, sessionID string, messages []models.JSONLEntry) error {
	path, err := a.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return err
	}
	return store.WriteMessagesAtomic(path, messages)
}

// --- Search ---

// SearchAcrossProjects searches keyword across all projects
func (a *App) SearchAcrossProjects(query string, caseSensitive bool, limit int) ([]models.SearchResult, error) {
	return a.searcher.SearchAcrossProjects(query, caseSensitive, limit)
}

// SearchInSession searches within a single session
func (a *App) SearchInSession(projectName, sessionID, query string, caseSensitive bool, limit int) ([]models.SearchResult, error) {
	return a.searcher.SearchInSession(projectName, sessionID, query, caseSensitive, limit)
}

// --- Utility ---

// GetClaudeDir returns the resolved ~/.claude/projects path
func (a *App) GetClaudeDir() string {
	dir, _ := project.GetClaudeProjectsDir()
	return dir
}

// UnescapeProjectName converts escaped name to actual path
func (a *App) UnescapeProjectName(escapedName string) string {
	return project.UnescapePath(escapedName)
}

// EscapeProjectPath converts actual path to escaped name
func (a *App) EscapeProjectPath(path string) string {
	return project.EscapePath(path)
}
