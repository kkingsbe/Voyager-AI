import * as d3 from 'd3';
import { CustomNode, Link } from './types';

export class GraphRenderer {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private simulation: d3.Simulation<CustomNode, undefined>;
    private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;

    constructor(container: HTMLElement) {
        this.svg = d3.select(container).append('svg')
            .attr('width', '100%')
            .attr('height', '600');
        this.createTooltip();
    }

    private createTooltip() {
        this.tooltip = d3.select(this.svg.node()!.parentNode as HTMLElement)
            .append("div")
            .attr("class", "document-graph-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("pointer-events", "none");
    }

    public renderGraph(nodes: CustomNode[], links: Link[]) {
        const width = this.svg.node()?.clientWidth || 800;
        const height = 600;

        const degrees = this.calculateNodeDegrees(nodes, links);

        this.simulation = d3.forceSimulation<CustomNode>(nodes)
            .force('link', d3.forceLink<CustomNode, Link>(links)
                .id(d => d.id)
                .distance(d => (1 - d.similarity) * 200)) // Use similarity for link distance
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

        this.renderLinks(links);
        this.renderNodes(nodes, degrees);
        this.renderLabels(nodes);

        this.simulation.on('tick', () => this.updatePositions());
    }

    private renderLinks(links: Link[]) {
        const linkElements = this.svg.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', d => d.similarity)
            .attr('stroke-width', d => d.similarity * 3);

        // Add titles to links for hover information
        linkElements.append('title')
            .text(d => `Similarity: ${(d.similarity * 100).toFixed(2)}%`);
    }

    private renderNodes(nodes: CustomNode[], degrees: Map<string, number>) {
        const maxDegree = Math.max(...degrees.values());
        const sizeScale = d3.scaleLinear().domain([1, maxDegree]).range([5, 15]);

        const node = this.svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', d => sizeScale(degrees.get(d.id)!))
            .attr('fill', '#69b3a2')
            .attr('class', 'document-graph-node')
            .call(d3.drag<SVGCircleElement, CustomNode>()
                .on('start', this.dragstarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragended.bind(this)));

        this.addHoverFunctionality(node, degrees);
    }

    private renderLabels(nodes: CustomNode[]) {
        this.svg.append('g')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .text(d => d.title)
            .attr('class', 'document-graph-label')
            .attr('dx', 12)
            .attr('dy', '.35em');
    }

    private addHoverFunctionality(node: d3.Selection<SVGCircleElement, CustomNode, SVGGElement, unknown>, degrees: Map<string, number>) {
        node.on('mouseover', (event, d) => {
            this.simulation.alphaTarget(0).stop();
            d3.select(event.currentTarget).transition()
                .duration(200)
                .attr('r', (d: { id: string }) => (degrees.get(d.id)!));

            this.tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            this.tooltip.html(`Title: ${d.title}<br/>ID: ${d.id}<br/>Connections: ${degrees.get(d.id)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on('mouseout', (event, d) => {
            this.simulation.alphaTarget(0.3).restart();
            d3.select(event.currentTarget).transition()
                .duration(200)
                .attr('r', d => (degrees.get((d as any).id)!));

            this.tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    }

    private updatePositions() {
        this.svg.selectAll('line')
            .attr('x1', d => (d as any).source.x!)
            .attr('y1', d => (d as any).source.y!)
            .attr('x2', d => (d as any).target.x!)
            .attr('y2', d => (d as any).target.y!);

        this.svg.selectAll('circle')
            .attr('cx', d => (d as any).x!)
            .attr('cy', d => (d as any).y!);

        this.svg.selectAll('text')
            .attr('x', d => (d as any).x!)
            .attr('y', d => (d as any).y!);
    }

    private dragstarted(event: d3.D3DragEvent<SVGCircleElement, CustomNode, CustomNode>, d: CustomNode) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    private dragged(event: d3.D3DragEvent<SVGCircleElement, CustomNode, CustomNode>, d: CustomNode) {
        d.fx = event.x;
        d.fy = event.y;
    }

    private dragended(event: d3.D3DragEvent<SVGCircleElement, CustomNode, CustomNode>, d: CustomNode) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    public cleanup() {
        this.tooltip.remove();
    }

    private calculateNodeDegrees(nodes: CustomNode[], links: Link[]): Map<string, number> {
        const degrees = new Map<string, number>();
        nodes.forEach(node => degrees.set(node.id, 0));
        links.forEach(link => {
            degrees.set(link.source.id, degrees.get(link.source.id)! + 1);
            degrees.set(link.target.id, degrees.get(link.target.id)! + 1);
        });
        return degrees;
    }
}
