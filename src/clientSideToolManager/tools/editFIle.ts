import { Notice } from "obsidian";
import { ClientSideTool, ToolCallContext } from "../clientSideToolManager";

interface IEditFileToolCall {
    path: string;
    content: string;
}

export class EditFileTool implements ClientSideTool<IEditFileToolCall> {
    name = "EditFileTool"
    
    async invoke(context: ToolCallContext<IEditFileToolCall>) {
        const { path, content } = context.toolCall;
        new Notice(`Editing file ${path}`);
        await context.fileEditor.editFile(path, content);
    }
}