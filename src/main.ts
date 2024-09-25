import { Notice, Plugin, TFile } from 'obsidian';
import { SearchEngine } from 'searchengine';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { ContextualSearchModal } from 'modals/contextualsearchmodal';
import { ChatModal } from 'modals/chatmodal';
import { SettingsTab } from 'views/settingsTab';
import { ChatPanelView } from 'views/chatPanelView';
import { CommentHighlighter, FeedbackData } from './commentHighlighter';
import { FileContentExtractor } from 'fileContentExtractor/FileContentExtractor';

interface MyPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	searchEngine: SearchEngine;
	commentHighlighter: CommentHighlighter;
	notificationBell: HTMLElement;
	notificationCount: number = 5;

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
		
		new Notice("notetaking-sidekick loaded");
		this.addNotificationBell();

		this.registerView("chat-panel", (leaf) => new ChatPanelView(leaf))

		this.app.workspace.onLayoutReady(() => {
			this.addChatPanel()
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

		this.commentHighlighter = new CommentHighlighter(this.app);
		this.addCommand({
			id: 'highlight-comments',
			name: 'Highlight Comments',
			callback: () => {
				const feedbackData: FeedbackData = {
					"feedback": [
					  {
						"text": "Voyager is an Obsidian plugin which allows for fast vector-based document similarity search, and intelligent LLM conversations within the context of your complete vault.",
						"comment": "You've provided a clear and concise description of what Voyager is. Great job!"
					  },
					  {
						"text": "Use basic RAG techniques to allow for talking with ai assistant for enhanced search on docs",
						"comment": "Excellent mention of RAG techniques here! It's great that you've incorporated advanced search methodologies."
					  },
					  {
						"text": "Monetized website which generates api key\nUser enters api key into plugin config. Plugin sends api key to backend for all requests",
						"comment": "This is a clear explanation of the monetization and API key process. Well done!"
					  },
					  {
						"text": "Future Features\nReal-Time suggestions and explanations\nWhile typing, the assistant can check to see if it can add additional explanation or clarification to what you have written.",
						"comment": "The idea of real-time suggestions and explanations is innovative and could greatly enhance the user's experience. Excellent forward-thinking!"
					  },
					  {
						"text": "Formula checking\nDetermine if a formula was typed in a correct / valid manner. If not, create a comment.",
						"comment": "This feature is very useful for ensuring accuracy in note-taking, especially in technical fields. Great addition!"
					  },
					  {
						"text": "Conceptual error checking\nDetermine if a typed conceptual explanation is flawed or incorrect. If so, create a comment.",
						"comment": "Identifying and correcting conceptual errors can help users understand complex topics better. Excellent feature!"
					  },
					  {
						"text": "This feature has two modes\nHot mode: In this mode, the assistant consistently checks (every few secs) to see if a new comment should be added\nManual mode: In this mode, the assistant only runs when a certain hotkey is pressed.",
						"comment": "The flexible modes for real-time suggestions are a thoughtful touch. Giving users control over how often checks occur can cater to different working styles. Great thinking!"
					  }
					]
				};
				this.commentHighlighter.displayCommentsInActiveFile(feedbackData);
			}
		})

		this.addCommand({
			id: 'embed-current-document',
			name: 'Embed Current Document',
			callback: () => {
				this.embedActiveDocument();
			}
		});
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
				await this.embedDocument(file);
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
}
