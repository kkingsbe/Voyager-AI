import { ColorPaletteSelection } from "components/ColorPaletteSelection";
import MyPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { SuggestModal, TFile } from "obsidian";
import { debounce } from "obsidian";

export class SettingsTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Create tabs
		const tabsContainer = containerEl.createEl('div', { cls: 'voyager-settings-tabs' });
		const generalTab = tabsContainer.createEl('button', { text: 'General', cls: 'voyager-tab active' });
		const whitelistTab = tabsContainer.createEl('button', { text: 'Whitelisted Documents', cls: 'voyager-tab' });

		// Create content containers
		const generalContent = containerEl.createEl('div', { cls: 'voyager-settings-content active' });
		const whitelistContent = containerEl.createEl('div', { cls: 'voyager-settings-content' });

		// General settings
		this.createGeneralSettings(generalContent);

		// Whitelisted documents
		this.createWhitelistSettings(whitelistContent);

		// Tab switching logic
		generalTab.addEventListener('click', () => this.switchTab(generalTab, generalContent));
		whitelistTab.addEventListener('click', () => this.switchTab(whitelistTab, whitelistContent));
	}

	private switchTab(clickedTab: HTMLElement, content: HTMLElement) {
		const tabs = this.containerEl.querySelectorAll('.voyager-tab');
		const contents = this.containerEl.querySelectorAll('.voyager-settings-content');

		tabs.forEach(tab => tab.removeClass('active'));
		contents.forEach(c => c.removeClass('active'));

		clickedTab.addClass('active');
		content.addClass('active');
	}

	private createGeneralSettings(container: HTMLElement) {
		new Setting(container)
			.setName('API Key')
			.setDesc('Enter your Voyager API key')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Auto Embed on Edit')
			.setDesc('Automatically embed documents when they are edited')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoEmbedOnEdit)
				.onChange(async (value) => {
					this.plugin.settings.autoEmbedOnEdit = value;
					await this.plugin.saveSettings();
				}));

		new Setting(container)
			.setName('Similarity Window')
			.setDesc('The number of characters to include from the end of the current document')
			.addText(text => text
				.setPlaceholder('Enter the number of characters')
				.setValue(this.plugin.settings.similarityWindow.toString())
				.onChange(async (value) => {
					this.plugin.settings.similarityWindow = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new ColorPaletteSelection(container, this.plugin);
	}

	private createWhitelistSettings(container: HTMLElement) {
		const whitelistEl = container.createEl('div', { cls: 'voyager-whitelist-container' });

		new Setting(whitelistEl)
			.setName('Whitelisted Documents')
			.setDesc('Documents that will always be indexed, regardless of auto-embed settings')
			.addButton(button => button
				.setButtonText('Add Document')
				.onClick(async () => {
					const fileSelector = new FileSuggest(this.app);
					const selectedFile = await fileSelector.waitForSelection();
					if (selectedFile) {
						this.plugin.settings.indexWhitelist.push(selectedFile.path);
						await this.plugin.saveSettings();
						this.updateWhitelistDisplay(whitelistEl);
					}
				}));

		this.updateWhitelistDisplay(whitelistEl);
	}

	private updateWhitelistDisplay(container: HTMLElement) {
		const listEl = container.querySelector('.voyager-whitelist-list') || container.createEl('ul', { cls: 'voyager-whitelist-list' });
		listEl.empty();

		this.plugin.settings.indexWhitelist.forEach((path, index) => {
			const listItem = listEl.createEl('li');
			listItem.createSpan({ text: path });
			const removeButton = listItem.createEl('button', { text: 'Remove' });
			removeButton.addEventListener('click', async () => {
				this.plugin.settings.indexWhitelist.splice(index, 1);
				await this.plugin.saveSettings();
				this.updateWhitelistDisplay(container);
			});
		});
	}
}

class FileSuggest {
    private resolvePromise: ((value: TFile | null) => void) | null = null;

    constructor(private app: App) {}

    waitForSelection(): Promise<TFile | null> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.showFileSuggest();
        });
    }

    private showFileSuggest() {
        new FileSuggestModal(this.app, (file: TFile) => {
            if (this.resolvePromise) {
                this.resolvePromise(file);
            }
        }).open();
    }
}

