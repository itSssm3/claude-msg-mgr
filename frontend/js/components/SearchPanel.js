class SearchPanel {
    constructor(modal, input, caseCb, runBtn, closeBtn, resultsContainer) {
        this.modal = modal;
        this.input = input;
        this.caseCb = caseCb;
        this.runBtn = runBtn;
        this.closeBtn = closeBtn;
        this.resultsContainer = resultsContainer;
        this.onResultClick = null;

        this.runBtn.addEventListener('click', () => this.search());
        this.closeBtn.addEventListener('click', () => this.close());
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.search();
        });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    open() {
        this.modal.classList.remove('hidden');
        this.input.focus();
    }

    close() {
        this.modal.classList.add('hidden');
        this.input.value = '';
        this.resultsContainer.innerHTML = '';
    }

    async search() {
        const query = this.input.value.trim();
        if (!query) return;

        this.resultsContainer.innerHTML = '<div class="empty-state">Searching...</div>';

        try {
            const results = await API.searchAcrossProjects(
                query,
                this.caseCb.checked,
                100
            );
            this.renderResults(results, query);
        } catch (err) {
            this.resultsContainer.innerHTML = '<div class="empty-state">Search failed: ' + err.message + '</div>';
        }
    }

    renderResults(results, query) {
        this.resultsContainer.innerHTML = '';

        if (results.length === 0) {
            this.resultsContainer.innerHTML = '<div class="empty-state">No results found</div>';
            return;
        }

        results.forEach(r => {
            const el = document.createElement('div');
            el.className = 'search-result-item';

            const meta = document.createElement('div');
            meta.className = 'search-result-meta';
            meta.textContent = `${r.projectName} / ${r.sessionId.substring(0, 8)}... / ${r.type}`;

            const text = document.createElement('div');
            text.className = 'search-result-text';

            // Simple highlight
            const term = this.caseCb.checked ? query : query.toLowerCase();
            const compareText = this.caseCb.checked ? r.text : r.text.toLowerCase();
            const idx = compareText.indexOf(term);
            if (idx >= 0) {
                const before = r.text.substring(0, idx);
                const match = r.text.substring(idx, idx + query.length);
                const after = r.text.substring(idx + query.length);
                text.innerHTML = escapeHtml(before) +
                    '<span class="search-result-highlight">' + escapeHtml(match) + '</span>' +
                    escapeHtml(after);
            } else {
                text.textContent = r.text;
            }

            el.appendChild(meta);
            el.appendChild(text);

            el.addEventListener('click', () => {
                if (this.onResultClick) this.onResultClick(r);
            });

            this.resultsContainer.appendChild(el);
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
