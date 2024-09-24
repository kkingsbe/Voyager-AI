import axios from "axios";

export interface SearchResult {
    score: number;
    title: string;
    document: string;
}

export class ApiClient {
    apiKey: string;
    private baseUrl: string = 'http://localhost:3000';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async embedDocument(title: string, content: string, id: string) {
        console.log("Embedding document", title, content, id);
        const res = await axios.post(this.baseUrl + "/user/index-document",
            {
                title,
                content,
                id,
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
}