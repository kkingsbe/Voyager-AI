import * as d3 from 'd3';

export interface Document {
    id: string;
    title: string;
}

export interface ApiLink {
    source: string;
    target: string;
    similarity: number;
}

export interface DocumentGraphResponse {
    documents: Document[];
    links: ApiLink[];
}

export interface Link {
    source: CustomNode;
    target: CustomNode;
    similarity: number;
}

export interface CustomNode extends d3.SimulationNodeDatum {
    id: string;
    title: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}