import { Teacher } from '../../master-data/entities/teacher.entity';
import { School } from '../../master-data/entities/school.entity';
export declare enum HeadmasterStatus {
    DRAFT = "Draft",
    SUBMITTED = "Submitted",
    VERIFIED = "Verified",
    APPROVED = "Approved",
    REJECTED = "Rejected",
    ACTIVE = "Active",
    EXPIRED = "Expired"
}
export declare class HeadmasterTenure {
    id: string;
    teacher: Teacher;
    teacherId: string;
    school: School;
    schoolId: string;
    periode: number;
    skNumber: string;
    tmt: Date;
    endDate: Date;
    status: HeadmasterStatus;
    documents: {
        fitAndProper?: string;
        performanceReview?: string;
        recommendation?: string;
    };
    keterangan: string;
    suratPermohonanUrl: string;
    suratPermohonanNumber: string;
    suratPermohonanDate: Date;
    digitalSignatureUrl: string;
    skUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
