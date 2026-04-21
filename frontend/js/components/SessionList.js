class SessionList {
    constructor(dropdown, toggleBtn, labelEl, panel, listEl) {
        this.dropdown = dropdown;
        this.toggleBtn = toggleBtn;
        this.labelEl = labelEl;
        this.panel = panel;
        this.listEl = listEl;
        this.sessions = [];
        this.selectedId = null;
        this.onSelect = null;

        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.close();
            }
        });

        this.listEl.addEventListener('click', (e) => {
            const item = e.target.closest('[data-session-id]');
            if (item) {
                this.select(item.dataset.sessionId);
            }
        });
    }

    setSessions(sessions) {
        this.sessions = sessions;
        this.selectedId = null;
        this.labelEl.textContent = 'Select session...';
        this.render();
    }

    render() {
        this.listEl.innerHTML = '';
        if (this.sessions.length === 0) {
            this.listEl.innerHTML = '<div class="session-item-empty">No sessions</div>';
            return;
        }

        // Sessions are sorted newest first from backend
        this.sessions.forEach((id, idx) => {
            const item = document.createElement('div');
            item.className = 'session-item';
            item.dataset.sessionId = id;
            if (id === this.selectedId) {
                item.classList.add('active');
            }

            const num = document.createElement('span');
            num.className = 'session-num';
            num.textContent = `#${idx + 1}`;

            const name = document.createElement('span');
            name.className = 'session-name';
            name.textContent = id;
            name.title = id;

            item.appendChild(num);
            item.appendChild(name);
            this.listEl.appendChild(item);
        });
    }

    toggle() {
        if (this.panel.classList.contains('hidden')) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        this.panel.classList.remove('hidden');
    }

    close() {
        this.panel.classList.add('hidden');
    }

    select(sessionId) {
        this.selectedId = sessionId;
        this.labelEl.textContent = sessionId.length > 32
            ? sessionId.substring(0, 32) + '...'
            : sessionId;
        this.labelEl.title = sessionId;
        this.render();
        this.close();
        if (this.onSelect) this.onSelect(sessionId);
    }

    setSelected(sessionId) {
        this.selectedId = sessionId;
        this.labelEl.textContent = sessionId.length > 32
            ? sessionId.substring(0, 32) + '...'
            : sessionId;
        this.labelEl.title = sessionId;
        this.render();
    }
}
