export declare class CreateEventDto {
    name: string;
    category: string;
    type: string;
    date?: string;
    location?: string;
    status?: string;
    description?: string;
}
export declare class UpdateEventDto extends CreateEventDto {
}
