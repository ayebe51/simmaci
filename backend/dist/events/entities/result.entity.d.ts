import { Competition } from './competition.entity';
import { Participant } from './participant.entity';
export declare class Result {
    id: string;
    competitionId: string;
    competition: Competition;
    participantId: string;
    participant: Participant;
    score?: number;
    rank?: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
