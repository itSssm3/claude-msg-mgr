// Main application logic
let projectList;
let messageThread;
let messageEditor;
let searchPanel;
let sessionList;
let currentProject = null;

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Register backdrop-click-to-close for a modal
function setupModalClose(modal, closeFn) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFn();
    });
}

// DOM elements
const projectListEl = document.getElementById('project-list');
const projectSearchEl = document.getElementById('project-search');
const refreshBtn = document.getElementById('refresh-btn');
const sessionDropdown = document.getElementById('session-dropdown');
const sessionToggle = document.getElementById('session-toggle');
const sessionLabel = document.getElementById('session-label');
const sessionPanel = document.getElementById('session-panel');
const sessionListEl = document.getElementById('session-list');
const messageCountEl = document.getElementById('message-count');
const messageThreadEl = document.getElementById('message-thread');
const globalSearchBtn = document.getElementById('global-search-btn');
const batchSelectBtn = document.getElementById('batch-select-btn');
const batchToolbar = document.getElementById('batch-toolbar');
const batchSelectAll = document.getElementById('batch-select-all');
const batchCount = document.getElementById('batch-count');
const batchDeleteBtn = document.getElementById('batch-delete-btn');
const batchCancelBtn = document.getElementById('batch-cancel-btn');
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

// Global keyboard shortcuts (registered immediately, outside init)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        if (!document.getElementById('confirm-modal').classList.contains('hidden')) {
            // Handled by showConfirm's own listener
            return;
        }
        if (!searchModal.classList.contains('hidden')) {
            e.preventDefault();
            searchModal.classList.add('hidden');
            searchInput.value = '';
            searchResults.innerHTML = '';
        } else if (!editorModal.classList.contains('hidden')) {
            e.preventDefault();
            editorModal.classList.add('hidden');
        } else if (!renameModal.classList.contains('hidden')) {
            e.preventDefault();
            renameModal.classList.add('hidden');
        } else if (!copyModal.classList.contains('hidden')) {
            e.preventDefault();
            copyModal.classList.add('hidden');
        } else if (!sessionPanel.classList.contains('hidden')) {
            e.preventDefault();
            sessionPanel.classList.add('hidden');
        } else if (!batchToolbar.classList.contains('hidden')) {
            e.preventDefault();
            batchCancelBtn.click();
        }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (!searchModal.classList.contains('hidden')) {
            searchInput.focus();
        } else {
            searchModal.classList.remove('hidden');
            searchInput.focus();
        }
    }
});

