import { EventRef, MarkdownPostProcessorContext, Notice, Plugin, TFile } from 'obsidian';
import { SearchEngine } from 'searchengine';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { ContextualSearchModal } from 'modals/contextualsearchmodal';
import { ChatModal } from 'modals/chatmodal';
import { SettingsTab } from 'views/settingsTab';
import { FileContentExtractor } from 'fileContentExtractor/FileContentExtractor';
import { IComment, initializeHighlightPlugin } from './commentHighlighter';
import { IndexedDocumentsModal } from 'modals/indexDocumentsModal';
import { DocumentGraphModal } from 'modals/documentGraphModal';

interface MyPluginSettings {
	apiKey: string;
	autoEmbedOnEdit: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: '',
	autoEmbedOnEdit: true
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	searchEngine: SearchEngine;
	notificationBell: HTMLElement;
	notificationCount: number = 5;
	updateComments: ((comments: IComment[]) => void) | undefined;
	private autoEmbedListener: EventRef | null = null;
	private summaryButton: HTMLElement;

	private addNotificationBell() {
		this.notificationBell = this.addStatusBarItem();
		this.notificationBell.addClass('mod-clickable');
		this.notificationBell.addClass('notification-bell-container');
		this.notificationBell.innerHTML = `
			<span class="notification-bell">🔔</span>
			<span class="notification-count">${this.notificationCount}</span>
		`;
		this.notificationBell.setAttribute('aria-label', 'Notifications');
		this.notificationBell.addEventListener('click', () => {
			new Notice('Notifications clicked!');
			// TODO: Implement notification functionality
		});
	}

