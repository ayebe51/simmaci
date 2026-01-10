import { Repository } from 'typeorm';
import { HeadmasterTenure } from './entities/headmaster-tenure.entity';
import { User } from '../users/entities/user.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
export declare class HeadmasterService {
    private repo;
    private teacherRepo;
    constructor(repo: Repository<HeadmasterTenure>, teacherRepo: Repository<Teacher>);
    create(data: Partial<HeadmasterTenure>, _user: User): Promise<any>;
    findAll(): Promise<HeadmasterTenure[]>;
    findOne(id: string): Promise<any>;
    verify(id: string): Promise<any>;
    approve(id: string, signatureUrl?: string, skUrl?: string): Promise<any>;
    reject(id: string, reason: string): Promise<any>;
    verifyPublic(id: string): Promise<any>;
}
