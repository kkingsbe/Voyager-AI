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
					
					let fullResponse = '';
					await this.apiClient.chatWebSocket(
						message,
						(chunk) => {
							fullResponse += chunk;
							this.updateAssistantMessage(fullResponse, false);
						},
						() => {
							this.updateAssistantMessage(fullResponse, true);
						},
						currentDocumentId
					);
				} catch (error) {
					console.error('Error in chat:', error);
					this.addMessageToChat('Error', 'An error occurred while processing your request.');
				}
			}
		}
	}

	public updateAssistantMessage(content: string, isComplete: boolean) {
		const lastMessage = this.chatContainer.lastElementChild;
		if (lastMessage && lastMessage.querySelector('strong')?.textContent === 'Voyager: ') {
			const contentEl = lastMessage.querySelector('.search-result-secondary-text');
			if (contentEl instanceof HTMLElement) {
				contentEl.empty(); // Clear existing content
				if (isComplete) {
					MarkdownRenderer.renderMarkdown(content, contentEl, '', this as unknown as Component);
				} else {
					this.renderSimplifiedMarkdown(content, contentEl); // Use simplified markdown for streaming
				}
			}
		} else {
			this.addMessageToChat('Voyager', content);
		}
		this.chatContainer.scrollTo(0, this.chatContainer.scrollHeight);
	}

	private addMessageToChat(sender: string, message: string) {
		const messageEl = this.chatContainer.createEl('div', { cls: 'chat-message search-result-card' });
		messageEl.createEl('strong', { text: sender + ': ', cls: 'search-result-title' });
		
		const contentEl = messageEl.createEl('div', { cls: 'search-result-secondary-text' });
		
		if (sender === 'Voyager') {
			this.renderMarkdownWithCustomLinks(message, contentEl);
		} else {
			contentEl.textContent = message;
		}

		const copyButton = messageEl.createEl('button', { text: 'Copy', cls: 'chat-copy-button' });
		copyButton.addEventListener('click', () => this.copyToClipboard(message));

		this.chatContainer.scrollTo(0, this.chatContainer.scrollHeight);
	}

	private renderMarkdownWithCustomLinks(markdown: string, element: HTMLElement) {
		console.log('Rendering markdown:', markdown);
		const linkRegex = /\[\[(.*?)\]\]/g;
		let lastIndex = 0;
		let match;
		let linkCount = 0;

		while ((match = linkRegex.exec(markdown)) !== null) {
			linkCount++;
			// Add text before the link
			if (match.index > lastIndex) {
				element.appendText(markdown.slice(lastIndex, match.index));
			}

			// Create link element
			const linkText = match[1];
			console.log('Creating link for:', linkText);
			const link = element.createEl('a', { text: linkText, cls: 'internal-link' });
			link.addEventListener('click', (event) => {
				console.log('Link clicked:', linkText);
				event.preventDefault();
				this.navigateToFile(linkText);
			});

			lastIndex = linkRegex.lastIndex;
		}

		// Add any remaining text after the last link
		if (lastIndex < markdown.length) {
			element.appendText(markdown.slice(lastIndex));
		}

		console.log(`Created ${linkCount} links`);
	}

	private renderSimplifiedMarkdown(markdown: string, element: HTMLElement) {
		console.log('Rendering simplified markdown:', markdown);
		const lines = markdown.split('\n');
		const linkRegex = /\[\[(.*?)\]\]/g;

		lines.forEach((line, index) => {
			let lastIndex = 0;
			let match;

			while ((match = linkRegex.exec(line)) !== null) {
				// Add text before the link
				if (match.index > lastIndex) {
					element.appendText(line.slice(lastIndex, match.index));
				}

				// Create link element
				const linkText = match[1];
				const link = element.createEl('a', { text: linkText, cls: 'internal-link' });
				link.addEventListener('click', (event) => {
					event.preventDefault();
					this.navigateToFile(linkText);
				});

				lastIndex = linkRegex.lastIndex;
			}

			// Add any remaining text after the last link
			if (lastIndex < line.length) {
				element.appendText(line.slice(lastIndex));
			}

			// Add a newline element if it's not the last line
			if (index < lines.length - 1) {
				element.createEl('br');
			}
		});
	}

	private navigateToFile(fileName: string) {
		console.log('Navigating to:', fileName);
		const file = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		if (file) {
			console.log('File found:', file.path);
			this.app.workspace.getLeaf().openFile(file);
			this.close();
		} else {
			console.log('File not found:', fileName);
			new Notice(`File not found: ${fileName}`);
		}
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