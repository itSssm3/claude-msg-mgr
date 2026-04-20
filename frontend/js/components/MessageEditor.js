class MessageEditor {
    constructor(modal, textarea, saveBtn, cancelBtn) {
        this.modal = modal;
        this.textarea = textarea;
        this.saveBtn = saveBtn;
        this.cancelBtn = cancelBtn;
        this.currentMessage = null;
        this.currentProject = null;
        this.currentSession = null;
        this.onSave = null;

        this.saveBtn.addEventListener('click', () => this.save());
        this.cancelBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    open(message, projectName, sessionID) {
        this.currentMessage = message;
        this.currentProject = projectName;
        this.currentSession = sessionID;
        this.textarea.value = message.text || '';
        this.modal.classList.remove('hidden');
        this.textarea.focus();
    }

    close() {
        this.modal.classList.add('hidden');
        this.currentMessage = null;
        this.currentProject = null;
        this.currentSession = null;
    }

    async save() {
        if (!this.currentMessage) return;

        const newText = this.textarea.value;
        try {
            await API.updateMessageText(
                this.currentProject,
                this.currentSession,
                this.currentMessage.uuid,
                newText
            );
            showToast('Message updated', 'success');
            if (this.onSave) this.onSave();
            this.close();
        } catch (err) {
            showToast('Failed to update: ' + err.message, 'error');
        }
    }
}
