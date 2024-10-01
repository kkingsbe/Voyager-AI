import * as d3 from 'd3';
import { ApiLink, CustomNode, DocumentGraphResponse, Link, Document } from './types';
import { ApiClient } from 'apiClient/apiClient';
import { Notice } from 'obsidian';

export class GraphRenderer {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g: d3.Selection<SVGGElement, unknown, null, undefined>;
    private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private simulation: d3.Simulation<CustomNode, Link>;
    private nodes: CustomNode[] = [];
    private links: Link[] = [];
    private apiClient: ApiClient;

    constructor(container: HTMLElement, apiClient: ApiClient) {
        this.apiClient = apiClient; 

        this.svg = d3.select(container).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 1000 1000');
        
        this.g = this.svg.append('g');
        
        this.createTooltip();
        this.simulation = d3.forceSimulation<CustomNode, Link>()
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(500, 500));
    }

    public addNodes(nodes: CustomNode[]) {
        this.nodes = nodes;
    }

    public addLinks(links: Link[]) {
        this.links = links;
    }

    public clear() {
        this.nodes = [];
        this.links = [];
    }

    private createTooltip() {
        this.tooltip = d3.select(this.svg.node()!.parentNode as HTMLElement)
            .append("div")
            .attr("class", "document-graph-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("pointer-events", "none");
    }
    
    private drag(simulation: d3.Simulation<CustomNode, Link>) {
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag<SVGCircleElement, CustomNode>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    private showTooltip(event: MouseEvent, node: CustomNode) {
        this.tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        this.tooltip.html(`Title: ${node.title}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    private hideTooltip() {
        this.tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    public cleanup() {
        this.tooltip.remove();
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    private transformLinks(documents: Document[], links: ApiLink[]): Link[] {
        const nodeMap = new Map(documents.map(doc => [doc.id!, doc]));
        return links.map(link => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (source && target) {
                return {
                    source: {
                        ...source,
                        id: source.id,
                        x: Math.random() * 1000,
                        y: Math.random() * 1000,
                        vx: 0,
                        vy: 0,
                        fx: null,
                        fy: null
                    } as CustomNode,
                    target: {
                        ...target,
                        id: target.id,
                        x: Math.random() * 1000,
                        y: Math.random() * 1000,
                        vx: 0,
                        vy: 0,
                        fx: null,
                        fy: null
                    } as CustomNode,
                    similarity: link.similarity
                };
            }
            return null;
        }).filter((link): link is Link => link !== null);
    }

    public onNodeClick(node: CustomNode) {
        console.log("Node clicked:", node);
        const res = this.apiClient.getDocumentGraph(node.id!);
        res.then((response: DocumentGraphResponse) => {
            console.log("API response:", response);
            
            // Merge new nodes with existing nodes
            const newNodes = response.documents
                .filter(newNode => !this.nodes.some(existingNode => existingNode.id === newNode.id))
                .map(newNode => ({
                    ...newNode,
                    x: (node.x ?? 0) + (Math.random() - 0.5) * 100,
                    y: (node.y ?? 0) + (Math.random() - 0.5) * 100,
                    vx: 0,
                    vy: 0,
                    fx: null,
                    fy: null
                } as CustomNode));
            
            this.nodes = [...this.nodes, ...newNodes];

            // Transform and merge new links
            const newLinks = this.transformLinks(response.documents, response.links);
            console.log("New links before filtering:", newLinks);
            
            const addedLinks = newLinks.filter(newLink => 
                !this.links.some(existingLink => 
                    (existingLink.source.id === newLink.source.id && existingLink.target.id === newLink.target.id) ||
                    (existingLink.source.id === newLink.target.id && existingLink.target.id === newLink.source.id)
                )
            );
            console.log("Links to be added:", addedLinks);
            
            this.links = [...this.links, ...addedLinks];

            console.log("Updated nodes:", this.nodes);
            console.log("Updated links:", this.links);

            // Update the simulation with new data
            this.simulation.nodes(this.nodes);
            this.simulation.force("link", d3.forceLink<CustomNode, Link>(this.links).id(d => d.id!).distance(100));
            this.simulation.alpha(1).restart();

            // Re-render the graph with all nodes and links
            this.renderGraph();
        }).catch(error => {
            console.error('Error fetching document graph data:', error);
            new Notice('Failed to load additional document graph data. Please try again.');
        });
    }

    public renderGraph() {
        console.log("Rendering graph with nodes:", this.nodes, "and links:", this.links);

        // Ensure all nodes have valid numeric values for x and y
        this.nodes.forEach(node => {
            if (typeof node.x !== 'number' || isNaN(node.x)) node.x = Math.random() * 1000;
            if (typeof node.y !== 'number' || isNaN(node.y)) node.y = Math.random() * 1000;
        });

        this.simulation.nodes(this.nodes);
        this.simulation.force("link", d3.forceLink<CustomNode, Link>(this.links).id(d => d.id).distance(100));
        this.simulation.alpha(1).restart();

        // Update links
        const link = this.g.selectAll<SVGLineElement, Link>("line")
            .data(this.links, (d: Link) => `${d.source.id}-${d.target.id}`);

        link.exit().remove();

        const linkEnter = link.enter().append("line")
            .attr("stroke-width", d => d.similarity * 2)
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6);

        const linkMerge = linkEnter.merge(link);

        // Update nodes
        const node = this.g.selectAll<SVGCircleElement, CustomNode>("circle")
            .data(this.nodes, (d: CustomNode) => d.id);

        node.exit().remove();

        const nodeEnter = node.enter().append("circle")
            .attr("r", 5)
            .attr("fill", "#69b3a2")
            .call(this.drag(this.simulation))
            .on('click', (event, d) => this.onNodeClick(d));

        const nodeMerge = nodeEnter.merge(node);

        // Update labels
        const label = this.g.selectAll<SVGTextElement, CustomNode>("text")
            .data(this.nodes, (d: CustomNode) => d.id);

        label.exit().remove();

        const labelEnter = label.enter().append("text")
            .text(d => d.title)
            .attr('x', 6)
            .attr('y', 3);

        const labelMerge = labelEnter.merge(label);

        nodeMerge.on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip());

        this.simulation.on("tick", () => {
            linkMerge
                .attr("x1", d => (d.source as CustomNode).x!)
                .attr("y1", d => (d.source as CustomNode).y!)
                .attr("x2", d => (d.target as CustomNode).x!)
                .attr("y2", d => (d.target as CustomNode).y!);

            nodeMerge
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);

            labelMerge
                .attr("x", d => d.x! + 6)
                .attr("y", d => d.y! + 3);
        });

        console.log("Graph rendering complete");
    }
}