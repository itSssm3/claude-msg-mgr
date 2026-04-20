// Main application logic
let projectList;
let messageThread;
let messageEditor;
let searchPanel;
let currentProject = null;

// DOM elements
const projectListEl = document.getElementById('project-list');
const projectSearchEl = document.getElementById('project-search');
const refreshBtn = document.getElementById('refresh-btn');
const sessionSelect = document.getElementById('session-select');
const messageCountEl = document.getElementById('message-count');
const messageThreadEl = document.getElementById('message-thread');
const globalSearchBtn = document.getElementById('global-search-btn');
const renameProjectBtn = document.getElementById('rename-project-btn');
const copyProjectBtn = document.getElementById('copy-project-btn');
const deleteSessionBtn = document.getElementById('delete-session-btn');

// Modals
const editorModal = document.getElementById('message-editor-modal');
const editorTextarea = document.getElementById('editor-textarea');
const editorSave = document.getElementById('editor-save');
const editorCancel = document.getElementById('editor-cancel');

const searchModal = document.getElementById('search-modal');
const searchInput = document.getElementById('search-input');
const searchCase = document.getElementById('search-case');
const searchRun = document.getElementById('search-run');
const searchClose = document.getElementById('search-close');
const searchResults = document.getElementById('search-results');

const renameModal = document.getElementById('rename-modal');
const renameCurrent = document.getElementById('rename-current');
const renameInput = document.getElementById('rename-input');
const renameCancel = document.getElementById('rename-cancel');
const renameConfirm = document.getElementById('rename-confirm');

const copyModal = document.getElementById('copy-modal');
const copySource = document.getElementById('copy-source');
const copyInput = document.getElementById('copy-input');
const copyCancel = document.getElementById('copy-cancel');
const copyConfirm = document.getElementById('copy-confirm');

// Initialize
async function init() {
    projectList = new ProjectList(projectListEl, handleProjectSelect, handleProjectDelete);
    messageThread = new MessageThread(messageThreadEl);
    messageEditor = new MessageEditor(editorModal, editorTextarea, editorSave, editorCancel);
    searchPanel = new SearchPanel(searchModal, searchInput, searchCase, searchRun, searchClose, searchResults);

    messageThread.onEdit = handleMessageEdit;
    messageThread.onDelete = handleMessageDelete;
    messageEditor.onSave = handleEditorSave;
    searchPanel.onResultClick = handleSearchResultClick;

    // Event listeners
    projectSearchEl.addEventListener('input', (e) => {
        projectList.setFilter(e.target.value);
    });

    refreshBtn.addEventListener('click', () => {
        projectList.load();
    });

    sessionSelect.addEventListener('change', (e) => {
        if (currentProject && e.target.value) {
            messageThread.load(currentProject.name, e.target.value);
        }
    });

    globalSearchBtn.addEventListener('click', () => {
        searchPanel.open();
    });

    renameProjectBtn.addEventListener('click', () => {
        if (!currentProject) {
            showToast('Select a project first', 'error');
            return;
        }
        renameCurrent.textContent = currentProject.displayPath || currentProject.name;
        renameInput.value = '';
        renameModal.classList.remove('hidden');
    });

    renameCancel.addEventListener('click', () => renameModal.classList.add('hidden'));
    renameModal.addEventListener('click', (e) => {
        if (e.target === renameModal) renameModal.classList.add('hidden');
    });

    renameConfirm.addEventListener('click', async () => {
        const newPath = renameInput.value.trim();
        if (!newPath) return;
        try {
            const newName = await API.renameProject(currentProject.name, newPath);
            showToast('Project renamed', 'success');
            renameModal.classList.add('hidden');
            await projectList.load();
            // Select the renamed project
            const renamed = projectList.getProject(newName);
            if (renamed) handleProjectSelect(renamed);
        } catch (err) {
            showToast('Rename failed: ' + err.message, 'error');
        }
    });

    copyProjectBtn.addEventListener('click', () => {
        if (!currentProject) {
            showToast('Select a project first', 'error');
            return;
        }
        copySource.textContent = currentProject.displayPath || currentProject.name;
        copyInput.value = '';
        copyModal.classList.remove('hidden');
    });

    copyCancel.addEventListener('click', () => copyModal.classList.add('hidden'));
    copyModal.addEventListener('click', (e) => {
        if (e.target === copyModal) copyModal.classList.add('hidden');
    });

    copyConfirm.addEventListener('click', async () => {
        const targetPath = copyInput.value.trim();
        if (!targetPath) return;
        try {
            const newName = await API.copyProject(currentProject.name, targetPath);
            showToast('Project copied', 'success');
            copyModal.classList.add('hidden');
            await projectList.load();
            const copied = projectList.getProject(newName);
            if (copied) handleProjectSelect(copied);
        } catch (err) {
            showToast('Copy failed: ' + err.message, 'error');
        }
    });

    deleteSessionBtn.addEventListener('click', async () => {
        if (!currentProject) {
            showToast('Select a project first', 'error');
            return;
        }
        if (!sessionSelect.value) {
            showToast('Select a session first', 'error');
            return;
        }
        const sessionId = sessionSelect.value;
        if (!confirm(`Delete session "${sessionId}"?\n\nThis action cannot be undone.`)) {
            return;
        }
        try {
            await API.deleteSession(currentProject.name, sessionId);
            showToast('Session deleted', 'success');
            // Refresh session list and clear thread
            await handleProjectSelect(currentProject);
            messageThreadEl.innerHTML = '<div class="empty-state">Session deleted. Select a new session.</div>';
            messageCountEl.textContent = '';
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    });

    // Load projects
    await projectList.load();
}

async function handleProjectSelect(project) {
    currentProject = project;
    sessionSelect.innerHTML = '<option value="">Select session...</option>';
    messageThreadEl.innerHTML = '<div class="empty-state">Select a session to view messages</div>';
    messageCountEl.textContent = '';

    try {
        const sessions = await API.getProjectSessions(project.name);
        sessions.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id.length > 24 ? id.substring(0, 24) + '...' : id;
            sessionSelect.appendChild(opt);
        });
    } catch (err) {
        showToast('Failed to load sessions: ' + err.message, 'error');
    }
}

