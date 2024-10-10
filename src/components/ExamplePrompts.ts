import { Component } from 'obsidian';

export interface Prompt {
    label: string;
    fullPrompt: string;
}

export class ExamplePrompts extends Component {
    private container: HTMLElement;
    private prompts: Prompt[];
    private onPromptClick: (prompt: string) => void;

    constructor(container: HTMLElement, prompts: Prompt[], onPromptClick: (prompt: string) => void) {
        super();
        this.container = container;
        this.prompts = prompts;
        this.onPromptClick = onPromptClick;
        this.render();
    }

    private render() {
        const promptsContainer = this.container.createEl('div', { cls: 'example-prompts-container' });

        this.prompts.forEach(prompt => {
            const promptButton = promptsContainer.createEl('button', { 
                text: prompt.label, 
                cls: 'example-prompt-button'
            });
            promptButton.addEventListener('click', () => this.onPromptClick(prompt.fullPrompt));
        });
    }
}