class FileSuggestModal extends SuggestModal<TFile> {
    private clearButton: HTMLElement;
    private noResultsEl: HTMLElement;
    private selectedIndex: number = -1;

    constructor(app: App, private onChoose: (file: TFile) => void) {
        super(app);
        this.limit = 50;
        this.noResultsEl = createDiv({ cls: "no-results", text: "No matching files found" });
    }

    onOpen() {
        super.onOpen();
        this.inputEl.placeholder = "Type to search for a file";
        this.inputEl.addClass('suggestion-input');
        this.createClearButton();
        this.appendNoResultsElement();

        this.inputEl.addEventListener("input", debounce(() => {
            this.updateSuggestions();
            this.clearButton.style.display = this.inputEl.value ? "block" : "none";
        }, 200));
        this.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "ArrowDown") {
                this.selectNextSuggestion();
                event.preventDefault();
            } else if (event.key === "ArrowUp") {
                this.selectPreviousSuggestion();
                event.preventDefault();
            } else if (event.key === "Enter") {
                this.chooseSuggestion();
                event.preventDefault();
            }
        });
    }

    private createClearButton() {
        this.clearButton = this.containerEl.createEl("button", {
            cls: "clear-button",
            text: "×",
        });
        this.clearButton.style.display = "none";
        this.clearButton.addEventListener("click", () => {
            this.inputEl.value = "";
            this.inputEl.focus();
            this.inputEl.style.display = "none";
            this.clearButton.style.display = "none";
            this.updateSuggestions();
        });
    }

    private appendNoResultsElement() {
        this.resultContainerEl.appendChild(this.noResultsEl);
        this.noResultsEl.style.display = "none";
    }

    getSuggestions(query: string): TFile[] {
        const files = this.app.vault.getMarkdownFiles().filter(file => 
            file.path.toLowerCase().includes(query.toLowerCase())
        );
        this.noResultsEl.style.display = files.length === 0 ? "block" : "none";
        return files;
    }

    renderSuggestion(file: TFile, el: HTMLElement) {
        el.createEl("div", { text: file.path });
    }

    onChooseSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(file);
        this.close();
    }

    private updateSuggestions() {
        const suggestions = this.getSuggestions(this.inputEl.value);
        this.resultContainerEl.empty();
        this.appendNoResultsElement(); // Re-append the no results element
        suggestions.forEach((suggestion, index) => {
            const suggestionEl = this.resultContainerEl.createEl("div", { cls: "suggestion-item" });
            this.renderSuggestion(suggestion, suggestionEl);
            suggestionEl.addEventListener("click", (event) => {
                event.preventDefault();
                this.selectedIndex = index;
                this.chooseSuggestion();
            });
            suggestionEl.addEventListener("mouseenter", () => {
                this.setSelectedIndex(index);
            });
        });
    }

    private setSelectedIndex(index: number) {
        const items = this.resultContainerEl.querySelectorAll(".suggestion-item");
        items.forEach((item, i) => {
            if (i === index) {
                item.addClass("is-selected");
            } else {
                item.removeClass("is-selected");
            }
        });
        this.selectedIndex = index;
    }

    private selectNextSuggestion() {
        const items = this.resultContainerEl.querySelectorAll(".suggestion-item");
        this.setSelectedIndex((this.selectedIndex + 1) % items.length);
    }

    private selectPreviousSuggestion() {
        const items = this.resultContainerEl.querySelectorAll(".suggestion-item");
        this.setSelectedIndex((this.selectedIndex - 1 + items.length) % items.length);
    }

    private chooseSuggestion() {
        const items = this.resultContainerEl.querySelectorAll(".suggestion-item");
        if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
            const file = this.getSuggestions(this.inputEl.value)[this.selectedIndex];
            this.onChooseSuggestion(file, new MouseEvent("click"));
        }
    }
}
