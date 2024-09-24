import { ItemView, Setting, WorkspaceLeaf } from "obsidian";

// Step 1: Define the Chat Panel View
export class ChatPanelView extends ItemView {
	messages: string[] = [];
  
	constructor(leaf: WorkspaceLeaf) {
	  super(leaf);
	}
  
	getViewType() {
	  return 'chat-panel';
	}
  
	getDisplayText() {
	  return 'Chat Panel';
	}
  
	async onOpen() {
	  this.renderChatPanel();
	}
  
	async onClose() {
	  // Handle cleanup if necessary
	}
  
	renderChatPanel() {
	  const container = this.containerEl;
	  container.empty(); // Clear any existing content
  
	  // Create chat display
	  const messageDisplay = container.createEl('div', { cls: 'chat-messages' });
	  messageDisplay.style.maxHeight = '200px';
	  messageDisplay.style.overflowY = 'auto';
	  messageDisplay.style.padding = '10px';
	  
	  this.messages.forEach(msg => {
		const messageEl = messageDisplay.createEl('div');
		messageEl.textContent = msg;
	  });
  
	  // Create input field and send button
	  const inputContainer = container.createEl('div');
	  inputContainer.style.display = 'flex';
	  inputContainer.style.alignItems = 'center';
	  const inputField = inputContainer.createEl('input', { type: 'text' });
	  inputField.style.flexGrow = '1';
	  inputField.style.marginRight = '10px';
	  inputField.placeholder = 'Type your message...';
  
	  new Setting(inputContainer)
		.addButton(button => {
		  button.setButtonText('Send').onClick(() => {
			const message = inputField.value;
			if (message) {
			  this.addMessage(message, messageDisplay);
			  inputField.value = '';
			}
		  });
		});
	}
  
	addMessage(message: string, messageDisplay: HTMLElement) {
	  this.messages.push(message);
	  const messageEl = messageDisplay.createEl('div');
	  messageEl.textContent = message;
	  messageDisplay.scrollTo(0, messageDisplay.scrollHeight);
	}	
}