import { ApiClient } from "apiClient/apiClient";
import { App, Modal, Notice } from "obsidian";

interface IndexedDocument {
    id: string;
    title: string;
    creation_date: string
}

export class IndexedDocumentsModal extends Modal {
    items: IndexedDocument[];
    apiClient: ApiClient;
    searchInput: HTMLInputElement;
    listContainer: HTMLElement;

    constructor(app: App, apiClient: ApiClient) {
        super(app);
        this.apiClient = apiClient;
        this.items = [];
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('indexed-documents-modal');

        this.createHeader(contentEl);
        this.createSearchInput(contentEl);
        this.listContainer = this.createListContainer(contentEl);
        this.createFooter(contentEl);

        await this.fetchAndRenderDocuments();
    }

    private createHeader(container: HTMLElement) {
        const header = container.createEl('div', { cls: 'indexed-documents-header' });
        header.createEl('h2', { text: 'Indexed Documents' });
    }

    private createSearchInput(container: HTMLElement) {
        this.searchInput = container.createEl('input', {
            type: 'text',
            placeholder: 'Search documents...',
            cls: 'indexed-documents-search'
        });
        this.searchInput.addEventListener('input', () => this.filterDocuments());
    }

    private createListContainer(container: HTMLElement) {
        return container.createEl('div', { cls: 'indexed-documents-list' });
    }

    private createFooter(container: HTMLElement) {
        const footer = container.createEl('div', { cls: 'indexed-documents-footer' });
        footer.createEl('span', { cls: 'indexed-documents-count' });
    }

    private async fetchAndRenderDocuments() {
        this.listContainer.empty();
        const loadingEl = this.listContainer.createEl('div', { text: 'Loading...', cls: 'indexed-documents-loading' });

        try {
            this.items = await this.apiClient.getIndexedDocuments();
            loadingEl.remove();
            this.renderDocuments();
        } catch (error) {
            console.error('Error fetching indexed documents:', error);
            loadingEl.textContent = 'Error loading documents. Please try again.';
            loadingEl.className = 'indexed-documents-error';
        }
    }

    private renderDocuments(itemsToRender: IndexedDocument[] = this.items) {
        this.listContainer.empty();

        if (itemsToRender.length > 0) {
            itemsToRender.forEach(item => this.createDocumentItem(item));
        } else {
            this.listContainer.createEl('div', { text: 'No indexed documents found.', cls: 'indexed-documents-empty' });
        }

        this.updateFooter(itemsToRender.length);
    }

    private createDocumentItem(item: IndexedDocument) {
        const itemEl = this.listContainer.createEl('div', { cls: 'indexed-document-item' });
        const contentEl = itemEl.createEl('div', { cls: 'indexed-document-content' });
        contentEl.createEl('div', { cls: 'indexed-document-title', text: item.title });
        contentEl.createEl('div', { cls: 'indexed-document-date', text: this.formatDate(item.creation_date) });

        const deleteButton = itemEl.createEl('button', { cls: 'indexed-document-delete', text: 'Delete' });
        deleteButton.addEventListener('click', () => this.deleteDocument(item, itemEl));
    }

    private async deleteDocument(item: IndexedDocument, itemEl: HTMLElement) {
        try {
            await this.apiClient.deleteDocument(item.id);
            itemEl.remove();
            this.items = this.items.filter(doc => doc.id !== item.id);
            this.updateFooter(this.items.length);
            new Notice(`Document "${item.title}" has been removed from Voyager.`);
        } catch (error) {
            console.error('Error deleting document:', error);
            const errorEl = itemEl.createEl('div', { cls: 'indexed-document-error', text: 'Failed to delete. Please try again.' });
            setTimeout(() => errorEl.remove(), 3000);
        }
    }

    private filterDocuments() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const filteredItems = this.items.filter(item => 
            item.title.toLowerCase().includes(searchTerm)
        );
        this.renderDocuments(filteredItems);
    }

    private formatDate(date: string): string {
        if (!date) return 'Date not available';
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString() : 'Invalid date';
    }

    private updateFooter(count: number) {
        const footerCount = this.contentEl.querySelector('.indexed-documents-count');
        if (footerCount) {
            footerCount.textContent = `Total documents: ${count}`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
