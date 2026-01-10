import { Event } from './event.entity';
import { Participant } from './participant.entity';
import { Result } from './result.entity';
export declare class Competition {
    id: string;
    eventId: string;
    event: Event;
    name: string;
    category: string;
    type: string;
    certificateTemplate: string;
    date: Date;
    location: string;
    participants: Participant[];
    results: Result[];
    createdAt: Date;
    updatedAt: Date;
}
