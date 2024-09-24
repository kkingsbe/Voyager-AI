import { App, Modal } from "obsidian";
import { SearchEngine } from "searchengine";

export class ChatModal extends Modal {
	private searchEngine: SearchEngine;
	private inputField: HTMLInputElement;
	private chatContainer: HTMLElement;

	constructor(app: App, searchEngine: SearchEngine) {
		super(app);
		this.searchEngine = searchEngine;
	}

	onOpen() {
		this.createModalContent();
		this.inputField.focus();
		this.inputField.addEventListener('keypress', this.onKeyPress.bind(this));
	}

	onClose() {
		this.contentEl.empty();
	}

	private createModalContent() {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createEl('h2', { text: 'Chat with LLM' });
		header.classList.add('chat-modal-header');

		this.chatContainer = contentEl.createEl('div', { cls: 'chat-container' });

		this.inputField = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Type your message...'
		});
		this.inputField.classList.add('chat-input');
	}

	private async onKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const message = this.inputField.value;
			if (message) {
				this.addMessageToChat('You', message);
				this.inputField.value = '';
				const response = await this.searchEngine.generateBlurb(message, '', '');
				this.addMessageToChat('LLM', response);
			}
		}
	}

	private addMessageToChat(sender: string, message: string) {
		const messageEl = this.chatContainer.createEl('div', { cls: 'chat-message' });
		messageEl.innerHTML = `<strong>${sender}:</strong> ${message}`;
		this.chatContainer.scrollTo(0, this.chatContainer.scrollHeight);
	}
}
