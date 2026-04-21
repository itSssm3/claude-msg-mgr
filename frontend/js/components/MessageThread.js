class MessageThread {
    constructor(container) {
        this.container = container;
        this.messages = [];
        this.currentProject = null;
        this.currentSession = null;
        this.onEdit = null;
        this.onDelete = null;

        // Virtual scrolling state
        this.heightCache = new Map();
        this.estimatedHeights = [];
        this.offsetsCache = null;
        this.offsetsDirty = true;
        this.visibleRange = { start: 0, end: 0 };
        this.BUFFER = 10;
        this.ticking = false;

        // UI toggle state (persisted across re-renders)
        this.expandedMessages = new Set();
        this.visibleThinking = new Set();
        this.expandedTools = new Map(); // uuid -> Set<toolIndex>

        // Scroll-to-bottom button (placed in parent to avoid scrolling with content)
        this.scrollBottomBtn = document.createElement('button');
        this.scrollBottomBtn.className = 'scroll-bottom-btn hidden';
        this.scrollBottomBtn.title = 'Scroll to bottom';
        this.scrollBottomBtn.innerHTML = '&#x2193;';
        this.scrollBottomBtn.addEventListener('click', () => this.scrollToBottom());
        this.container.parentElement.appendChild(this.scrollBottomBtn);

        this.container.addEventListener('scroll', () => {
            if (!this.ticking) {
                this.ticking = true;
                requestAnimationFrame(() => {
                    this.onScroll();
                    this.ticking = false;
                });
            }
        });

        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const uuid = btn.closest('.message')?.dataset.uuid;
            const msg = uuid && this.messages.find(m => m.uuid === uuid);

            if (action === 'edit' && msg && this.onEdit) {
                this.onEdit(msg);
            } else if (action === 'delete' && msg && this.onDelete) {
                showConfirm('Delete Message', 'Delete this message?').then(confirmed => {
                    if (confirmed) this.onDelete(msg);
                });
            } else if (action === 'expand' && msg) {
                const body = btn.parentElement.querySelector('.message-body');
                if (body) {
                    const isCollapsed = body.classList.toggle('collapsed');
                    btn.textContent = isCollapsed ? 'Expand' : 'Collapse';
                    if (isCollapsed) {
                        this.expandedMessages.delete(msg.uuid);
                    } else {
                        this.expandedMessages.add(msg.uuid);
                    }
                    this.heightCache.delete(msg.uuid);
                    this.adjustAfterToggle();
                }
            } else if (action === 'thinking') {
                const thinking = btn.nextElementSibling;
                if (thinking && thinking.classList.contains('thinking-content')) {
                    const visible = thinking.classList.toggle('visible');
                    btn.textContent = visible ? 'Hide thinking' : 'Thinking';
                    if (visible) {
                        msg && this.visibleThinking.add(msg.uuid);
                    } else {
                        msg && this.visibleThinking.delete(msg.uuid);
                    }
                    if (msg) this.heightCache.delete(msg.uuid);
                    this.adjustAfterToggle();
                }
            } else if (action === 'tool-toggle') {
                const content = btn.nextElementSibling;
                if (content && content.classList.contains('tool-content')) {
                    const visible = content.classList.toggle('visible');
                    btn.classList.toggle('expanded', visible);
                    const toolIdx = parseInt(btn.dataset.toolIndex);
                    if (msg && !isNaN(toolIdx)) {
                        if (visible) {
                            if (!this.expandedTools.has(msg.uuid)) {
                                this.expandedTools.set(msg.uuid, new Set());
                            }
                            this.expandedTools.get(msg.uuid).add(toolIdx);
                        } else {
                            const set = this.expandedTools.get(msg.uuid);
                            if (set) set.delete(toolIdx);
                        }
                    }
                    if (msg) this.heightCache.delete(msg.uuid);
                    this.adjustAfterToggle();
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
            this.heightCache.clear();
            this.expandedMessages.clear();
            this.visibleThinking.clear();
            this.expandedTools.clear();
            this.estimatedHeights = this.messages.map(m => this.estimateHeight(m));
            this.offsetsDirty = true;
            this.container.scrollTop = 0;
            this.render();
            this.updateScrollBottomBtn();
        } catch (err) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Failed to load messages: ' + err.message;
            this.container.innerHTML = '';
            this.container.appendChild(emptyState);
            showToast(emptyState.textContent, 'error');
        }
    }

    estimateHeight(msg) {
        let h = 52; // header
        const hasText = msg.text && msg.text.trim().length > 0;
        const hasThinking = msg.thinking && msg.thinking.trim().length > 0;

        if (hasText) {
            const charsPerLine = 70;
            const lineHeight = 26;
            const lines = Math.ceil(msg.text.length / charsPerLine);
            h += 32; // body padding
            if (msg.text.length > 300) {
                h += Math.min(lines, 5) * lineHeight; // collapsed ~5 lines
                h += 30; // expand toggle
            } else {
                h += lines * lineHeight;
            }
        } else if (!hasThinking && !msg.hasTools) {
            h += 50; // empty content placeholder
        }
        if (hasThinking) h += 32; // thinking toggle row
        if (msg.hasTools && msg.tools) h += msg.tools.length * 30; // tool rows
        h += 20; // message margin-bottom
        return h;
    }

    calcVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const viewportH = this.container.clientHeight || 600;
        const n = this.messages.length;

        if (n === 0) return { start: 0, end: 0, topOffset: 0, totalHeight: 0, bottomOffset: 0 };

        const offsets = this.getOffsets();
        const totalH = offsets[n];

        const firstVisible = Math.min(n - 1, Math.max(0, this.upperBound(offsets, scrollTop) - 1));
        const start = Math.max(0, firstVisible - this.BUFFER);

        const viewBottom = scrollTop + viewportH;
        const firstPastViewport = this.upperBound(offsets, viewBottom);
        const end = Math.min(n, firstPastViewport + this.BUFFER);

        return {
            start,
            end,
            topOffset: offsets[start],
            totalHeight: totalH,
            bottomOffset: totalH - offsets[end]
        };
    }

    render() {
        if (this.messages.length === 0) {
            this.container.innerHTML = '<div class="empty-state">No messages in this session</div>';
            return;
        }

        const range = this.calcVisibleRange();
        const prevStart = this.visibleRange.start;
        const prevEnd = this.visibleRange.end;

        if (range.start === prevStart && range.end === prevEnd && this.container.children.length > 0) {
            return;
        }

        this.visibleRange = range;
        const scrollTop = this.container.scrollTop;

        this.container.innerHTML = '';

        // Top spacer
        if (range.topOffset > 0) {
            const topSpacer = document.createElement('div');
            topSpacer.className = 'thread-spacer';
            topSpacer.style.height = range.topOffset + 'px';
            this.container.appendChild(topSpacer);
        }

        // Visible messages
        for (let i = range.start; i < range.end; i++) {
            this.renderMessage(this.messages[i]);
        }

        // Bottom spacer
        if (range.bottomOffset > 0) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.className = 'thread-spacer';
            bottomSpacer.style.height = range.bottomOffset + 'px';
            this.container.appendChild(bottomSpacer);
        }

        // Restore scroll position (browser resets it when innerHTML is cleared)
        this.container.scrollTop = scrollTop;

        // Measure actual heights after paint
        requestAnimationFrame(() => this.measureVisible());
    }

    renderMessage(msg) {
        const el = document.createElement('div');
        el.className = `message ${msg.role}`;
        el.dataset.uuid = msg.uuid;

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

        if (hasText) {
            const body = document.createElement('div');
            body.className = 'message-body';
            body.textContent = msg.text;
            el.appendChild(body);

            if (msg.text.length > 300) {
                const isExpanded = this.expandedMessages.has(msg.uuid);
                if (!isExpanded) {
                    body.classList.add('collapsed');
                }

                const expandToggle = document.createElement('div');
                expandToggle.className = 'expand-toggle';
                expandToggle.textContent = isExpanded ? 'Collapse' : 'Expand';
                expandToggle.dataset.action = 'expand';

                el.appendChild(expandToggle);
            }
        } else if (!hasThinking && !msg.hasTools) {
            const body = document.createElement('div');
            body.className = 'message-body empty-content';
            body.textContent = '(no content)';
            el.appendChild(body);
        }

        if (hasThinking) {
            const thinkingVisible = this.visibleThinking.has(msg.uuid);

            const toggle = document.createElement('div');
            toggle.className = 'thinking-toggle';
            toggle.textContent = thinkingVisible ? 'Hide thinking' : 'Thinking';
            toggle.dataset.action = 'thinking';

            const thinking = document.createElement('div');
            thinking.className = 'thinking-content';
            if (thinkingVisible) thinking.classList.add('visible');
            thinking.textContent = msg.thinking;

            el.appendChild(toggle);
            el.appendChild(thinking);
        }

        if (msg.hasTools && msg.tools) {
            const toolList = document.createElement('div');
            toolList.className = 'tool-list';
            const expandedToolSet = this.expandedTools.get(msg.uuid);

            msg.tools.forEach((tool, toolIdx) => {
                const toolItem = document.createElement('div');
                toolItem.className = 'tool-item';

                const isUse = tool.type === 'tool_use';
                const isError = tool.isError;
                const isToolExpanded = expandedToolSet && expandedToolSet.has(toolIdx);

                const toggle = document.createElement('div');
                toggle.className = 'tool-toggle';
                if (isError) toggle.classList.add('tool-error');
                if (isToolExpanded) toggle.classList.add('expanded');

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

                const content = document.createElement('div');
                content.className = 'tool-content';
                if (isToolExpanded) content.classList.add('visible');

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
                toggle.dataset.toolIndex = toolIdx;

                toolItem.appendChild(toggle);
                toolItem.appendChild(content);
                toolList.appendChild(toolItem);
            });

            el.appendChild(toolList);
        }

        this.container.appendChild(el);
    }

    onScroll() {
        const range = this.calcVisibleRange();
        if (range.start !== this.visibleRange.start || range.end !== this.visibleRange.end) {
            this.render();
        }
        this.updateScrollBottomBtn();
    }

    updateScrollBottomBtn() {
        if (this.messages.length === 0) {
            this.scrollBottomBtn.classList.add('hidden');
            return;
        }
        const distFromBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
        this.scrollBottomBtn.classList.toggle('hidden', distFromBottom < 200);
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
        this.render();
    }

    measureVisible() {
        const messages = this.container.querySelectorAll('.message');
        let heightsChanged = false;
        messages.forEach(el => {
            const uuid = el.dataset.uuid;
            if (uuid) {
                const h = el.offsetHeight;
                if (this.heightCache.get(uuid) !== h) {
                    this.heightCache.set(uuid, h);
                    heightsChanged = true;
                }
            }
        });
        // Update estimated heights from cache
        for (let i = 0; i < this.messages.length; i++) {
            const cached = this.heightCache.get(this.messages[i].uuid);
            if (cached && this.estimatedHeights[i] !== cached) {
                this.estimatedHeights[i] = cached;
                heightsChanged = true;
            }
        }
        if (heightsChanged) this.offsetsDirty = true;
        // Adjust spacers if heights changed
        this.adjustSpacers();
    }

    adjustSpacers() {
        const spacers = this.container.querySelectorAll('.thread-spacer');
        if (spacers.length === 0 && this.messages.length === 0) return;

        // Recalculate total offsets from cache/estimates
        const n = this.messages.length;
        const offsets = this.getOffsets();
        const totalH = offsets[n];

        const range = this.visibleRange;
        const topOffset = offsets[range.start];
        const bottomOffset = totalH - offsets[range.end];

        // Update top spacer
        if (topOffset > 0 && spacers.length > 0) {
            spacers[0].style.height = topOffset + 'px';
        }

        // Update bottom spacer
        if (bottomOffset > 0) {
            if (spacers.length > 1) {
                spacers[spacers.length - 1].style.height = bottomOffset + 'px';
            } else if (spacers.length === 1 && topOffset === 0) {
                spacers[0].style.height = bottomOffset + 'px';
            }
        }
    }

    adjustAfterToggle() {
        requestAnimationFrame(() => {
            this.measureVisible();
        });
    }

    scrollToMessage(uuid) {
        // Find the message index
        const idx = this.messages.findIndex(m => m.uuid === uuid);
        if (idx === -1) return;

        // Calculate offset
        const offsets = this.getOffsets();

        // Scroll to the message, centering it in the viewport
        const viewportH = this.container.clientHeight || 600;
        const msgH = this.heightCache.get(uuid) || this.estimatedHeights[idx];
        const targetScroll = offsets[idx] - (viewportH - msgH) / 2;

        this.container.scrollTop = Math.max(0, targetScroll);

        // Force re-render at new position
        this.render();

        // Highlight
        requestAnimationFrame(() => {
            const msgEl = this.container.querySelector(`[data-uuid="${uuid}"]`);
            if (msgEl) {
                msgEl.style.border = '2px solid var(--accent)';
                setTimeout(() => { msgEl.style.border = ''; }, 2000);
            }
        });
    }

    getOffsets() {
        const n = this.messages.length;
        if (!this.offsetsDirty && this.offsetsCache && this.offsetsCache.length === n + 1) {
            return this.offsetsCache;
        }

        const offsets = new Array(n + 1);
        offsets[0] = 0;
        for (let i = 0; i < n; i++) {
            const h = this.heightCache.get(this.messages[i].uuid) || this.estimatedHeights[i];
            offsets[i + 1] = offsets[i] + h;
        }
        this.offsetsCache = offsets;
        this.offsetsDirty = false;
        return offsets;
    }

    upperBound(arr, value) {
        // Returns the index of the first element strictly greater than value.
        let lo = 0;
        let hi = arr.length;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (arr[mid] <= value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }
}
