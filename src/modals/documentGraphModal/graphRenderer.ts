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
                    source: { ...source, id: source.id } as CustomNode,
                    target: { ...target, id: target.id } as CustomNode,
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
            const newNodes = response.documents.filter(newNode => !this.nodes.some(existingNode => existingNode.id === newNode.id));
            const newLinks = this.transformLinks(response.documents, response.links);
            
            console.log("New nodes:", newNodes);
            console.log("New links:", newLinks);

            // Add only new nodes and links
            this.nodes = [...this.nodes, ...newNodes];
            this.links = [...this.links, ...newLinks.filter(newLink => 
                !this.links.some(existingLink => 
                    existingLink.source.id === newLink.source.id && 
                    existingLink.target.id === newLink.target.id
                )
            )];

            console.log("Updated nodes:", this.nodes);
            console.log("Updated links:", this.links);

            // Update the simulation with new data
            this.simulation.nodes(this.nodes);
            this.simulation.force("link", d3.forceLink<CustomNode, Link>(this.links).id(d => d.id).distance(100));
            this.simulation.alpha(1).restart();

            // Re-render the graph with all nodes and links
            this.renderGraph(this.nodes, this.links);
        }).catch(error => {
            console.error('Error fetching document graph data:', error);
            new Notice('Failed to load additional document graph data. Please try again.');
        });
    }

    public renderGraph(nodes: CustomNode[], links: Link[]) {
        console.log("Rendering graph with nodes:", nodes, "and links:", links);

        this.simulation.nodes(nodes);
        this.simulation.force("link", d3.forceLink<CustomNode, Link>(links).id(d => d.id).distance(100));
        this.simulation.alpha(1).restart();

        // Update links
        const link = this.g.selectAll("line")
            .data(links, (d: Link) => `${d.source.id}-${d.target.id}`)
            .join(
                enter => {
                    console.log("Entering new links:", enter);
                    return enter.append("line")
                        .attr("stroke-width", d => d.similarity * 2)
                        .attr("stroke", "#999")
                        .attr("stroke-opacity", 0.6);
                },
                update => {
                    console.log("Updating existing links:", update);
                    return update;
                },
                exit => {
                    console.log("Removing old links:", exit);
                    return exit.remove();
                }
            );

        // Update nodes
        const node = this.g.selectAll("circle")
            .data(nodes, (d: CustomNode) => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("r", 5)
                    .attr("fill", "#69b3a2")
                    .call(this.drag(this.simulation))
                    .on('click', (event, d) => this.onNodeClick(d)),
                update => update,
                exit => exit.remove()
            );

        // Update labels
        const label = this.g.selectAll("text")
            .data(nodes, (d: CustomNode) => d.id)
            .join(
                enter => enter.append("text")
                    .text(d => d.title)
                    .attr('x', 6)
                    .attr('y', 3),
                update => update,
                exit => exit.remove()
            );

        node.on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip());

        this.simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as CustomNode).x!)
                .attr("y1", d => (d.source as CustomNode).y!)
                .attr("x2", d => (d.target as CustomNode).x!)
                .attr("y2", d => (d.target as CustomNode).y!);

            node
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);

            label
                .attr("x", d => d.x! + 6)
                .attr("y", d => d.y! + 3);
        });

        console.log("Graph rendering complete");
    }
}