	async onload() {
		await this.loadSettings();
		
		new Notice("Voyager loaded");
		//this.addNotificationBell();

		const { plugin: highlightPluginExtension, updateComments } = initializeHighlightPlugin([]);
		this.registerEditorExtension([highlightPluginExtension]);
		console.log("HighlightPlugin registered:", highlightPluginExtension);
		this.updateComments = updateComments;

		// Hook into preview mode to apply highlights
		this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
			// console.log("Markdown post processor called");
			// this.highlightInPreview(element);
		});

		this.addCommand({
			id: 'open-chat-modal',
			name: 'Open Chat Modal',
			callback: () => {
				new ChatModal(this.app, this.searchEngine.apiClient).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		this.searchEngine = new SearchEngine(this.app, this.settings.apiKey);

		// Add the auto-embed listener
		this.autoEmbedListener = this.app.vault.on('modify', debounce(async (file: TFile) => {
			if (file instanceof TFile) {
				if(this.settings.autoEmbedOnEdit) {
					new Notice(`Embedding document ${file.name}`);
					await this.embedDocument(file);
				}
			}
		}, 5000));

		this.addSummaryButton();

		this.addCommand({
			id: 'summarize-document',
			name: 'Summarize Document',
			callback: () => {
				this.summarizeActiveDocument();
			}
		})

		this.addCommand({
			id: 'contextual-search',
			name: 'Contextual Search',
			callback: () => {
				new ContextualSearchModal(this.app, this.searchEngine).open();
			}
		});

		this.addCommand({
			id: 'embed-all',
			name: 'Embed All',
			callback: () => {
				this.embedAllDocuments();
			}
		})

		this.addCommand({
			id: 'embed-current-document',
			name: 'Embed Current Document',
			callback: () => {
				this.embedActiveDocument();
			}
		});

		// this.addCommand({
		// 	id: 'test-comments',
		// 	name: 'Test Comments',
		// 	editorCallback: (editor) => {
		// 		console.log("Test Comments command triggered");
		// 		if (this.updateComments) {
		// 			const testComments = [
		// 				{
		// 					source_text: "the",  // This should exist in almost any document
		// 					comment_text: "This is a test comment"
		// 				}
		// 			];
		// 			console.log("Calling updateComments with:", testComments);
		// 			this.updateComments(testComments);
					
		// 			// Force a refresh of the editor
		// 			setTimeout(() => {
		// 				editor.refresh();
		// 			}, 100);

		// 			new Notice("Test comment added");
		// 		} else {
		// 			console.error("Update comments function not available");
		// 			new Notice("Update comments function not available");
		// 		}
		// 	}
		// })

		// this.registerEditorExtension(EditorView.decorations.of((view) => {
		// 	return Decoration.set([
		// 		Decoration.mark({
		// 			class: "voyager-test-highlight"
		// 		}).range(0, 10)
		// 	]);
		// }));

		this.addCommand({
			id: 'indexed-documents',
			name: 'Manage Indexed Documents',
			callback: () => {
				new IndexedDocumentsModal(this.app, this.searchEngine.apiClient).open();
			}
		})

		this.addCommand({
			id: 'open-document-graph',
			name: 'Open Document Graph',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
					const voyagerId = frontmatter?.['voyager-id'];
					if (voyagerId) {
						new DocumentGraphModal(this.app, this.searchEngine.apiClient, voyagerId).open();
					} else {
						new Notice('Voyager ID not found in the frontmatter of the active document.');
					}
				} else {
					new Notice('No active document to open the document graph.');
				}
			}
		});

		this.loadStyles();
	}

	highlightInPreview(element: HTMLElement) {
		console.log("highlightInPreview called");
		const keyword = "highlight";

		const wrapKeyword = (text: string): DocumentFragment => {
			const fragment = document.createDocumentFragment();
			const regex = new RegExp(`(${keyword})`, 'gi');
			const parts = text.split(regex);

			parts.forEach((part) => {
				if (part.toLowerCase() === keyword.toLowerCase()) {
					console.log("Highlighting:", part);
					const highlightSpan = document.createElement('span');
					highlightSpan.className = 'voyager-highlight-keyword';
					highlightSpan.textContent = part;
					fragment.appendChild(highlightSpan);
				} else {
					fragment.appendChild(document.createTextNode(part));
				}
			});

			return fragment;
		};

		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
		let node: Node | null;
		while ((node = walker.nextNode())) {
			const text = node.nodeValue;
			if (text && text.toLowerCase().includes(keyword.toLowerCase())) {
				console.log("Found text to highlight:", text);
				const fragment = wrapKeyword(text);
				node.parentNode?.replaceChild(fragment, node);
			}
		}
	}

	async embedDocument(file: TFile) {
		const creationDate = file.stat.ctime;
		const formattedCreationDate = new Date(creationDate).toISOString();
		const content = await FileContentExtractor.extractContentFromDocument(this.app, file);
		
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		let voyagerId = frontmatter?.['voyager-id'];
		
		if (!voyagerId) {
			voyagerId = uuidv4();
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm['voyager-id'] = voyagerId;
			});
		}
		
		await this.searchEngine.embedDocument(file.name, content, voyagerId, formattedCreationDate);
	}

	async embedActiveDocument() {
		const activeFile = this.app.workspace.getActiveFile();
		
		console.log("Embedding active document", activeFile);
		if (activeFile) {
			await this.embedDocument(activeFile);
		}
	}

	async embedAllDocuments() {
		const allFiles = this.app.vault.getAllLoadedFiles();
		let i = 0;
		for (const file of allFiles) {
			if (file instanceof TFile && !['canvas', 'html', 'png', 'jpg', 'jpeg'].includes(file.extension)) {
				new Notice(`Embedding document ${i}/${allFiles.length}`);
				i++;

				try {
					await this.embedDocument(file);
				} catch (error) {
					new Notice("Failed to embed document: " + file.name);
				}
			}
		}
	}

	addChatPanel() {
		const leaf = this.app.workspace.getRightLeaf(false)
		leaf?.setViewState({ type: 'chat-panel' })
	}

	onunload() {
		if (this.autoEmbedListener) {
			this.app.vault.offref(this.autoEmbedListener);
		}
		this.app.workspace.detachLeavesOfType('chat-panel')
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.searchEngine.updateApiKey(this.settings.apiKey);
	}

	updateNotificationCount(count: number) {
		this.notificationCount = count;
		const countElement = this.notificationBell.querySelector('.notification-count');
		if (countElement) {
			countElement.textContent = count.toString();
			(countElement as HTMLElement).style.display = count > 0 ? 'inline' : 'none';
		}
	}

	loadStyles() {
		const styleEl = document.createElement('style');
		styleEl.id = 'voyager-plugin-styles';
		styleEl.textContent = `
			.voyager-highlight-keyword {
				background-color: yellow !important;
				color: black !important;
				padding: 2px !important;
				border-radius: 3px !important;
				display: inline !important;
			}
		`;
		document.head.appendChild(styleEl);
		console.log("Styles loaded");
	}

	private addSummaryButton() {
		this.summaryButton = this.addStatusBarItem();
		this.summaryButton.addClass('mod-clickable');
		this.summaryButton.innerHTML = '📝';
		this.summaryButton.setAttribute('aria-label', 'Summarize Document');
		this.summaryButton.addEventListener('click', () => {
			this.summarizeActiveDocument();
		});
	}

	private async summarizeActiveDocument() {
		const activeFile = this.app.workspace.getActiveFile();
		console.log("Summarizing active document", activeFile);
		if (activeFile) {
			new Notice('Summarizing document: ' + activeFile.name);
			const chatModal = new ChatModal(this.app, this.searchEngine.apiClient);
			chatModal.open();
			
			const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			console.log("Frontmatter:", frontmatter);
			const currentDocumentId = frontmatter?.["voyager-id"] ?? undefined;
			
			let fullResponse = '';
			await this.searchEngine.apiClient.chatWebSocket(
				"Summarize the current document",
				(chunk) => {
					fullResponse += chunk;
					chatModal.updateAssistantMessage(fullResponse, false);
				},
				() => {
					chatModal.updateAssistantMessage(fullResponse, true);
				},
				currentDocumentId
			);
		} else {
			new Notice('No active document to summarize');
		}
	}
}
