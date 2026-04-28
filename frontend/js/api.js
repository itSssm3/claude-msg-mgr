// API wrapper for Wails Go bindings
// Wails auto-generates window.go.main.App.* methods during build

function wrapError(err) {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    if (err && typeof err.message === 'string') return new Error(err.message);
    if (err && typeof err.toString === 'function') return new Error(err.toString());
    return new Error('Unknown error');
}

async function callGo(method, ...args) {
    try {
        return await method(...args);
    } catch (err) {
        throw wrapError(err);
    }
}

const API = {
    async getProjects() {
        return await callGo(window.go.main.App.GetProjects);
    },

    async getProjectSessions(projectName) {
        return await callGo(window.go.main.App.GetProjectSessions, projectName);
    },

    async getMessages(projectName, sessionID) {
        return await callGo(window.go.main.App.GetMessages, projectName, sessionID);
    },

    async getMessageRaw(projectName, sessionID, messageUUID) {
        return await callGo(window.go.main.App.GetMessageRaw, projectName, sessionID, messageUUID);
    },

    async updateMessageText(projectName, sessionID, messageUUID, newText) {
        return await callGo(window.go.main.App.UpdateMessageText, projectName, sessionID, messageUUID, newText);
    },

    async deleteMessage(projectName, sessionID, messageUUID) {
        return await callGo(window.go.main.App.DeleteMessage, projectName, sessionID, messageUUID);
    },

    async deleteMessages(projectName, sessionID, messageUUIDs) {
        return await callGo(window.go.main.App.DeleteMessages, projectName, sessionID, messageUUIDs);
    },

    async searchAcrossProjects(query, caseSensitive, limit) {
        return await callGo(window.go.main.App.SearchAcrossProjects, query, caseSensitive, limit);
    },

    async searchInSession(projectName, sessionID, query, caseSensitive, limit) {
        return await callGo(window.go.main.App.SearchInSession, projectName, sessionID, query, caseSensitive, limit);
    },

    async renameProject(oldName, newPath) {
        return await callGo(window.go.main.App.RenameProject, oldName, newPath);
    },

    async deleteSession(projectName, sessionID) {
        return await callGo(window.go.main.App.DeleteSession, projectName, sessionID);
    },

    async deleteProject(name) {
        return await callGo(window.go.main.App.DeleteProject, name);
    },

    async copyProject(sourceName, targetPath) {
        return await callGo(window.go.main.App.CopyProject, sourceName, targetPath);
    },

    async getClaudeDir() {
        return await callGo(window.go.main.App.GetClaudeDir);
    },

    async unescapeProjectName(escapedName) {
        return await callGo(window.go.main.App.UnescapeProjectName, escapedName);
    },

    async escapeProjectPath(path) {
        return await callGo(window.go.main.App.EscapeProjectPath, path);
    }
};
