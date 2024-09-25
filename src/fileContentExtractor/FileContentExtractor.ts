import { App, TFile } from "obsidian";

export class FileContentExtractor {
    private static pdfjs: any;

    static async extractContentFromDocument(app: App, file: TFile): Promise<string> {
        const rawContent = await app.vault.read(file);
        const binaryContent = await app.vault.readBinary(file);

        switch (file.extension) {
            case 'pdf':
                return await this.extractContentFromPDF(binaryContent);
            case 'md':
                return rawContent;
            default:
                return '';
        }
    }

    private static async loadPDFJS(): Promise<void> {
        if (!this.pdfjs) {
            // Load pdf.js dynamically
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.min.js';
            document.head.appendChild(script);

            await new Promise<void>((resolve) => {
                script.onload = () => {
                    // Set up worker source
                    const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';
                    this.pdfjs = pdfjsLib;
                    resolve();
                };
            });
        }
    }

    private static async extractContentFromPDF(binaryContent: ArrayBuffer): Promise<string> {
        await this.loadPDFJS();

        const loadingTask = this.pdfjs.getDocument({ data: binaryContent });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    }
}