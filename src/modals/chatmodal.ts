import { App, Modal, MarkdownRenderer, Component, Notice } from "obsidian";
import { ApiClient } from "apiClient/apiClient";

export class ChatModal extends Modal {
	private apiClient: ApiClient;
	private inputField: HTMLInputElement;
	private chatContainer: HTMLElement;
	private messageHistory: { sender: string; message: string }[] = [];

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
		if (this.messageHistory.length > 0 && this.messageHistory[this.messageHistory.length - 1].sender === 'Voyager') {
			this.messageHistory[this.messageHistory.length - 1].message = content;
		} else {
			this.messageHistory.push({ sender: 'Voyager', message: content });
		}
		this.renderMessages();
	}

	private addMessageToChat(sender: string, message: string) {
		this.messageHistory.push({ sender, message });
		this.renderMessages();
	}

	private renderMessages() {
		this.chatContainer.empty();
		this.messageHistory.forEach(({ sender, message }) => {
			const messageEl = this.chatContainer.createEl('div', { cls: 'chat-message search-result-card' });
			messageEl.createEl('strong', { text: sender + ': ', cls: 'search-result-title' });
			
			const contentEl = messageEl.createEl('div', { cls: 'search-result-secondary-text' });
			
			if (sender === 'Voyager') {
				// Use MarkdownRenderer to render the message as markdown
				MarkdownRenderer.renderMarkdown(message, contentEl, '', null as unknown as Component);
				contentEl.setAttribute('data-original-markdown', message);
			} else {
				contentEl.textContent = message;
			}

			const copyButton = messageEl.createEl('button', { cls: 'chat-copy-button' });
			copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
			copyButton.setAttribute('aria-label', 'Copy message');
			copyButton.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const textToCopy = sender === 'Voyager' ? contentEl.getAttribute('data-original-markdown') || contentEl.innerText : message;
				this.copyToClipboard(textToCopy);
			});
		});
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
		console.log('Copying to clipboard:', text);  // Add this line for debugging
		navigator.clipboard.writeText(text).then(() => {
			console.log('Text copied successfully');  // Add this line for debugging
			new Notice('Message copied to clipboard', 2000);
		}, (err) => {
			console.error('Could not copy text: ', err);
			new Notice('Failed to copy message', 2000);
		});
	}

	public async sendAutomaticMessage(message: string) {
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