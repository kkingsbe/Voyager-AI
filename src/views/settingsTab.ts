import { ColorPaletteSelection } from "components/ColorPaletteSelection";
import MyPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class SettingsTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Enter your Voyager API key')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Embed on Edit')
			.setDesc('Automatically embed documents when they are edited')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoEmbedOnEdit)
				.onChange(async (value) => {
					this.plugin.settings.autoEmbedOnEdit = value;
					await this.plugin.saveSettings();
				}));

		new ColorPaletteSelection(containerEl, this.plugin);
	}
}