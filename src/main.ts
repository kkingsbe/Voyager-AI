import { Notice, Plugin, TFile } from 'obsidian';
import { SearchEngine } from 'searchengine';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { ContextualSearchModal } from 'modals/contextualsearchmodal';
import { ChatModal } from 'modals/chatmodal';
import { SettingsTab } from 'views/settingsTab';
import { ChatPanelView } from 'views/chatPanelView';

interface MyPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	searchEngine: SearchEngine;

	async onload() {
		await this.loadSettings();
		
		new Notice("notetaking-sidekick loaded");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.registerView("chat-panel", (leaf) => new ChatPanelView(leaf))

		this.app.workspace.onLayoutReady(() => {
			this.addChatPanel()
		});

		this.addCommand({
			id: 'open-chat-modal',
			name: 'Open Chat Modal',
			callback: () => {
				new ChatModal(this.app, this.searchEngine).open();
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
	}

	async embedActiveDocument() {
		const activeFile = this.app.workspace.getActiveFile();
		console.log("Embedding active document", activeFile);
		if (activeFile) {
			const content = await this.app.vault.read(activeFile);
			const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			let voyagerId = frontmatter?.['voyager-id'];
			
			if (!voyagerId) {
				voyagerId = uuidv4();
				await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
					fm['voyager-id'] = voyagerId;
				});
			}
			
			await this.searchEngine.embedDocument(activeFile.name, content, voyagerId);
		}
	}

	async embedAllDocuments() {
		const allFiles = this.app.vault.getAllLoadedFiles();
		let i = 0;
		for (const file of allFiles) {
			if (file instanceof TFile && !['canvas', 'html', 'png', 'jpg', 'jpeg', '.pdf'].includes(file.extension)) {
				const content = await this.app.vault.read(file);
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
				let voyagerId = frontmatter?.['voyager-id'];
				
				if (!voyagerId) {
					voyagerId = uuidv4();
					await this.app.fileManager.processFrontMatter(file, (fm) => {
						fm['voyager-id'] = voyagerId;
					});
				}

				console.log("Content: ", content)
				await this.searchEngine.embedDocument(file.name, content, voyagerId);
				i++;
				console.log(`Embedded ${i}/${allFiles.length} documents`);
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
}
