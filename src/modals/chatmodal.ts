import { Plugin, Modal, MarkdownRenderer, Component, Notice } from "obsidian";
import { ApiClient } from "apiClient/apiClient";
import { ExamplePrompts, Prompt } from '../components/ExamplePrompts';

export class ChatModal extends Modal {
	private apiClient: ApiClient;
	private inputField: HTMLInputElement;
	private chatContainer: HTMLElement;
	private messageHistory: { sender: string; message: string }[] = [];
	private examplePromptsContainer: HTMLElement;
	private plugin: Plugin;

	constructor(plugin: Plugin, apiClient: ApiClient) {
		super(plugin.app);
		this.plugin = plugin;
		this.apiClient = apiClient;
	}

	onOpen() {
		this.createModalContent();
		// Focus the input field after a short delay
		setTimeout(() => this.inputField.focus(), 10);
	}

	onClose() {
		this.contentEl.empty();
	}

	private createModalContent() {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createEl('h2', { text: 'Chat with Voyager' });
		header.classList.add('contextual-search-header');

		this.examplePromptsContainer = contentEl.createEl('div', { cls: 'example-prompts-container' });
		this.createExamplePrompts();

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

		this.updateExamplePromptsVisibility();
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
		this.updateExamplePromptsVisibility();
	}

	private addMessageToChat(sender: string, message: string) {
		this.messageHistory.push({ sender, message });
		this.renderMessages();
		this.updateExamplePromptsVisibility();
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
			
			// const iconSrc = this.app.vault.configDir + '/plugins/voyager/resources/copyicon.svg';
			// console.log("iconSrc", iconSrc);
			// copyButton.createEl('img', { attr: { src: iconSrc } }); 
			copyButton.setAttribute('aria-label', 'Copy message');
			copyButton.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const textToCopy = sender === 'Voyager' ? contentEl.getAttribute('data-original-markdown') || contentEl.innerText : message;
				this.copyToClipboard(textToCopy);
			});
		});
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

	private updateExamplePromptsVisibility() {
		if (this.messageHistory.length === 0) {
			this.examplePromptsContainer.style.display = 'flex';
		} else {
			this.examplePromptsContainer.style.display = 'none';
		}
	}

	private createExamplePrompts() {
		const prompts: Prompt[] = [
			{ label: 'Summarize', fullPrompt: 'Summarize the current document' },
			{ label: 'Explain', fullPrompt: 'Explain the main concepts in this document' },
			{ label: 'Questions', fullPrompt: 'Generate questions about this document' }
		];
		new ExamplePrompts(this.examplePromptsContainer, prompts, (prompt) => this.sendAutomaticMessage(prompt));
	}
}