import { App, Notice, TFile } from "obsidian";
import MyPlugin from "main";

/**
 * This class is used to edit files as instructed by the LLM running on the backend
 */
export class FileEditor {
    private app: App;
    private plugin: MyPlugin;
    
    constructor(app: App, plugin: MyPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * Checks if a file is whitelisted for editing.
     * @param path - The path to the file to check.
     * @returns True if the file is whitelisted, false otherwise.
     */
    private isFileWhitelisted(path: string): boolean {
        return this.plugin.settings.fileEditWhitelist.includes(path);
    }

    async getFile(path: string): Promise<TFile | null> {
        return this.app.vault.getFileByPath(path);
    }

    /**
     * Edits a file with the given new content.
     * @param path - The path to the file to edit.
     * @param newContent - The new content to replace the file's content with.
     * @throws Will throw an error if the file cannot be edited.
     */
    async editFile(path: string, newContent: string) {
        // Check if the file is whitelisted
        if (!this.isFileWhitelisted(path)) {
            //throw new Error(`File ${path} is not whitelisted for editing.`);
            new Notice(`File ${path} is not whitelisted for editing.`);
            return;
        }
        
        try {
            const file = await this.getFile(path);
            if (!file) {
                //throw new Error(`File ${path} not found`);
                new Notice(`File ${path} not found`);
                return;
            }
            await this.app.vault.modify(file, newContent);
        } catch (error) {
            console.error(`Failed to edit file ${path}:`, error);
            //throw new Error(`Failed to edit file ${path}: ${error.message}`);
            new Notice(`Failed to edit file ${path}: ${error.message}`);
            return;
        }
    }
}
