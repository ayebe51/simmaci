interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}
export declare class EmailService {
    private transporter;
    constructor();
    sendEmail(options: EmailOptions): Promise<boolean>;
    sendSKApprovalNotification(approverEmail: string, approverName: string, skData: {
        number: string;
        type: string;
        teacherName: string;
        submittedBy: string;
    }): Promise<boolean>;
    sendSKStatusNotification(submitterEmail: string, submitterName: string, skData: {
        number: string;
        type: string;
        status: 'approved' | 'rejected';
        approverName: string;
        notes?: string;
    }): Promise<boolean>;
}
export {};
