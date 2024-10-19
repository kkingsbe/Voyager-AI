import { Notice } from "obsidian";
import { ClientSideTool, ToolCallContext } from "../clientSideToolManager";

interface IEditFileToolCall {
    path: string;
    content: string;
    chatOutput: string;
    editType: "remove" | "insert" | "append" | "replace";
    preceedingContent: string;
    suceedingText: string;
}

export class EditFileTool implements ClientSideTool<IEditFileToolCall> {
    name = "EditFileTool"

    private stripFrontmatter(content: string): {frontmatter: string, content: string} {
        const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
        if (frontmatterMatch) {
            return { frontmatter: frontmatterMatch[0], content: content.slice(frontmatterMatch[0].length) };
        }
        return { frontmatter: "", content: content };
    }

    private async calculateStartIndex(fileContent: string, preceedingContent: string): Promise<number> {
        return fileContent.indexOf(preceedingContent) + preceedingContent.length;
    }

    private async calculateEndIndex(fileContent: string, preceedingContent: string, suceedingText: string): Promise<number> {
        return fileContent.indexOf(suceedingText) + suceedingText.length;
    }

    async invoke(context: ToolCallContext<IEditFileToolCall>) {
        const { path, content } = context.toolCall;
        new Notice(`Editing file ${path}`);

        const file = await context.fileEditor.getFile(path);
        if (!file) {
            new Notice(`File ${path} not found`);
            return;
        }

        const rawContent = await context.app.vault.read(file);
        console.log("Raw content:", rawContent);
        const { content: oldContent, frontmatter } = this.stripFrontmatter(rawContent);

        console.log("Old content:", oldContent);
        console.log("Frontmatter:", frontmatter);

        let newContent = ""

        const startIndex = await this.calculateStartIndex(oldContent, context.toolCall.preceedingContent);
        const endIndex = await this.calculateEndIndex(oldContent, context.toolCall.preceedingContent, context.toolCall.suceedingText);

        switch (context.toolCall.editType) {
            case "append":
                newContent = oldContent + content;
                break;
            case "insert":
                newContent = oldContent.slice(0, startIndex) + content + oldContent.slice(startIndex);
                break;
            case "remove":
                console.log("Removing content");
                newContent = oldContent.slice(0, startIndex) + (endIndex != 0 ? oldContent.slice(endIndex) : "");
                console.log("Content before removal:", oldContent.slice(0, startIndex));
                console.log("Content after removal:", oldContent.slice(endIndex));
                break;
            case "replace":
                newContent = oldContent.slice(0, startIndex) + content + oldContent.slice(endIndex);
                break;
        }

        newContent = frontmatter + newContent;

        await context.fileEditor.editFile(path, newContent);
    }
}