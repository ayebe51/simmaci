import { RagService } from './services/rag.service';
declare class AiQueryDto {
    question: string;
}
export declare class AiController {
    private ragService;
    constructor(ragService: RagService);
    naturalLanguageQuery(dto: AiQueryDto): Promise<any>;
    getSuggestedQuestions(): {
        questions: string[];
    };
}
export {};
