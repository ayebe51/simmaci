import { EmisService } from './emis.service';
export declare class EmisController {
    private readonly emisService;
    constructor(emisService: EmisService);
    import(data: any[], req: any): Promise<any>;
}
