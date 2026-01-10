import { SkService } from './sk.service';
import { Sk } from './entities/sk.entity';
export declare class SkController {
    private readonly skService;
    constructor(skService: SkService);
    create(data: Partial<Sk>, req: any): any;
    findAll(req: any): any;
    findOne(id: string): any;
    update(id: string, data: Partial<Sk>): any;
    deleteAll(): any;
}
export declare class SkPublicController {
    private readonly skService;
    constructor(skService: SkService);
    verifyPublic(id: string): Promise<any>;
}
