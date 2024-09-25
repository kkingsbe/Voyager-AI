import { MarkdownView, Notice, WorkspaceLeaf, EditorPosition } from 'obsidian';

export interface FeedbackItem {
    text: string;
    comment: string;
}

export interface FeedbackData {
    feedback: FeedbackItem[];
}

export class CommentHighlighter {
    private app: any;
    private commentView: HTMLElement | null = null;
    private decorations: any[] = [];

    constructor(app: any) {
        this.app = app;
    }

    displayCommentsInActiveFile(feedbackData: FeedbackData) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active Markdown view');
            return;
        }

        this.clearComments();
        this.createCommentView();

        const editor = activeView.editor;
        const content = editor.getValue();

        for (const item of feedbackData.feedback) {
            this.addCommentCard(item);
            this.highlightText(editor, content, item.text);
        }

        if (feedbackData.feedback.length > 0) {
            new Notice('Comments displayed and text highlighted');
        } else {
            new Notice('No comments to display');
        }
    }

    private clearComments() {
        if (this.commentView) {
            this.commentView.remove();
            this.commentView = null;
        }
        // Clear existing highlights
        const highlights = document.querySelectorAll('.highlight-comment');
        highlights.forEach(el => el.replaceWith(el.textContent || ''));
    }

    private createCommentView() {
        this.commentView = document.createElement('div');
        this.commentView.className = 'comment-view';
        this.commentView.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50px;
            width: 250px;
            max-height: calc(100vh - 100px);
            overflow-y: auto;
            background-color: #f0f0f0;
            border-radius: 5px;
            padding: 10px;
            z-index: 1000;
        `;
        document.body.appendChild(this.commentView);
    }

    private addCommentCard(item: FeedbackItem) {
        if (!this.commentView) return;

        const card = document.createElement('div');
        card.className = 'comment-card';
        card.style.cssText = `
            background-color: white;
            border-radius: 3px;
            padding: 10px;
            margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            position: relative;
        `;

        const text = document.createElement('div');
        text.className = 'comment-text';
        text.textContent = item.text;
        text.style.cssText = `
            font-size: 0.9em;
            color: #666;
            font-style: italic;
            margin-bottom: 5px;
        `;

        const comment = document.createElement('div');
        comment.className = 'comment-content';
        comment.textContent = item.comment;
        comment.style.marginTop = '5px';

        const dismissButton = document.createElement('button');
        dismissButton.textContent = '✕';
        dismissButton.className = 'comment-dismiss-button';
        dismissButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            color: #999;
        `;
        dismissButton.addEventListener('click', () => {
            card.remove();
            // TODO: Add logic to remove the corresponding highlight
        });

        card.appendChild(dismissButton);
        card.appendChild(text);
        card.appendChild(comment);
        this.commentView.appendChild(card);
    }

    private highlightText(editor: any, content: string, text: string) {
        const startIndex = content.indexOf(text);
        if (startIndex === -1) return;

        const endIndex = startIndex + text.length;
        const startPos = editor.offsetToPos(startIndex);
        const endPos = editor.offsetToPos(endIndex);

        const decoration = editor.addHighlight({
            from: startPos,
            to: endPos,
            class: 'highlight-comment'
        });

        // Store the decoration for later removal if needed
        if (!this.decorations) {
            this.decorations = [];
        }
        this.decorations.push(decoration);

        // Add click event to scroll to the highlighted text
        const highlightEl = editor.lineDiv.querySelector('.highlight-comment');
        if (highlightEl) {
            highlightEl.addEventListener('click', () => {
                editor.scrollIntoView({ from: startPos, to: endPos }, true);
            });
        }
    }
}
