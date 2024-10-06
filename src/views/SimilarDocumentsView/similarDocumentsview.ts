import { ItemView, WorkspaceLeaf, TFile, debounce, Notice, EventRef } from 'obsidian';
import MyPlugin, { VoyagerSettings } from 'main';
import { FileHelper } from 'lib/fileHelper';
import { ColorUtils } from './ColorUtils';
import { SimilarDocumentItem } from './SimilarDocumentItem';

export class SimilarDocumentsView extends ItemView {
    private documentEditListener: EventRef | null = null;
    private documentOpenListener: EventRef | null = null;
    private plugin: MyPlugin;
    private colorUtils: ColorUtils;
    private documentItems: SimilarDocumentItem[] = [];

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.colorUtils = new ColorUtils(plugin.settings.similarityGradient);
        this.colorUtils.on('colorsUpdated', this.updateAllColors.bind(this));

        // Add this line to ensure only one instance is active
        this.cleanupExistingInstances();
    }

    private cleanupExistingInstances() {
        const leaf = this.leaf;
        const existingContentEls = leaf.view.containerEl.querySelectorAll('.workspace-leaf-content');
        
        if (existingContentEls.length > 1) {
            console.log(`Found ${existingContentEls.length} content elements, cleaning up...`);
            for (let i = 1; i < existingContentEls.length; i++) {
                existingContentEls[i].remove();
            }
        }
    }

    getViewType() {
        return 'voyager-similar-documents';
    }

    getDisplayText() {
        return 'Voyager Similar Documents';
    }

    updateSettings(settings: VoyagerSettings) {
        console.log("SimilarDocumentsView: updateSettings called", settings);
        console.log("Current gradient:", this.colorUtils.getCurrentGradient());
        this.colorUtils.updateColors(settings.similarityGradient);
        console.log("New gradient:", this.colorUtils.getCurrentGradient());
        this.refreshSimilarDocuments(true);
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // Check if header already exists
        let headerContainer = container.querySelector('.similar-documents-header');
        if (!headerContainer) {
            // Create a header container
            headerContainer = container.createEl('div', { cls: 'similar-documents-header' });
            headerContainer.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;');

            // Add the title
            headerContainer.createEl('h4', { text: 'Similar Documents' });
        }

        // Check if similar documents section already exists
        let similarDocsSection = container.querySelector('.similar-documents-section');
        if (!similarDocsSection) {
            // Create a placeholder for similar documents
            similarDocsSection = container.createEl('div', { cls: 'similar-documents-section' });
        }

        // Add the refresh button
        this.addRefreshButton(container as HTMLElement);

        this.registerDocumentEditListener();
        this.registerDocumentOpenListener();

        // Refresh the view when it's opened
        await this.refreshSimilarDocuments(true);
    }

    async onClose() {
        // Unregister the listener when the view is closed
        this.unregisterDocumentEditListener();
        this.unregisterDocumentOpenListener();

        // Clear the container to remove any existing elements
        const container = this.containerEl.children[1];
        container.empty();
    }

    private registerDocumentEditListener() {
        // Unregister any existing listener before adding a new one
        this.unregisterDocumentEditListener();

        this.documentEditListener = this.app.vault.on('modify', debounce(async (file: TFile) => {
            if (file instanceof TFile) {
                await this.updateSimilarDocuments(file);
            }
        }, 4000));
    }

    private unregisterDocumentEditListener() {
        if (this.documentEditListener) {
            this.app.vault.offref(this.documentEditListener);
            this.documentEditListener = null;
        }
    }

    private registerDocumentOpenListener() {
        this.documentOpenListener = this.app.workspace.on('file-open', (file: TFile | null) => {
            if (file instanceof TFile) {
                this.updateSimilarDocuments(file);
            }
        });
    }

    private unregisterDocumentOpenListener() {
        if (this.documentOpenListener) {
            this.app.workspace.offref(this.documentOpenListener);
            this.documentOpenListener = null;
        }
    }

    private async updateSimilarDocuments(file: TFile, forceRefresh: boolean = false) {
        const voyagerId = FileHelper.getVoyagerId(this.app, file);

        if (!voyagerId) {
            new Notice('Voyager ID not found in the frontmatter of the active document.');
            return;
        }

        const allFileContents = await this.app.vault.cachedRead(file);
        const allFileContentsWithWindow = allFileContents.slice(-this.plugin.settings.similarityWindow);

        const similarDocuments = await this.plugin.searchEngine.apiClient.getSimilarDocumentsWithWindow(voyagerId, allFileContentsWithWindow);

        
        const container = this.containerEl.children[1];
        
        // Find the existing similar documents section
        let similarDocsSection = container.querySelector('.similar-documents-section');
        
        // If it doesn't exist, create it
        if (!similarDocsSection) {
            similarDocsSection = container.createEl('div', { cls: 'similar-documents-section nav-folder-children' });
        } else {
            similarDocsSection.empty();
        }

        this.documentItems = []; // Clear previous items
        console.log("=== scores === ", similarDocuments.map(doc => doc.score));

        // Remove existing refresh button
        const existingButton = container.querySelectorAll('.similar-documents-refresh');
        if (existingButton) {
            existingButton.forEach(button => button.remove());
        }

        if (similarDocuments.length === 0) {
            similarDocsSection.createEl('div', { text: 'No similar documents found.', cls: 'nav-file' });
        } else {
            const maxScore = Math.max(...similarDocuments.map(doc => doc.score));
            const minScore = Math.min(...similarDocuments.map(doc => doc.score));
            
            // Use Promise.all to create all items first
            const itemPromises = similarDocuments.map((doc, index) => 
                new Promise<SimilarDocumentItem>((resolve) => {
                    setTimeout(() => {
                        const item = new SimilarDocumentItem(similarDocsSection as HTMLElement, doc, minScore, maxScore, index, this.colorUtils, this.plugin);
                        item.getElement().style.animationDelay = `${index * 50}ms`; // Stagger the animation
                        resolve(item);
                    }, index * 5); // Stagger the creation
                })
            );

            // Wait for all items to be created
            this.documentItems = await Promise.all(itemPromises);
        }

        // Add the refresh button at the bottom
        this.addRefreshButton(container as HTMLElement);

        // Ensure the new section is visible
        similarDocsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private clearItems() {
        const container = this.containerEl.children[1];
        
        // Remove all divs with the similar-documents-section class
        const similarDocsSections = container.querySelectorAll('div.similar-documents-section');

        console.log("SimilarDocumentsView: Clearing similar documents sections");
        console.log("Similar Docs Sections:", similarDocsSections);

        similarDocsSections.forEach(section => section.remove());
    }

    private async refreshSimilarDocuments(forceRefresh: boolean = false) {
        console.log("SimilarDocumentsView: refreshSimilarDocuments called, forceRefresh:", forceRefresh);

        const container = this.containerEl.children[1];
        this.clearItems();

        // Create a new section for similar documents
        const similarDocsSection = container.createEl('div', { cls: 'similar-documents-section nav-folder-children' });

        this.documentItems = []; // Clear previous items

        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            await this.updateSimilarDocuments(activeFile, forceRefresh);
        } else {
            console.log("SimilarDocumentsView: No active file");
            new Notice('No active file to refresh similar documents.');
            similarDocsSection.createEl('div', { text: 'No active file. Open a file to see similar documents.', cls: 'nav-file' });
        }

        // Remove existing refresh button
        const existingButton = container.querySelector('.similar-documents-refresh');
        if (existingButton) {
            existingButton.remove();
        }

        // Add the refresh button at the bottom
        this.addRefreshButton(container as HTMLElement);
    }

    private addRefreshButton(container: HTMLElement) {
        const refreshButton = container.createEl('button', { text: 'Refresh', cls: 'similar-documents-refresh' });
        refreshButton.style.display = 'block';
        refreshButton.style.margin = '10px auto';
        refreshButton.style.cursor = 'pointer';
        refreshButton.style.transition = 'transform 0.3s ease'; // Add transition for smooth movement
        refreshButton.addEventListener('click', () => this.refreshSimilarDocuments());
    }

    private updateAllColors() {
        console.log("SimilarDocumentsView: updateAllColors called");
        console.log("Current documentItems count:", this.documentItems.length);
        this.documentItems.forEach((item, index) => {
            console.log(`Updating color for item ${index}:`, item.getTitle());
            item.updateColor();
        });
    }
}