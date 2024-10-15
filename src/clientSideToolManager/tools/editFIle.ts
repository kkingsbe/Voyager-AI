import { ClientSideTool, ToolCallContext } from "../clientSideToolManager";

interface IEditFileToolCall {
    path: string;
    content: string;
}

export class EditFileTool implements ClientSideTool<IEditFileToolCall> {
    name = "EditFileTool"
    
    async invoke(context: ToolCallContext<IEditFileToolCall>) {
        const { path, content } = context.toolCall;
        console.log("Editing file", context);
        await context.fileEditor.editFile(path, content);
    }
}