function handleMessageEdit(message) {
    if (!currentProject || !sessionSelect.value) return;
    messageEditor.open(message, currentProject.name, sessionSelect.value);
}

async function handleMessageDelete(message) {
    if (!currentProject || !sessionSelect.value) return;
    try {
        await API.deleteMessage(currentProject.name, sessionSelect.value, message.uuid);
        showToast('Message deleted', 'success');
        await messageThread.load(currentProject.name, sessionSelect.value);
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

async function handleEditorSave() {
    if (currentProject && sessionSelect.value) {
        await messageThread.load(currentProject.name, sessionSelect.value);
    }
}

async function handleSearchResultClick(result) {
    // Select the project
    const proj = projectList.getProject(result.projectName);
    if (proj) {
        await handleProjectSelect(proj);
        projectList.setActive(result.projectName);
        sessionSelect.value = result.sessionId;
        await messageThread.load(result.projectName, result.sessionId);
        // Scroll to message
        requestAnimationFrame(() => {
            const msgEl = document.querySelector(`[data-uuid="${result.messageUuid}"]`);
            if (msgEl) {
                msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msgEl.style.border = '2px solid var(--accent)';
                setTimeout(() => { msgEl.style.border = ''; }, 2000);
            }
        });
    }
    searchPanel.close();
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = type;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function handleProjectDelete(project) {
    const name = project.displayPath || project.name;
    if (!confirm(`Delete project "${name}"?\n\nAll ${project.sessionCount} session(s) and ${project.totalMessages} message(s) will be permanently removed.`)) {
        return;
    }
    try {
        await API.deleteProject(project.name);
        showToast('Project deleted', 'success');
        if (currentProject && currentProject.name === project.name) {
            currentProject = null;
            sessionSelect.innerHTML = '<option value="">Select session...</option>';
            messageThreadEl.innerHTML = '<div class="empty-state">Select a project to view messages</div>';
            messageCountEl.textContent = '';
        }
        await projectList.load();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// Start
init();
