import { MarkdownRenderer, Component } from 'obsidian';
import MyPlugin from 'main';

export class DocumentCard {
    private card: HTMLElement;
    private summaryContainer: HTMLElement;

    constructor(private plugin: MyPlugin, private documentId: string, private title: string, private score: number) {
        console.log(`DocumentCard constructed for ${this.title}`);
        this.card = this.createCard();
    }

    private createCard(): HTMLElement {
        console.log(`Creating card for ${this.title}`);
        const card = document.createElement('div');
        card.className = 'similar-document-card';
        card.style.display = 'none';
        card.style.backgroundColor = 'var(--background-primary)';
        card.style.padding = '20px';
        card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        card.style.borderRadius = '4px';
        card.style.overflow = 'auto';
        card.style.height = '200px';
        card.style.position = 'relative'

        const cardHeader = card.createEl('div', { cls: 'card-header' });
        cardHeader.style.marginBottom = '10px';

        cardHeader.createEl('h3', { text: this.title, cls: 'card-title' });
        cardHeader.createEl('p', { text: `Similarity: ${(this.score * 100).toFixed(2)}%`, cls: 'card-similarity' });

        const divider = card.createEl('hr', { cls: 'card-divider' });
        divider.style.margin = '10px 0';
        divider.style.border = 'none';
        divider.style.borderTop = '1px solid var(--background-modifier-border)';

        this.summaryContainer = card.createEl('div', { cls: 'summary-container' });

        console.log(`Card created for ${this.title}`);
        return card;
    }

    getElement(): HTMLElement {
        return this.card;
    }

    show() {
        console.log(`DocumentCard.show() called for: ${this.title}`);
        console.log(`Card display before: ${this.card.style.display}`);
        this.card.style.display = 'block';
        console.log(`Card display after: ${this.card.style.display}`);
        console.log(`Card dimensions: ${this.card.offsetWidth}x${this.card.offsetHeight}`);
        if (this.summaryContainer.childElementCount === 0) {
            this.generateAndStreamSummary();
        }
    }

    hide() {
        console.log(`Hiding card for: ${this.title}`);
        this.card.style.display = 'none';
    }

    reset() {
        this.summaryContainer.innerHTML = '';
        this.hide();
    }

    private async generateAndStreamSummary() {
        try {
            let fullSummary = '';
            await this.plugin.searchEngine.apiClient.chatWebSocket(
                "Summarize the provided document in a few sentences. The provided document is actually a search result from Voyagers similar documents view.",
                (chunk) => {
                    fullSummary += chunk;
                    this.updateSummary(fullSummary);
                },
                () => {
                    this.updateSummary(fullSummary, true);
                },
                this.documentId
            );
        } catch (error) {
            console.error('Error generating summary:', error);
            this.summaryContainer.setText('Failed to generate summary.');
        }
    }

    private updateSummary(content: string, isComplete: boolean = false) {
        this.summaryContainer.empty();
        MarkdownRenderer.renderMarkdown(content, this.summaryContainer, '', null as unknown as Component);
        if (isComplete) {
            // Optionally, you can add some styling or indication that the summary is complete
        }
    }
}