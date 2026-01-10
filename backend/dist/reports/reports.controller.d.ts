import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    getTeacherSummary(unitKerja?: string, kecamatan?: string): Promise<any>;
    getSKSummary(unitKerja?: string, startDate?: string, endDate?: string): Promise<any>;
    getMonthlyStats(year?: string): Promise<any>;
}
