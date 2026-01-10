import { Repository } from 'typeorm';
import { Student } from '../master-data/entities/student.entity';
export declare class EmisService {
    private readonly studentRepo;
    constructor(studentRepo: Repository<Student>);
    importStudents(data: any[], user: any): Promise<{
        count: number;
    }>;
}
