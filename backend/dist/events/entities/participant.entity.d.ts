import { Competition } from './competition.entity';
export declare class Participant {
    id: string;
    competitionId: string;
    competition: Competition;
    name: string;
    institution: string;
    contact: string;
    createdAt: Date;
    updatedAt: Date;
}
