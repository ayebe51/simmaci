import { User } from '../../users/entities/user.entity';
export declare class Sk {
    id: string;
    jenis: string;
    jenisPengajuan: string;
    nomorSurat: string;
    nama: string;
    niy: string;
    jabatan: string;
    unitKerja: string;
    keterangan: string;
    status: string;
    fileUrl: string;
    suratPermohonanUrl: string;
    user: User;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}
