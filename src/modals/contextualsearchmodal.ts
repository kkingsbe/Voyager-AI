import { App, debounce, Modal } from "obsidian";
import { SearchEngine } from "searchengine";

export class ContextualSearchModal extends Modal {
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private searchEngine: SearchEngine;
	private debouncedSearch: Function;
	private currentSearchTerm: string = '';
	private searchToken: number = 0;
	private enhancedToggle: HTMLInputElement;

	constructor(app: App, searchEngine: SearchEngine) {
		super(app);
		this.searchEngine = searchEngine;
		this.debouncedSearch = debounce(this.search.bind(this), 500);
	}

	/**
	 * Called when the modal is opened. Initializes the modal content and sets up event listeners.
	 */
	onOpen() {
		this.createModalContent();
		this.searchInput.focus();
		this.searchInput.addEventListener('input', this.onInputChange.bind(this));
		this.enhancedToggle.addEventListener('change', this.onInputChange.bind(this)); // Add this line
	}

	/**
	 * Called when the modal is closed. Clears the modal content.
	 */
	onClose() {
		this.contentEl.empty();
	}

	/**
	 * Creates the content of the modal, including the header, search input, results container, and footer.
	 */
	private createModalContent() {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createEl('h2', { text: 'Contextual Search' });
		header.classList.add('contextual-search-header');

		this.searchInput = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Type to start search...'
		});
		this.searchInput.classList.add('contextual-search-input');

		// Add the enhanced toggle switch
		const enhancedToggleContainer = contentEl.createEl('div', { cls: 'enhanced-toggle-container' });
		const enhancedLabel = enhancedToggleContainer.createEl('label', { text: 'Enhanced' });
		enhancedLabel.classList.add('enhanced-toggle-label');
		this.enhancedToggle = enhancedToggleContainer.createEl('input', { type: 'checkbox' });
		this.enhancedToggle.classList.add('enhanced-toggle');

		this.resultsContainer = contentEl.createEl('div');
		this.resultsContainer.classList.add('contextual-search-results');

		const footer = contentEl.createEl('div', { cls: 'contextual-search-footer' });
		const closeButton = footer.createEl('button', { text: 'Close' });
		closeButton.classList.add('contextual-search-close-button');
		closeButton.addEventListener('click', () => this.close());
	}

	/**
	 * Handles the input change event for the search input. Updates the current search term and triggers a debounced search.
	 */
	private onInputChange() {
		this.currentSearchTerm = this.searchInput.value;
		this.resultsContainer.empty();
		
		if (this.currentSearchTerm) {
			this.searchToken++;
			const currentToken = this.searchToken;
			const isEnhanced = this.enhancedToggle.checked; // Get the state of the checkbox
			this.resultsContainer.createEl('div', { cls: 'loading-spinner' });
			this.debouncedSearch(this.currentSearchTerm, currentToken, isEnhanced);
		}
	}

	/**
	 * Performs a search using the search engine and displays the results if the token matches the current search token.
	 * @param searchTerm - The term to search for.
	 * @param token - The token to ensure the search results are for the latest search term.
	 * @param isEnhanced - Whether to use the enhanced search mode.
	 */
	private async search(searchTerm: string, token: number, isEnhanced: boolean) {
		const results = await this.searchEngine.search(searchTerm, 10, isEnhanced);

		if (token === this.searchToken) {
			this.displayResults(results, searchTerm);
		}
	}

	/**
	 * Displays the search results in the results container. If no results are found, displays a no results message.
	 * @param results - The search results to display.
	 * @param searchTerm - The term that was searched for.
	 */
	private async displayResults(results: any[], searchTerm: string) {
		this.resultsContainer.empty();
		if (results.length === 0) {
			this.displayNoResultsMessage();
		} else {
			// Determine the min and max scores for normalization
			const scores = results.map(result => result.score || 0);
			const minScore = Math.min(...scores);
			const maxScore = Math.max(...scores);

			for (const result of results) {
				await this.createResultCard(result, searchTerm, minScore, maxScore);
			}
		}
	}

	/**
	 * Displays a message indicating that no results were found.
	 */
	private displayNoResultsMessage() {
		const noResultsMessage = this.resultsContainer.createEl('div', { cls: 'search-result-card no-results' });
		noResultsMessage.textContent = 'No results found.';
	}

	/**
	 * Creates a result card for a search result and adds it to the results container.
	 * @param result - The search result to create a card for.
	 * @param searchTerm - The term that was searched for.
	 * @param minScore - The minimum score in the results for normalization.
	 * @param maxScore - The maximum score in the results for normalization.
	 */
	private async createResultCard(result: any, searchTerm: string, minScore: number, maxScore: number) {
		const resultCard = this.resultsContainer.createEl('div', { cls: 'search-result-card' });

		const titleEl = resultCard.createEl('h3', { cls: 'search-result-title' });
		titleEl.innerHTML = this.highlightSearchTerm(result.title || 'Untitled', searchTerm);

		const blurb = await this.searchEngine.generateBlurb(searchTerm, result.title, result.content);
		const secondaryTextEl = resultCard.createEl('p', { cls: 'search-result-secondary-text' });
		secondaryTextEl.innerHTML = this.highlightSearchTerm(blurb, searchTerm);

		if (result.score) {
			const scoreEl = resultCard.createEl('span', { cls: 'search-result-score' });
			scoreEl.textContent = `Relevance: ${(result.score * 100).toFixed(2)}%`;

			// Normalize the score for the progress bar
			const normalizedScore = ((result.score - minScore) / (maxScore - minScore)) * 100;

			// Create a progress bar for the relevance score
			const progressBarContainer = resultCard.createEl('div', { cls: 'progress-bar-container' });
			const progressBar = progressBarContainer.createEl('div', { cls: 'progress-bar' });
			progressBar.style.width = `${normalizedScore}%`;
		}

		resultCard.addEventListener('click', () => {
			this.app.workspace.openLinkText(result.title, '', true);
			this.close();
		});
	}

	/**
	 * Highlights the search term in the given text by wrapping it in a span with the highlight class.
	 * @param text - The text to highlight the search term in.
	 * @param term - The search term to highlight.
	 * @returns The text with the search term highlighted.
	 */
	private highlightSearchTerm(text: string, term: string): string {
		const regex = new RegExp(`(${term})`, 'gi');
		return text.replace(regex, '<span class="highlight">$1</span>');
	}
}