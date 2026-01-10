import { Competition } from './competition.entity';
export declare class Event {
    id: string;
    name: string;
    category: string;
    type: string;
    date: Date;
    location: string;
    status: string;
    description: string;
    competitions: Competition[];
    createdAt: Date;
    updatedAt: Date;
}
