import { FileEditor } from "lib/fileEditor";
import { EditFileTool } from "./tools/editFIle";

export interface ToolCallContext<T> {
    fileEditor: FileEditor;
    toolCall: T;
}

export interface ClientSideTool<T> {
    name: string;
    invoke: (context: ToolCallContext<T>) => Promise<void>;
}

export class ClientSideToolManager {
    private tools: Map<string, ClientSideTool<any>>;
    private fileEditor: FileEditor;

    constructor(fileEditor: FileEditor) {
        this.tools = new Map<string, ClientSideTool<any>>();
        this.fileEditor = fileEditor;

        this.addTool(new EditFileTool());
    }

    addTool(tool: ClientSideTool<any>) {
        this.tools.set(tool.name, tool);
    }

    async invokeToolCall(toolCall: any) {
        // We can assume that the tool call is valid because the backend already verified it before sending it to the plugin
        const tool = this.tools.get(toolCall.name);
        if (!tool) {
            throw new Error(`Tool ${toolCall.name} not found`);
        }

        await tool.invoke({
            fileEditor: this.fileEditor,
            toolCall: toolCall.toolCall
        });
    }
}