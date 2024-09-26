import { MarkdownPostProcessorContext, Notice, Plugin, TFile } from 'obsidian';
import { SearchEngine } from 'searchengine';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { ContextualSearchModal } from 'modals/contextualsearchmodal';
import { ChatModal } from 'modals/chatmodal';
import { SettingsTab } from 'views/settingsTab';
import { FileContentExtractor } from 'fileContentExtractor/FileContentExtractor';
import { IComment, initializeHighlightPlugin } from './commentHighlighter';
import { Decoration, EditorView } from '@codemirror/view';
import { IndexedDocumentsModal } from 'modals/indexDocumentsModal';

interface MyPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	searchEngine: SearchEngine;
	notificationBell: HTMLElement;
	notificationCount: number = 5;
	updateComments: ((comments: IComment[]) => void) | undefined;

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
		this.addNotificationBell();

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

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		this.searchEngine = new SearchEngine(this.app, this.settings.apiKey);

		// Register event to embed document when saved
		const debouncedEmbed = debounce(() => {
			if (this.app.workspace.getActiveFile()) {
				new Notice("Voyager: Embedding document " + this.app.workspace.getActiveFile()?.name);
				this.embedActiveDocument();
			}
		}, 10000); // Adjust the debounce delay as needed

		this.registerEvent(
			this.app.vault.on('modify', (file: TFile) => {
				if (file === this.app.workspace.getActiveFile()) {
					debouncedEmbed();
				}
			})
		);

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

		this.registerEditorExtension(EditorView.decorations.of((view) => {
			return Decoration.set([
				Decoration.mark({
					class: "voyager-test-highlight"
				}).range(0, 10)
			]);
		}));

		this.addCommand({
			id: 'indexed-documents',
			name: 'Manage Indexed Documents',
			callback: () => {
				new IndexedDocumentsModal(this.app, this.searchEngine.apiClient).open();
			}
		})

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
}
