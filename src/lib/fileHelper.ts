import { App, TFile } from "obsidian";

export class FileHelper {
    static getVoyagerId(app: App, file: TFile): string | null {
        const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
        return frontmatter?.['voyager-id'] || null;
    }
}