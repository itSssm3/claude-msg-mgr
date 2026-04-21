class MessageThread {
    constructor(container) {
        this.container = container;
        this.messages = [];
        this.currentProject = null;
        this.currentSession = null;
        this.onEdit = null;
        this.onDelete = null;

        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const uuid = btn.closest('.message')?.dataset.uuid;
            const msg = uuid && this.messages.find(m => m.uuid === uuid);

            if (action === 'edit' && msg && this.onEdit) {
                this.onEdit(msg);
            } else if (action === 'delete' && msg && this.onDelete) {
                if (confirm('Delete this message?')) this.onDelete(msg);
            } else if (action === 'expand' && msg) {
                const body = btn.parentElement.querySelector('.message-body');
                if (body) {
                    const isCollapsed = body.classList.toggle('collapsed');
                    btn.textContent = isCollapsed ? 'Expand' : 'Collapse';
                }
            } else if (action === 'thinking') {
                const thinking = btn.nextElementSibling;
                if (thinking && thinking.classList.contains('thinking-content')) {
                    const visible = thinking.classList.toggle('visible');
                    btn.textContent = visible ? 'Hide thinking' : 'Thinking';
                }
            } else if (action === 'tool-toggle') {
                const content = btn.nextElementSibling;
                if (content && content.classList.contains('tool-content')) {
                    const visible = content.classList.toggle('visible');
                    btn.classList.toggle('expanded', visible);
                }
            }
        });
    }

    async load(projectName, sessionID) {
        this.currentProject = projectName;
        this.currentSession = sessionID;
        this.container.innerHTML = '<div class="loading">Loading messages...</div>';
        try {
            this.messages = await API.getMessages(projectName, sessionID);
            this.render();
        } catch (err) {
            this.container.innerHTML = '<div class="empty-state">Failed to load messages: ' + err.message + '</div>';
            showToast('Failed to load messages: ' + err.message, 'error');
        }
    }

    render() {
        this.container.innerHTML = '';

        if (this.messages.length === 0) {
            this.container.innerHTML = '<div class="empty-state">No messages in this session</div>';
            return;
        }

        this.messages.forEach(msg => {
            const el = document.createElement('div');
            el.className = `message ${msg.role}`;
            el.dataset.uuid = msg.uuid;

            // Distinguish content-less messages (thinking/tool-only) from real dialogue
            const hasText = msg.text && msg.text.trim().length > 0;
            const hasThinking = msg.thinking && msg.thinking.trim().length > 0;
            if (!hasText && (hasThinking || msg.hasTools)) {
                el.classList.add('no-text');
            }

            // Header
            const header = document.createElement('div');
            header.className = 'message-header';

            const role = document.createElement('span');
            role.className = 'message-role';
            role.textContent = msg.role;

            const meta = document.createElement('div');
            meta.className = 'message-meta';

            if (msg.model) {
                const model = document.createElement('span');
                model.className = 'message-model';
                model.textContent = msg.model;
                meta.appendChild(model);
            }

            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = new Date(msg.timestamp).toLocaleString();
            meta.appendChild(time);

            const actions = document.createElement('div');
            actions.className = 'message-actions';

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.dataset.action = 'edit';

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.dataset.action = 'delete';

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            meta.appendChild(actions);

            header.appendChild(role);
            header.appendChild(meta);
            el.appendChild(header);

            // Body — only create if there's text, otherwise show a subtle placeholder
            if (hasText) {
                const body = document.createElement('div');
                body.className = 'message-body';
                body.textContent = msg.text;
                el.appendChild(body);

                // Expand/collapse for long messages (threshold: ~300 chars)
                if (msg.text.length > 300) {
                    body.classList.add('collapsed');

                    const expandToggle = document.createElement('div');
                    expandToggle.className = 'expand-toggle';
                    expandToggle.textContent = 'Expand';
                    expandToggle.dataset.action = 'expand';

                    el.appendChild(expandToggle);
                }
            } else if (!hasThinking && !msg.hasTools) {
                const body = document.createElement('div');
                body.className = 'message-body empty-content';
                body.textContent = '(no content)';
                el.appendChild(body);
            }

            // Thinking block
            if (hasThinking) {
                const toggle = document.createElement('div');
                toggle.className = 'thinking-toggle';
                toggle.textContent = 'Thinking';
                toggle.dataset.action = 'thinking';

                const thinking = document.createElement('div');
                thinking.className = 'thinking-content';
                thinking.textContent = msg.thinking;

                el.appendChild(toggle);
                el.appendChild(thinking);
            }

            // Tool details
            if (msg.hasTools && msg.tools) {
                const toolList = document.createElement('div');
                toolList.className = 'tool-list';

                msg.tools.forEach(tool => {
                    const toolItem = document.createElement('div');
                    toolItem.className = 'tool-item';

                    const isUse = tool.type === 'tool_use';
                    const isError = tool.isError;

                    // Toggle header
                    const toggle = document.createElement('div');
                    toggle.className = 'tool-toggle';
                    if (isError) toggle.classList.add('tool-error');

                    const icon = document.createElement('span');
                    icon.className = 'tool-icon';
                    icon.textContent = isUse ? '' : '';

                    const label = document.createElement('span');
                    label.className = 'tool-label';
                    label.textContent = isUse
                        ? (tool.name || 'unknown')
                        : (isError ? 'Error' : 'Result');

                    const idTag = document.createElement('span');
                    idTag.className = 'tool-id';
                    idTag.textContent = tool.toolUseId ? tool.toolUseId.slice(-6) : '';

                    toggle.appendChild(icon);
                    toggle.appendChild(label);
                    if (idTag.textContent) toggle.appendChild(idTag);

                    // Content panel
                    const content = document.createElement('div');
                    content.className = 'tool-content';

                    if (isUse && tool.input && Object.keys(tool.input).length > 0) {
                        const pre = document.createElement('pre');
                        pre.textContent = JSON.stringify(tool.input, null, 2);
                        content.appendChild(pre);
                    } else if (tool.content) {
                        const pre = document.createElement('pre');
                        pre.textContent = tool.content;
                        content.appendChild(pre);
                    } else {
                        const empty = document.createElement('span');
                        empty.className = 'tool-empty';
                        empty.textContent = '(no details)';
                        content.appendChild(empty);
                    }

                    toggle.dataset.action = 'tool-toggle';

                    toolItem.appendChild(toggle);
                    toolItem.appendChild(content);
                    toolList.appendChild(toolItem);
                });

                el.appendChild(toolList);
            }

            this.container.appendChild(el);
        });
    }
}
