var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
let GeminiService = class GeminiService {
    configService;
    apiKey;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = 'AIzaSy_REDACTED_HISTORICAL_API_KEY_SIMMACI';
        if (!this.apiKey) {
            console.warn('[GeminiService] GEMINI_API_KEY not found. AI features will be disabled.');
        }
        else {
            console.log('[GeminiService] Initialized successfully (HTTP API mode)');
        }
    }
    async generateSQL(params) {
        if (!this.apiKey)
            throw new Error('Gemini API not configured');
        const prompt = `
You are a PostgreSQL expert for an educational management system (SIM Maarif).

Database Schema:
${params.schema}

Example Queries:
${params.examples}

User Question: "${params.question}"

Generate a safe, read-only SQL query (SELECT only, no INSERT/UPDATE/DELETE).
Return ONLY the SQL query without explanation or markdown formatting.
`;
        try {
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
            });
            const text = response.data.candidates[0]?.content?.parts[0]?.text || '';
            let sql = text.trim();
            sql = sql
                .replace(/```sql\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            return sql;
        }
        catch (error) {
            console.error('[GeminiService] Error generating SQL:', error.message);
            throw error;
        }
    }
    async formatResponse(params) {
        if (!this.apiKey)
            throw new Error('Gemini API not configured');
        const dataPreview = params.queryResults.slice(0, 10);
        const hasMore = params.queryResults.length > 10;
        const prompt = `
Context: SIM Maarif (Islamic School Management System)

User asked: "${params.question}"

Query returned ${params.queryResults.length} results:
${JSON.stringify(dataPreview, null, 2)}
${hasMore ? `... and ${params.queryResults.length - 10} more results` : ''}

Generate a natural, helpful response in Indonesian.
Be concise, informative, and friendly.
If there are many results, summarize the key patterns and provide a few examples.
`;
        try {
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
            });
            return response.data.candidates[0]?.content?.parts[0]?.text || '';
        }
        catch (error) {
            console.error('[GeminiService] Error formatting response:', error.message);
            throw error;
        }
    }
};
GeminiService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [ConfigService])
], GeminiService);
export { GeminiService };
//# sourceMappingURL=gemini.service.js.map