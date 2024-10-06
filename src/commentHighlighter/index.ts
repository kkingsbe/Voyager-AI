import { EditorView, ViewPlugin, ViewUpdate, Decoration, PluginValue, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { CommentIconWidget } from "./commentIconWidget";

export interface IComment {
    source_text: string;
    comment_text: string;
}

class HighlightPlugin implements PluginValue {
    decorations: DecorationSet;
    comments: IComment[];
    view: EditorView;

    constructor(view: EditorView, comments: IComment[]) {
        this.view = view;
        this.comments = comments;
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    destroy() {}

    buildDecorations(view: EditorView): DecorationSet {
        console.log("Building decorations");
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        console.log("Document length:", doc.length);

        for (let i = 1; i <= doc.lines; i++) {
            const line = doc.line(i);

            this.comments.forEach(comment => {
                const regex = new RegExp(comment.source_text, 'gi');
                let match;

                while ((match = regex.exec(line.text)) !== null) {
                    const from = line.from + match.index;
                    const to = from + match[0].length;
                    builder.add(from, to, Decoration.mark({
                        class: "voyager-highlight-keyword"
                    }));
                }
            });
        }

        const decorations = builder.finish();
        return decorations;
    }

    updateComments(comments: IComment[]) {
        console.log("Updating comments in HighlightPlugin");
        this.comments = comments;
        this.decorations = this.buildDecorations(this.view);
    }
}

export function initializeHighlightPlugin(initialComments: IComment[]) {
    let pluginInstance: HighlightPlugin;

    const plugin = ViewPlugin.fromClass(
        class extends HighlightPlugin {
            constructor(view: EditorView) {
                super(view, initialComments);
                pluginInstance = this;
                console.log("HighlightPlugin instance created");
            }
        },
        {
            decorations: (value: HighlightPlugin) => value.decorations
        }
    );

    const updateComments = (newComments: IComment[]) => {
        console.log("updateComments called with:", newComments);
        if (pluginInstance) {
            pluginInstance.updateComments(newComments);
            console.log("Comments updated in plugin instance");
        } else {
            console.error("Plugin instance not available");
        }
    };

    return { plugin, updateComments };
}
