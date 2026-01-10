import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GeminiService } from './gemini.service';

@Injectable()
export class RagService {
  constructor(
    private geminiService: GeminiService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async query(userQuestion: string): Promise<{
    answer: string;
    sql: string;
    resultCount: number;
    data: any[];
  }> {
    // 1. Get database schema
    const schema = this.getSchemaContext();
    const examples = this.getSQLExamples();

    // 2. Generate SQL
    const sql = await this.geminiService.generateSQL({
      question: userQuestion,
      schema,
      examples,
    });

    console.log('[RAG] Generated SQL:', sql);

    // 3. Validate SQL (basic safety check)
    if (!this.isValidSQL(sql)) {
      throw new Error('Generated SQL is not safe or valid');
    }

    // 4. Execute query
    const results = await this.dataSource.query(sql);

    // 5. Format response
    const answer = await this.geminiService.formatResponse({
      question: userQuestion,
      queryResults: results,
    });

    return {
      answer,
      sql,
      resultCount: results.length,
      data: results.slice(0, 20), // Limit to 20 results for frontend
    };
  }

  private isValidSQL(sql: string): boolean {
    const upperSQL = sql.toUpperCase().trim();

    // Must start with SELECT
    if (!upperSQL.startsWith('SELECT')) {
      return false;
    }

    // No dangerous keywords
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'INSERT',
      'UPDATE',
      'ALTER',
      'CREATE',
      'TRUNCATE',
      'EXEC',
      'EXECUTE',
    ];

    for (const keyword of dangerousKeywords) {
      if (upperSQL.includes(keyword)) {
        return false;
      }
    }

    return true;
  }

  private getSchemaContext(): string {
    return `
Database Schema for SIM Maarif:

Table: teacher
- id (uuid, primary key)
- nama (varchar) - nama lengkap guru
- nuptk (varchar) - nomor unik pendidik dan tenaga kependidikan
- status (varchar) - status kepegawaian: 'PNS', 'Sertifikasi', 'Honorer'
- satminkal (varchar) - satuan/unit kerja (nama sekolah)
- kecamatan (varchar) - kecamatan lokasi tugas
- jabatan (varchar) - jabatan: 'Guru', 'Kepala Madrasah'
- "isCertified" (boolean) - sudah sertifikasi atau belum

Table: sk (Surat Keputusan)
- id (uuid)
- jenis (varchar) - jenis SK, contoh: 'SK Pengangkatan Kepala Madrasah'
- nama (varchar) - nama penerima SK
- niy (varchar) - nomor induk yayasan
- status (varchar) - status: 'Draft', 'Submitted', 'Approved', 'Rejected'
- "nomorSurat" (varchar) - nomor surat SK
- "unitKerja" (varchar) - unit kerja
- "createdAt" (timestamp) - tanggal pengajuan

Table: headmaster_tenure (Masa Jabatan Kepala Madrasah)
- id (uuid)
- "teacherId" (uuid, foreign key → teacher.id)
- "schoolId" (uuid)
- tmt (date) - tanggal mulai tugas
- "endDate" (date) - tanggal akhir jabatan (4 tahun dari TMT)
- status (varchar) - 'SUBMITTED', 'APPROVED', 'REJECTED'
- periode (integer) - periode ke berapa (1, 2, atau 3)

Table: school
- id (uuid)
- nama (varchar) - nama sekolah/madrasah
- npsn (varchar) - nomor pokok sekolah nasional
- kecamatan (varchar)
`;
  }

  private getSQLExamples(): string {
    return `
Example Natural Language → SQL:

Q: "Berapa jumlah guru yang belum sertifikasi?"
SQL: SELECT COUNT(*) as jumlah FROM teacher WHERE "isCertified" = false

Q: "Tampilkan SK yang menunggu approval"
SQL: SELECT * FROM sk WHERE status = 'Submitted' ORDER BY "createdAt" DESC LIMIT 20

Q: "Siapa saja kepala madrasah yang masa jabatannya akan habis tahun ini?"
SQL: SELECT t.nama, s.nama as sekolah, ht."endDate" 
     FROM headmaster_tenure ht
     JOIN teacher t ON ht."teacherId" = t.id
     JOIN school s ON ht."schoolId" = s.id
     WHERE EXTRACT(YEAR FROM ht."endDate") = EXTRACT(YEAR FROM CURRENT_DATE)
     AND ht.status = 'APPROVED'

Q: "Guru honorer di kecamatan Cilacap"
SQL: SELECT nama, satminkal, kecamatan 
     FROM teacher 
     WHERE status = 'Honorer' AND kecamatan ILIKE '%cilacap%'

Q: "Berapa SK yang diajukan bulan ini?"
SQL: SELECT COUNT(*) as jumlah FROM sk 
     WHERE EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM CURRENT_DATE)
     AND EXTRACT(YEAR FROM "createdAt") = EXTRACT(YEAR FROM CURRENT_DATE)
`;
  }
}