// Initialize
async function init() {
    projectList = new ProjectList(projectListEl, handleProjectSelect, handleProjectDelete);
    messageThread = new MessageThread(messageThreadEl);
    messageEditor = new MessageEditor(editorModal, editorTextarea, editorSave, editorCancel);
    searchPanel = new SearchPanel(searchModal, searchInput, searchCase, searchRun, searchClose, searchResults);
    sessionList = new SessionList(sessionDropdown, sessionToggle, sessionLabel, sessionPanel, sessionListEl);

    messageThread.onEdit = handleMessageEdit;
    messageThread.onDelete = handleMessageDelete;
    messageThread.onBatchDelete = handleBatchMessageDelete;
    messageThread.onSelectionChange = updateBatchToolbar;
    messageEditor.onSave = handleEditorSave;
    searchPanel.onResultClick = handleSearchResultClick;
    sessionList.onSelect = handleSessionSelect;

    // Event listeners
    projectSearchEl.addEventListener('input', debounce((e) => {
        projectList.setFilter(e.target.value);
    }, 150));

    refreshBtn.addEventListener('click', () => {
        projectList.load();
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
    setupModalClose(renameModal, () => renameModal.classList.add('hidden'));

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
    setupModalClose(copyModal, () => copyModal.classList.add('hidden'));

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

    batchSelectBtn.addEventListener('click', () => {
        if (!currentProject || !sessionList.selectedId) {
            showToast('Select a project and session first', 'error');
            return;
        }
        messageThread.setBatchMode(true);
        batchToolbar.classList.remove('hidden');
        batchSelectBtn.classList.add('hidden');
        updateBatchToolbar(0);
    });

    batchCancelBtn.addEventListener('click', () => {
        messageThread.setBatchMode(false);
        batchToolbar.classList.add('hidden');
        batchSelectBtn.classList.remove('hidden');
        batchSelectAll.checked = false;
    });

    batchSelectAll.addEventListener('change', (e) => {
        if (e.target.checked) {
            messageThread.selectAll();
        } else {
            messageThread.clearSelection();
        }
    });

    batchDeleteBtn.addEventListener('click', async () => {
        const count = messageThread.selectedMessages.size;
        if (count === 0) return;
        const confirmed = await showConfirm('Delete Messages',
            `Delete ${count} selected message${count > 1 ? 's' : ''}?\nThis action cannot be undone.`);
        if (!confirmed) return;
        try {
            await messageThread.deleteSelected();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    });

    deleteSessionBtn.addEventListener('click', async () => {
        if (!currentProject) {
            showToast('Select a project first', 'error');
            return;
        }
        if (!sessionList.selectedId) {
            showToast('Select a session first', 'error');
            return;
        }
        const sessionId = sessionList.selectedId;
        const confirmed = await showConfirm('Delete Session',
            `Delete session "${sessionId}"?\nThis action cannot be undone.`);
        if (!confirmed) return;
        try {
            await API.deleteSession(currentProject.name, sessionId);
            showToast('Session deleted', 'success');
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
    messageThread.setBatchMode(false);
    batchToolbar.classList.add('hidden');
    batchSelectBtn.classList.remove('hidden');
    batchSelectAll.checked = false;
    messageThreadEl.innerHTML = '<div class="empty-state">Select a session to view messages</div>';
    messageCountEl.textContent = '';

    try {
        const sessions = await API.getProjectSessions(project.name);
        sessionList.setSessions(sessions);
    } catch (err) {
        showToast('Failed to load sessions: ' + err.message, 'error');
    }
}

function handleSessionSelect(sessionId) {
    if (currentProject) {
        messageThread.setBatchMode(false);
        batchToolbar.classList.add('hidden');
        batchSelectBtn.classList.remove('hidden');
        batchSelectAll.checked = false;
        messageThread.load(currentProject.name, sessionId);
    }
}

function handleMessageEdit(message) {
    if (!currentProject || !sessionList.selectedId) return;
    messageEditor.open(message, currentProject.name, sessionList.selectedId);
}

async function handleMessageDelete(message) {
    if (!currentProject || !sessionList.selectedId) return;
    try {
        await API.deleteMessage(currentProject.name, sessionList.selectedId, message.uuid);
        showToast('Message deleted', 'success');
        await messageThread.refresh();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

async function handleBatchMessageDelete(uuids) {
    if (!currentProject || !sessionList.selectedId) return;
    try {
        await API.deleteMessages(currentProject.name, sessionList.selectedId, uuids);
        showToast(`${uuids.length} message${uuids.length > 1 ? 's' : ''} deleted`, 'success');
        messageThread.setBatchMode(false);
        batchToolbar.classList.add('hidden');
        batchSelectBtn.classList.remove('hidden');
        batchSelectAll.checked = false;
        await messageThread.refresh();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

function updateBatchToolbar(count) {
    batchCount.textContent = `${count} selected`;
    batchDeleteBtn.disabled = count === 0;
    batchSelectAll.checked = count > 0 && count === messageThread.messages.length;
    batchSelectAll.indeterminate = count > 0 && count < messageThread.messages.length;
}

async function handleEditorSave() {
    if (currentProject && sessionList.selectedId) {
        await messageThread.load(currentProject.name, sessionList.selectedId);
    }
}

async function handleSearchResultClick(result) {
    const proj = projectList.getProject(result.projectName);
    if (proj) {
        await handleProjectSelect(proj);
        projectList.setActive(result.projectName);
        sessionList.setSelected(result.sessionId);
        await messageThread.load(result.projectName, result.sessionId);
        messageThread.scrollToMessage(result.messageUuid);
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

// Custom confirm dialog (replaces native confirm)
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.remove('hidden');
        okBtn.focus();

        function cleanup(result) {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            document.removeEventListener('keydown', onKey);
            modal.removeEventListener('click', onBackdrop);
            resolve(result);
        }

        function onCancel() { cleanup(false); }
        function onOk() { cleanup(true); }
        function onKey(e) {
            if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                cleanup(false);
            }
        }
        function onBackdrop(e) {
            if (e.target === modal) cleanup(false);
        }

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
        document.addEventListener('keydown', onKey);
        modal.addEventListener('click', onBackdrop);
    });
}

async function handleProjectDelete(project) {
    const name = project.displayPath || project.name;
    const confirmed = await showConfirm('Delete Project',
        `Delete project "${name}"?\nAll ${project.sessionCount} session(s) and ${project.totalMessages} message(s) will be permanently removed.`);
    if (!confirmed) return;
    try {
        await API.deleteProject(project.name);
        showToast('Project deleted', 'success');
        if (currentProject && currentProject.name === project.name) {
            currentProject = null;
            sessionList.setSessions([]);
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
