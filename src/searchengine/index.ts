import { ApiClient } from 'apiClient/apiClient';
import { App, TFile } from 'obsidian';

export class SearchEngine {
    app: App;
    apiClient: ApiClient;

    constructor(app: App, apiKey: string) {
        this.app = app;
        this.apiClient = new ApiClient(apiKey);
    }

    updateApiKey(apiKey: string) {
        this.apiClient = new ApiClient(apiKey);
    }

    async embedDocument(title: string, content: string, id: string, creationDate: string) {
        return this.apiClient.embedDocument(title, content, id, creationDate);
    }

    async search(query: string, limit: number, enhanced: boolean) {
        const results = enhanced ? await this.apiClient.enhancedSearch(query, limit) : await this.apiClient.search(query, limit);
        console.log("Initial results:", results);

        const searchResults: { title: string, content: string, score: number }[] = [];

        for (const result of results) {
            console.log("Processing result:", result);
            const doc = this.app.vault.getAbstractFileByPath(result.title);
            console.log("Doc:", doc);
            if (doc && doc instanceof TFile) {
                const content = await this.app.vault.read(doc);
                console.log("Content:", content);
                searchResults.push({
                    title: doc.basename,
                    content,
                    score: result.score
                });
            }
        }

        searchResults.sort((a, b) => b.score - a.score);

        console.log(searchResults);

        return searchResults.slice(0, limit);
    }

    async generateBlurb(query: string, title: string, content: string) {
        return this.apiClient.generateBlurb(query, title, content);
    }

    async getSimilarDocuments(documentId: string) {
        return this.apiClient.getSimilarDocuments(documentId);
    }
}