import { App, Modal, Notice } from "obsidian";
import { ApiClient } from "apiClient/apiClient";
import { Document, ApiLink, Link, DocumentGraphResponse, CustomNode } from './types';
import { GraphRenderer } from './graphRenderer';

export class DocumentGraphModal extends Modal {
    private documentId: string;
    private apiClient: ApiClient;
    private graphRenderer: GraphRenderer;

    constructor(app: App, apiClient: ApiClient, documentId: string) {
        super(app);
        this.apiClient = apiClient;
        this.documentId = documentId;
    }

    addNodes(nodes: CustomNode[]) {
        this.graphRenderer.addNodes(nodes);
    }

    addLinks(links: Link[]) {
        this.graphRenderer.addLinks(links);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('document-graph-modal');

        this.createHeader(contentEl);
        const graphContainer = this.createGraphContainer(contentEl);

        this.graphRenderer = new GraphRenderer(graphContainer, this.apiClient);
        await this.fetchDataAndRenderGraph(this.documentId);
    }

    private createHeader(container: HTMLElement) {
        const header = container.createEl('div', { cls: 'document-graph-header' });
        header.createEl('h2', { text: 'Document Relationship Graph' });
        header.createEl('p', { text: 'Visualizing document relationships based on vector similarity', cls: 'document-graph-description' });
    }

    private createGraphContainer(container: HTMLElement) {
        const graphContainer = container.createEl('div', { cls: 'document-graph-container' });
        return graphContainer;
    }

    private async fetchDataAndRenderGraph(documentId: string) {
        try {
            const response: DocumentGraphResponse = await this.apiClient.getDocumentGraph(documentId);
            const nodes = response.documents;
            const links = this.transformLinks(response.documents, response.links);
            this.graphRenderer.clear();
            this.graphRenderer.addNodes(nodes);
            this.graphRenderer.addLinks(links);
            this.graphRenderer.renderGraph();
        } catch (error) {
            console.error('Error fetching document graph data:', error);
            new Notice('Failed to load document graph data. Please try again.');
        }
    }

    private transformLinks(nodes: Document[], apiLinks: ApiLink[]): Link[] {
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        return apiLinks.map(link => ({
            source: nodeMap.get(link.source)!,
            target: nodeMap.get(link.target)!,
            similarity: link.similarity
        }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.graphRenderer.cleanup();
    }

    private async handleNodeClick(node: CustomNode) {
        await this.fetchDataAndRenderGraph(node.id);
    }
}
