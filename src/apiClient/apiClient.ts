import axios from "axios";
import { DocumentGraphResponse } from '../modals/documentGraphModal/types';

export interface SearchResult {
    score: number;
    title: string;
    document: string;
}

export class ApiClient {
    apiKey: string;
    // private baseUrl: string = 'https://voyager-backend.onrender.com';
    private baseUrl: string = 'http://localhost:3000';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async embedDocument(title: string, content: string, id: string, creationDate: string) {
        console.log("Embedding document", title, content, id);
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
}