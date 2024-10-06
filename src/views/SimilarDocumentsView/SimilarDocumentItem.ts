import { ColorUtils } from './ColorUtils';
import { DocumentCard } from './DocumentCard';
import MyPlugin from 'main';

export class SimilarDocumentItem {
    private navFile: HTMLElement;
    private card: DocumentCard;
    private link: HTMLElement;
    private colorSquare: HTMLElement;
    private cardContainer: HTMLElement;
    private isCardVisible: boolean = false;
    private hoverTimeout: NodeJS.Timeout | null = null;
    private normalizedSimilarity: number;

    constructor(
        private container: HTMLElement,
        private doc: {
            id: string;
            title: string;
            score: number;
        },
        private minScore: number,
        private maxScore: number,
        private index: number,
        private colorUtils: ColorUtils,
        private plugin: MyPlugin
    ) {
        this.normalizedSimilarity = 1 - this.calculateNormalizedSimilarity(this.doc.score);
        this.navFile = this.createNavFile();
        this.card = new DocumentCard(plugin, doc.id, doc.title, doc.score);
        this.cardContainer = this.createCardContainer();
        this.setupEventListeners();
        this.updateColor();
    }

    private calculateNormalizedSimilarity(score: number): number {
        return (score - this.minScore) / (this.maxScore - this.minScore);
    }

    private createNavFile(): HTMLElement {
        const navFile = this.container.createEl('div', { cls: 'nav-file' });
        const navFileTitle = navFile.createEl('div', { cls: 'nav-file-title' });
        
        navFileTitle.style.display = 'flex';
        navFileTitle.style.alignItems = 'center';

        // Create a colored square
        this.colorSquare = navFileTitle.createEl('span', { cls: 'color-square' });
        this.colorSquare.style.flexShrink = '0';
        this.colorSquare.style.width = '10px';
        this.colorSquare.style.height = '10px';
        this.colorSquare.style.backgroundColor = this.colorUtils.getInterpolatedColor(this.doc.score); // this.normalizedSimilarity
        this.colorSquare.style.marginRight = '5px';
        this.colorSquare.style.borderRadius = '2px';

        this.link = navFileTitle.createEl('a', { text: this.doc.title, cls: 'nav-file-title-content' });
        this.link.style.overflow = 'hidden';
        this.link.style.textOverflow = 'ellipsis';
        this.link.style.whiteSpace = 'nowrap';
        this.link.style.flexGrow = '1';
        this.link.style.textDecoration = 'none';
        this.link.style.color = 'var(--text-normal)';
        this.link.style.fontWeight = '500';
        this.link.setAttribute('aria-label', `Similarity: ${(this.doc.score * 100).toFixed(2)}%`);
        this.link.addClass('has-tooltip');

        return navFile;
    }

    private createCardContainer(): HTMLElement {
        const cardContainer = document.createElement('div');
        cardContainer.className = 'similar-document-card-container';
        cardContainer.style.height = '0';
        cardContainer.style.overflow = 'hidden';
        cardContainer.style.transition = 'height 0.3s ease';
        cardContainer.appendChild(this.card.getElement());
        this.navFile.insertAdjacentElement('afterend', cardContainer);
        return cardContainer;
    }

    private setupEventListeners() {
        this.link.addEventListener('click', (event) => {
            event.preventDefault();
            this.plugin.app.workspace.openLinkText(this.doc.title, '');
        });

        this.navFile.addEventListener('mouseenter', () => this.handleMouseEnter());
        this.navFile.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.cardContainer.addEventListener('mouseenter', () => this.handleMouseEnter());
        this.cardContainer.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    private handleMouseEnter() {
        // console.log(`Mouse enter: ${this.doc.title}`);
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }
        this.hoverTimeout = setTimeout(() => {
            console.log(`Showing card for: ${this.doc.title}`);
            this.showCard();
        }, 500);
    }

    private handleMouseLeave() {
        // console.log(`Mouse leave: ${this.doc.title}`);
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
        this.hideCard();
    }

    private showCard() {
        if (this.isCardVisible) return;
        console.log(`Actually showing card for: ${this.doc.title}`);
        const cardElement = this.card.getElement();
        this.cardContainer.style.height = `${cardElement.offsetHeight}px`;
        this.card.show();
        this.isCardVisible = true;
    }

    private hideCard() {
        if (!this.isCardVisible) return;
        console.log(`Hiding card for: ${this.doc.title}`);
        this.cardContainer.style.height = '0';
        setTimeout(() => {
            this.card.hide();
            this.isCardVisible = false;
        }, 300);
    }

    public updateColor() {
        console.log("SimilarDocumentItem: updateColor called for", this.doc.title);
        const color = this.colorUtils.getInterpolatedColor(this.normalizedSimilarity);
        console.log("SimilarDocumentItem: New color", color);
        this.colorSquare.style.backgroundColor = color;
    }

    public getTitle(): string {
        return this.doc.title;
    }
}