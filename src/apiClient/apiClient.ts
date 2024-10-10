import axios from "axios";
import { DocumentGraphResponse } from '../modals/documentGraphModal/types';
import io from 'socket.io-client';

export interface SearchResult {
    score: number;
    title: string;
    document: string;
    id: string;
}

export class ApiClient {
    apiKey: string;
    private baseUrl: string = 'https://voyager-backend.onrender.com';
    // private baseUrl: string = 'http://localhost:3000';

    constructor(apiKey: string) {
        this.apiKey = apiKey;

        console.log("Api client with api key:", this.apiKey);
    }

    async embedDocument(title: string, content: string, id: string, creationDate: string) {
        // console.log("Embedding document", title, content, id);
        const res = await axios.post(this.baseUrl + "/user/index-document",
            {
                title,
                content,
                id,
                creationDate,
                apiKey: this.apiKey
            }
        )

        return res.data;
    }

    async search(query: string, limit: number): Promise<SearchResult[]> {
        const res = await axios.get(this.baseUrl + "/search/contextual-search", {
            params: {
                query,
                api_key: this.apiKey,
                limit
            }
        });

        return res.data;
    }

    async enhancedSearch(query: string, limit: number): Promise<SearchResult[]> {
        const res = await axios.get(this.baseUrl + "/search/enhanced-contextual-search", {
            params: {
                query,
                api_key: this.apiKey,
                limit
            }
        });

        return res.data;
    }

    async generateBlurb(query: string, title: string, content: string) {
        const res = await axios.post(this.baseUrl + "/search/generate-blurb", {
            query,
            title,
            document: content,
            api_key: this.apiKey
        });

        return res.data;
    }

    async chatWebSocket(query: string, onChunk: (chunk: string) => void, onComplete: () => void, currentDocumentId?: string) {
        const socket = io(this.baseUrl);

        console.log("Initializing websocket connection with base url:", this.baseUrl);

        socket.on('connect', () => {
            console.log('Connected to WebSocket');
            socket.emit('chat', {
                api_key: this.apiKey,
                message: query,
                current_document_id: currentDocumentId || null
            });
        });

        socket.on('chatResponse', (chunk: string) => {
            onChunk(chunk);
        });

        socket.on('chatComplete', () => {
            onComplete();
            socket.disconnect();
        });

        socket.on('error', (error: string) => {
            console.error('WebSocket error:', error);
            socket.disconnect();
        });
    }

    async chat(query: string, currentDocumentId?: string) {
        const res = await axios.post(this.baseUrl + "/search/chat", {
            query,
            api_key: this.apiKey,
            current_document_id: currentDocumentId || null
        });

        return res.data;
    }

    async getIndexedDocuments() {
        const res = await axios.get(this.baseUrl + "/user/documents", {
            params: {
                api_key: this.apiKey
            }
        });

        return res.data;
    }

    async deleteDocument(documentId: string) {
        const res = await axios.delete(this.baseUrl + "/user/document", {
            params: {
                api_key: this.apiKey,
                document_id: documentId
            }
        });

        return res.data;
    }

    async getDocumentGraph(documentId: string): Promise<DocumentGraphResponse> {
        const res = await axios.get<DocumentGraphResponse>(this.baseUrl + "/user/document-graph", {
            params: {
                api_key: this.apiKey,
                document_id: documentId
            }
        });

        return res.data;
    }

    async getSimilarDocuments(documentId: string): Promise<SearchResult[]> {
        const res = await axios.get<SearchResult[]>(this.baseUrl + "/search/similar-documents", {
            params: {
                api_key: this.apiKey,
                document_id: documentId
            }
        });

        return res.data;
    }

    async getSimilarDocumentsWithWindow(documentId: string, content: string): Promise<SearchResult[]> {
        const res = await axios.post<SearchResult[]>(this.baseUrl + "/search/similar-documents-with-window", {
            document_id: documentId,
            content,
            api_key: this.apiKey
        });

        console.log("Similar documents with window:", res.data);

        return res.data;
    }
}