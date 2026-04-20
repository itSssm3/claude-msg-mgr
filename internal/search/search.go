package search

import (
	"strings"

	"claude-msg-mgr/internal/models"
	"claude-msg-mgr/internal/project"
	"claude-msg-mgr/internal/store"
)

// Engine handles full-text search across projects.
type Engine struct {
	mgr *project.Manager
}

// NewEngine creates a new search engine.
func NewEngine(mgr *project.Manager) *Engine {
	return &Engine{mgr: mgr}
}

// SearchAcrossProjects searches keyword across all projects.
func (e *Engine) SearchAcrossProjects(query string, caseSensitive bool, limit int) ([]models.SearchResult, error) {
	if limit <= 0 {
		limit = 100
	}

	projects, err := e.mgr.ListProjects()
	if err != nil {
		return nil, err
	}

	var results []models.SearchResult
	searchTerm := query
	if !caseSensitive {
		searchTerm = strings.ToLower(query)
	}

	for _, proj := range projects {
		if len(results) >= limit {
			break
		}

		sessions, err := e.mgr.ListSessions(proj.Name)
		if err != nil {
			continue
		}

		for _, sessionID := range sessions {
			if len(results) >= limit {
				break
			}

			path, err := e.mgr.SafeSessionPath(proj.Name, sessionID)
			if err != nil {
				continue
			}
			entries, err := store.ReadAllEntries(path)
			if err != nil {
				continue
			}

		entryLoop:
			for _, entry := range entries {
				if entry.Type != models.TypeUser && entry.Type != models.TypeAssistant {
					continue
				}
				if entry.Message == nil {
					continue
				}

				for _, block := range entry.Message.Content {
					if block.Type != "text" {
						continue
					}

					text := block.Text
					compareText := text
					if !caseSensitive {
						compareText = strings.ToLower(text)
					}

					if !strings.Contains(compareText, searchTerm) {
						continue
					}

					// Extract snippet with context
					snippet := extractSnippet(text, query, caseSensitive)

					results = append(results, models.SearchResult{
						ProjectName: proj.Name,
						SessionID:   sessionID,
						MessageUUID: entry.UUID,
						Type:        string(entry.Type),
						Text:        snippet,
						Timestamp:   entry.Timestamp,
					})

					if len(results) >= limit {
						break entryLoop
					}
				}
			}
		}
	}

	return results, nil
}

// SearchInSession searches within a single session.
func (e *Engine) SearchInSession(projectName, sessionID, query string, caseSensitive bool, limit int) ([]models.SearchResult, error) {
	if limit <= 0 {
		limit = 100
	}

	path, err := e.mgr.SafeSessionPath(projectName, sessionID)
	if err != nil {
		return nil, err
	}
	entries, err := store.ReadAllEntries(path)
	if err != nil {
		return nil, err
	}

	var results []models.SearchResult
	searchTerm := query
	if !caseSensitive {
		searchTerm = strings.ToLower(query)
	}

entryLoop:
	for _, entry := range entries {
		if entry.Type != models.TypeUser && entry.Type != models.TypeAssistant {
			continue
		}
		if entry.Message == nil {
			continue
		}

		for _, block := range entry.Message.Content {
			if block.Type != "text" {
				continue
			}

			text := block.Text
			compareText := text
			if !caseSensitive {
				compareText = strings.ToLower(text)
			}

			if !strings.Contains(compareText, searchTerm) {
				continue
			}

			snippet := extractSnippet(text, query, caseSensitive)

			results = append(results, models.SearchResult{
				ProjectName: projectName,
				SessionID:   sessionID,
				MessageUUID: entry.UUID,
				Type:        string(entry.Type),
				Text:        snippet,
				Timestamp:   entry.Timestamp,
			})

			if len(results) >= limit {
				break entryLoop
			}
		}
	}

	return results, nil
}

// extractSnippet extracts a snippet around the search term.
// The returned snippet always preserves the original casing of text.
func extractSnippet(text, query string, caseSensitive bool) string {
	const contextLen = 60
	const maxLen = 200

	// Use case-folded copies only for index detection; keep original text for output.
	compareText := text
	searchTerm := query
	if !caseSensitive {
		compareText = strings.ToLower(text)
		searchTerm = strings.ToLower(query)
	}

	idx := strings.Index(compareText, searchTerm)
	if idx == -1 {
		if len(text) > maxLen {
			return text[:maxLen] + "..."
		}
		return text
	}

	start := idx - contextLen
	if start < 0 {
		start = 0
	}
	end := idx + len(searchTerm) + contextLen
	if end > len(text) {
		end = len(text)
	}

	snippet := text[start:end]
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(text) {
		snippet = snippet + "..."
	}

	return snippet
}
