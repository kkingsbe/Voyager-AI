import { WidgetType } from "@codemirror/view";
import { IComment } from "commentHighlighter";

// Add this new class for the margin icon widget
export class CommentIconWidget extends WidgetType {
    constructor(private matchedComments: IComment[]) {
        super();
    }

    toDOM() {
        const span = document.createElement("span");
        span.innerHTML = "💬"; // Changed the icon to a comment icon
        span.className = "voyager-comment-icon";
        
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
            const commentDiv = document.createElement('div');
            commentDiv.className = 'voyager-comment';
            commentDiv.innerHTML = `
                <strong>Highlighted Text:</strong> ${comment.source_text}<br>
                <strong>Comment:</strong> ${comment.comment_text}
            `;
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