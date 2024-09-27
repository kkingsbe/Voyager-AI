import { App, Modal, MarkdownRenderer, Component, Notice } from "obsidian";
import { ApiClient } from "apiClient/apiClient";

export class ChatModal extends Modal {
	private apiClient: ApiClient;
	private inputField: HTMLInputElement;
	private chatContainer: HTMLElement;

	constructor(app: App, apiClient: ApiClient) {
		super(app);
		this.apiClient = apiClient;
	}

	onOpen() {
		this.createModalContent();
		this.inputField.focus();
	}

	onClose() {
		this.contentEl.empty();
	}

	private createModalContent() {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createEl('h2', { text: 'Chat with Voyager' });
		header.classList.add('contextual-search-header');

		this.chatContainer = contentEl.createEl('div', { cls: 'chat-container' });
		this.chatContainer.classList.add('contextual-search-results');

		this.inputField = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Type your message...'
		});
		this.inputField.classList.add('contextual-search-input');

		this.inputField.addEventListener('keypress', this.onKeyPress.bind(this));

		const footer = contentEl.createEl('div', { cls: 'contextual-search-footer' });
		const closeButton = footer.createEl('button', { text: 'Close' });
		closeButton.classList.add('contextual-search-close-button');
		closeButton.addEventListener('click', () => this.close());
	}

	private async onKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const message = this.inputField.value;
			if (message) {
				this.addMessageToChat('You', message);
				this.inputField.value = '';
				try {
					const activeFile = this.app.workspace.getActiveFile();
					const frontmatter = activeFile ? this.app.metadataCache.getFileCache(activeFile)?.frontmatter : null;
					const currentDocumentId = frontmatter?.["voyager-id"] ?? undefined;
					const response = await this.apiClient.chat(message, currentDocumentId);
					this.addMessageToChat('Voyager', response);
				} catch (error) {
					console.error('Error in chat:', error);
					this.addMessageToChat('Error', 'An error occurred while processing your request.');
				}
			}
		}
	}

	private addMessageToChat(sender: string, message: string) {
		const messageEl = this.chatContainer.createEl('div', { cls: 'chat-message search-result-card' });
		const senderEl = messageEl.createEl('strong', { text: sender + ': ', cls: 'search-result-title' });
		
		const contentEl = messageEl.createEl('div', { cls: 'search-result-secondary-text' });
		
		if (sender === 'Voyager') {
			MarkdownRenderer.renderMarkdown(message, contentEl, '', this as unknown as Component);
		} else {
			contentEl.textContent = message;
		}

		const copyButton = messageEl.createEl('button', { text: 'Copy', cls: 'chat-copy-button' });
		copyButton.addEventListener('click', () => this.copyToClipboard(message));

		this.chatContainer.scrollTo(0, this.chatContainer.scrollHeight);
	}

	private copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			new Notice('Message copied to clipboard');
		}, (err) => {
			console.error('Could not copy text: ', err);
			new Notice('Failed to copy message');
		});
	}

	public async sendAutomaticMessage(message: string) {
		this.addMessageToChat('You', message);
		this.inputField.value = '';
		try {
			const activeFile = this.app.workspace.getActiveFile();
			const frontmatter = activeFile ? this.app.metadataCache.getFileCache(activeFile)?.frontmatter : null;
			const currentDocumentId = frontmatter?.["voyager-id"] ?? undefined;
			const response = await this.apiClient.chat(message, currentDocumentId);
			this.addMessageToChat('Voyager', response);
		} catch (error) {
			console.error('Error in chat:', error);
			this.addMessageToChat('Error', 'An error occurred while processing your request.');
		}
	}
}
