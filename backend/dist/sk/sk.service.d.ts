import { Repository } from 'typeorm';
import { Sk } from './entities/sk.entity';
import { User } from '../users/entities/user.entity';
export declare class SkService {
    private readonly skRepo;
    constructor(skRepo: Repository<Sk>);
    create(data: Partial<Sk>, user: User): Promise<Sk>;
    findAll(user: User): Promise<Sk[]>;
    findOne(id: string): Promise<Sk | null>;
    deleteAll(): Promise<void>;
    update(id: string, data: Partial<Sk>): Promise<Sk>;
    verifyPublic(id: string): Promise<{
        id: any;
        skNumber: any;
        status: any;
        teacher: {
            nama: any;
            nuptk: any;
        };
        jenis: any;
        unitKerja: any;
        createdAt: any;
    } | null>;
}
