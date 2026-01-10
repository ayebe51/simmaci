import { DataSource } from 'typeorm';
import { GeminiService } from './gemini.service';
export declare class RagService {
    private geminiService;
    private dataSource;
    constructor(geminiService: GeminiService, dataSource: DataSource);
    query(userQuestion: string): Promise<{
        answer: string;
        sql: string;
        resultCount: number;
        data: any[];
    }>;
    private isValidSQL;
    private getSchemaContext;
    private getSQLExamples;
}
