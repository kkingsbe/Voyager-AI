import { WidgetType } from "@codemirror/view";
import { IComment } from "commentHighlighter";

// Add this new class for the margin icon widget
export class CommentIconWidget extends WidgetType {
    constructor(private matchedComments: IComment[]) {
        super();
    }

    toDOM() {
        const span = document.createSpan({ cls: "voyager-comment-icon" });
        const emojiSpan = span.createSpan({ text: '📝' });
        
        span.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showCommentsModal();
        });

        return span;
    }

    private showCommentsModal() {
        const modal = document.createElement('div');
        modal.className = 'voyager-comments-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'voyager-comments-modal-content';

        this.matchedComments.forEach(comment => {
            const commentDiv = document.createDiv({ cls: 'voyager-comment' });
            commentDiv.createEl('strong', { text: 'Highlighted Text:' }).createEl('br');
            commentDiv.createEl('span', { text: comment.source_text });
            commentDiv.createEl('br');
            commentDiv.createEl('strong', { text: 'Comment:' }).createEl('br');
            commentDiv.createEl('span', { text: comment.comment_text });
            modalContent.appendChild(commentDiv);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }
}