import { FileHelper } from 'lib/fileHelper';
import MyPlugin, { VoyagerSimilarityGradient } from 'main';
import { ItemView, WorkspaceLeaf, TFile, debounce, Notice, EventRef, MarkdownRenderer, Component } from 'obsidian';

export class SimilarDocumentsView extends ItemView {
    private documentEditListener: EventRef | null = null;
    private documentOpenListener: EventRef | null = null;
    private plugin: MyPlugin;
    private startColor: [number, number, number];
    private endColor: [number, number, number];

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.startColor = this.hexToHSV(this.plugin.settings.similarityGradient.startColor);
        this.endColor = this.hexToHSV(this.plugin.settings.similarityGradient.endColor);
    }

    getViewType() {
        return 'voyager-similar-documents';
    }

    getDisplayText() {
        return 'Voyager Similar Documents';
    }

    updateSettings(gradient: VoyagerSimilarityGradient) {
        this.startColor = this.hexToHSV(gradient.startColor);
        this.endColor = this.hexToHSV(gradient.endColor);
        this.refreshSimilarDocuments()
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // Create a header container
        const headerContainer = container.createEl('div', { cls: 'similar-documents-header' });
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.marginBottom = '10px';

        // Add the title
        headerContainer.createEl('h4', { text: 'Similar Documents' });

        // Create a placeholder for similar documents
        container.createEl('div', { cls: 'similar-documents-section' });

        // Add the refresh button
        this.addRefreshButton(container as HTMLElement);

        this.registerDocumentEditListener();
        this.registerDocumentOpenListener();
    }

    async onClose() {
        // Unregister the listener when the view is closed
        this.unregisterDocumentEditListener();
        this.unregisterDocumentOpenListener();
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

    private async updateSimilarDocuments(file: TFile) {
        const voyagerId = FileHelper.getVoyagerId(this.app, file);

        if (!voyagerId) {
            new Notice('Voyager ID not found in the frontmatter of the active document.');
            return;
        }

        console.log("Updating similar documents for:", voyagerId);
        const similarDocuments = await this.plugin.searchEngine.getSimilarDocuments(voyagerId);

        console.log("Similar documents:", similarDocuments);
        
        const container = this.containerEl.children[1];
        
        // Remove existing similar documents section
        const existingSection = container.querySelector('.similar-documents-section');
        if (existingSection) {
            existingSection.remove();
        }

        // Create a new section for similar documents
        const similarDocsSection = container.createEl('div', { cls: 'similar-documents-section nav-folder-children' });
        if (similarDocuments.length === 0) {
            similarDocsSection.createEl('div', { text: 'No similar documents found.', cls: 'nav-file' });
        } else {
            // Find min and max scores
            const scores = similarDocuments.map(doc => doc.score);
            const minScore = Math.min(...scores);
            const maxScore = Math.max(...scores);

            similarDocuments.forEach((doc, index) => {
                const navFile = similarDocsSection.createEl('div', { cls: 'nav-file' });
                const navFileTitle = navFile.createEl('div', { cls: 'nav-file-title' });
                
                navFileTitle.style.display = 'flex';
                navFileTitle.style.alignItems = 'center';

                // Calculate normalized similarity
                const normalizedSimilarity = maxScore === minScore ? 1 : (doc.score - minScore) / (maxScore - minScore);

                // Create a colored square
                const colorSquare = navFileTitle.createEl('span', { cls: 'color-square' });
                colorSquare.style.flexShrink = '0';
                colorSquare.style.width = '10px';
                colorSquare.style.height = '10px';
                colorSquare.style.backgroundColor = this.getInterpolatedColor(1 - normalizedSimilarity); // Use doc.score to base the color off of the un-normalized score
                colorSquare.style.marginRight = '5px';
                colorSquare.style.borderRadius = '2px'; // Add border radius

                const link = navFileTitle.createEl('a', { text: doc.title, cls: 'nav-file-title-content' });
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.whiteSpace = 'nowrap';
                link.style.flexGrow = '1';
                link.style.textDecoration = 'none'; // Remove underline
                link.style.color = 'var(--text-normal)'; // Use default text color
                link.style.fontWeight = '500'; // Set font weight to medium (500)

                // Add tooltip to the document title
                link.setAttribute('aria-label', `Similarity: ${(doc.score * 100).toFixed(2)}%`);
                link.addClass('has-tooltip');

                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.app.workspace.openLinkText(doc.title, '');
                });

                // Create a card element (initially hidden)
                const card = navFile.createEl('div', { cls: 'similar-document-card' });
                card.style.display = 'none';
                card.style.position = 'absolute';
                card.style.left = '0';
                card.style.right = '0';
                card.style.height = '200px';
                card.style.backgroundColor = 'var(--background-primary)';
                card.style.zIndex = '1000';
                card.style.padding = '20px';
                card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                card.style.borderRadius = '4px';
                card.style.overflow = 'auto';
                card.style.opacity = '0';
                card.style.transition = 'opacity 0.1s ease';

                // Add content to the card
                const cardHeader = card.createEl('div', { cls: 'card-header' });
                cardHeader.style.marginBottom = '10px';

                cardHeader.createEl('h3', { text: doc.title, cls: 'card-title' });
                cardHeader.createEl('p', { text: `Similarity: ${(doc.score * 100).toFixed(2)}%`, cls: 'card-similarity' });

                // Add a divider
                const divider = card.createEl('hr', { cls: 'card-divider' });
                divider.style.margin = '10px 0';
                divider.style.border = 'none';
                divider.style.borderTop = '1px solid var(--background-modifier-border)';

                // Create a container for the markdown summary
                const summaryContainer = card.createEl('div', { cls: 'summary-container' });

                let hoverTimeout: NodeJS.Timeout | null = null;
                let hideTimeout: NodeJS.Timeout | null = null;
                let isMouseOver = false;

                // Add hover event listeners
                navFile.addEventListener('mouseenter', () => {
                    isMouseOver = true;
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                    hoverTimeout = setTimeout(() => {
                        for (let i = index + 1; i < similarDocsSection.children.length; i++) {
                            const nextElement = similarDocsSection.children[i] as HTMLElement;
                            nextElement.style.transition = 'transform 0.3s ease';
                            nextElement.style.transform = 'translateY(200px)';
                        }
                        // Include the refresh button in the sliding effect
                        const refreshButton = container.querySelector('.similar-documents-refresh') as HTMLElement;
                        if (refreshButton) {
                            refreshButton.style.transition = 'transform 0.3s ease';
                            refreshButton.style.transform = 'translateY(200px)';
                        }
                        // Show and fade in the card
                        card.style.display = 'block';
                        setTimeout(() => {
                            card.style.opacity = '1';
                        }, 0);

                        // Generate and stream the summary only if it's empty
                        if (summaryContainer.childElementCount === 0) {
                            this.generateAndStreamSummary(doc.id, summaryContainer);
                        }
                    }, 500);
                });

                navFile.addEventListener('mouseleave', () => {
                    isMouseOver = false;
                    if (hoverTimeout) {
                        clearTimeout(hoverTimeout);
                        hoverTimeout = null;
                    }
                    
                    hideTimeout = setTimeout(() => {
                        if (!isMouseOver) {
                            this.hideCard(card, similarDocsSection, index, container as HTMLElement);
                        }
                    }, 100); // Small delay to allow mouse to enter the card
                });

                // Add event listeners for the card itself
                card.addEventListener('mouseenter', () => {
                    isMouseOver = true;
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                });

                card.addEventListener('mouseleave', () => {
                    isMouseOver = false;
                    hideTimeout = setTimeout(() => {
                        if (!isMouseOver) {
                            this.hideCard(card, similarDocsSection, index, container as HTMLElement);
                        }
                    }, 100);
                });
            });
        }

        // Remove existing refresh button
        const existingButton = container.querySelector('.similar-documents-refresh');
        if (existingButton) {
            existingButton.remove();
        }

        // Add the refresh button at the bottom
        this.addRefreshButton(container as HTMLElement);

        // Ensure the new section is visible
        similarDocsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private async refreshSimilarDocuments() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            await this.updateSimilarDocuments(activeFile);
        } else {
            new Notice('No active file to refresh similar documents.');
        }
    }

    private hexToHSV(hex: string): [number, number, number] {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;

        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h = h || 0
            h /= 6;
        }

        return [h * 360, s * 100, v * 100];
    }

    private hsvToHex(h: number, s: number, v: number): string {
        h /= 360;
        s /= 100;
        v /= 100;
        let r, g, b;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        const toHex = (x: number) => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r ?? 0)}${toHex(g ?? 0)}${toHex(b ?? 0)}`;
    }

    private getInterpolatedColor(similarity: number): string {
        const h = this.startColor[0] + (this.endColor[0] - this.startColor[0]) * similarity;
        const s = this.startColor[1] + (this.endColor[1] - this.startColor[1]) * similarity;
        const v = this.startColor[2] + (this.endColor[2] - this.startColor[2]) * similarity;
        return this.hsvToHex(h, s, v);
    }

    private addRefreshButton(container: HTMLElement) {
        const refreshButton = container.createEl('button', { text: 'Refresh', cls: 'similar-documents-refresh' });
        refreshButton.style.display = 'block';
        refreshButton.style.margin = '10px auto';
        refreshButton.style.cursor = 'pointer';
        refreshButton.style.transition = 'transform 0.3s ease'; // Add transition for smooth movement
        refreshButton.addEventListener('click', () => this.refreshSimilarDocuments());
    }

    private async generateAndStreamSummary(documentId: string, container: HTMLElement) {
        try {
            let fullSummary = '';
            await this.plugin.searchEngine.apiClient.chatWebSocket(
                "Summarize the provided document in a few sentences. The provided document is actually a search result from Voyagers similar documents view.",
                (chunk) => {
                    fullSummary += chunk;
                    this.updateSummary(container, fullSummary);
                },
                () => {
                    this.updateSummary(container, fullSummary, true);
                },
                documentId
            );
        } catch (error) {
            console.error('Error generating summary:', error);
            container.setText('Failed to generate summary.');
        }
    }

    private updateSummary(container: HTMLElement, content: string, isComplete: boolean = false) {
        container.empty();
        MarkdownRenderer.renderMarkdown(content, container, '', null as unknown as Component);
        if (isComplete) {
            // Optionally, you can add some styling or indication that the summary is complete
        }
    }

    private hideCard(card: HTMLElement, similarDocsSection: HTMLElement, index: number, container: HTMLElement) {
        for (let i = index + 1; i < similarDocsSection.children.length; i++) {
            const nextElement = similarDocsSection.children[i] as HTMLElement;
            nextElement.style.transform = 'translateY(0)';
        }
        // Reset the refresh button position
        const refreshButton = container.querySelector('.similar-documents-refresh') as HTMLElement;
        if (refreshButton) {
            refreshButton.style.transform = 'translateY(0)';
        }
        // Hide the card
        card.style.opacity = '0';
        setTimeout(() => {
            card.style.display = 'none';
            // Clear the summary when hiding the card
            const summaryContainer = card.querySelector('.summary-container');
            if (summaryContainer) {
                summaryContainer.innerHTML = '';
            }
        }, 100);
    }
}