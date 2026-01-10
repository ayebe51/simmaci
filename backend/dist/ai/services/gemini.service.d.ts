import { ConfigService } from '@nestjs/config';
export declare class GeminiService {
    private configService;
    private apiKey;
    constructor(configService: ConfigService);
    generateSQL(params: {
        question: string;
        schema: string;
        examples: string;
    }): Promise<string>;
    formatResponse(params: {
        question: string;
        queryResults: any[];
    }): Promise<string>;
}
