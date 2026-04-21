class ProjectList {
    constructor(container, onSelect, onDelete) {
        this.container = container;
        this.onSelect = onSelect;
        this.onDelete = onDelete;
        this.projects = [];
        this.filter = '';
    }

    async load() {
        this.container.innerHTML = '<div class="loading">Loading projects...</div>';
        try {
            this.projects = await API.getProjects();
            this.render();
        } catch (err) {
            this.container.innerHTML = '<div class="empty-state">Failed to load projects</div>';
            showToast('Failed to load projects: ' + err.message, 'error');
        }
    }

    setFilter(text) {
        this.filter = text.toLowerCase();
        this.render();
    }

    render() {
        this.container.innerHTML = '';

        const filtered = this.projects.filter(p =>
            p.name.toLowerCase().includes(this.filter) ||
            (p.displayPath && p.displayPath.toLowerCase().includes(this.filter))
        );

        if (filtered.length === 0) {
            this.container.innerHTML = '<div class="empty-state">No projects found</div>';
            return;
        }

        filtered.forEach(project => {
            const el = document.createElement('div');
            el.className = 'project-item';
            el.dataset.name = project.name;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'project-name';
            nameDiv.textContent = project.name;

            const pathDiv = document.createElement('div');
            pathDiv.className = 'project-path';
            pathDiv.textContent = project.displayPath || project.name;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'project-meta';
            metaDiv.textContent = `${project.sessionCount} sessions · ${project.totalMessages} messages`;

            el.appendChild(nameDiv);
            el.appendChild(pathDiv);
            el.appendChild(metaDiv);

            // Delete button (shows on hover)
            const delBtn = document.createElement('button');
            delBtn.className = 'project-delete-btn';
            delBtn.title = 'Delete project';
            delBtn.innerHTML = '&#x1F5D1;'; // 🗑
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onDelete) this.onDelete(project);
            });
            el.appendChild(delBtn);

            el.addEventListener('click', () => {
                document.querySelectorAll('.project-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
                this.onSelect(project);
            });

            this.container.appendChild(el);
        });
    }

    getProject(name) {
        return this.projects.find(p => p.name === name);
    }

    setActive(name) {
        document.querySelectorAll('.project-item').forEach(i => i.classList.remove('active'));
        const el = this.container.querySelector(`[data-name="${name}"]`);
        if (el) el.classList.add('active');
    }
}
