import { schoolApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export async function exportReadinessToExcel({
  exportType,
  debouncedSearch,
  filterKecamatan,
  filterJenjang,
}: {
  exportType: 'incomplete' | 'all';
  debouncedSearch?: string;
  filterKecamatan: string;
  filterJenjang: string;
}) {
  try {
    toast.info('Menyiapkan file Excel...');

    const exportRes = await schoolApi.getDataReadiness({
      search: debouncedSearch || undefined,
      kecamatan: filterKecamatan !== 'all' ? filterKecamatan : undefined,
      jenjang: filterJenjang !== 'all' ? filterJenjang : undefined,
      status: exportType === 'incomplete' ? 'incomplete' : 'all',
      page: 1,
      per_page: 500,
    });

    const list = exportRes.data || [];
    if (list.length === 0) {
      toast.warning('Tidak ada data madrasah yang sesuai untuk diekspor');
      return;
    }

    const rows = list.map((s, idx) => {
      let statusLabel = 'Lengkap';
      if (s.completeness_status === 'empty') statusLabel = 'Kosong (Guru & Siswa 0)';
      else if (s.completeness_status === 'teachers_only') statusLabel = 'Kurang Siswa';
      else if (s.completeness_status === 'students_only') statusLabel = 'Kurang Guru';

      let siswaKeterangan = `${s.effective_students_count} Siswa`;
      if (s.student_source === 'detail') siswaKeterangan += ' (Rinci EMIS/Input)';
      else if (s.student_source === 'manual') siswaKeterangan += ' (Estimasi Manual)';
      else siswaKeterangan = '0 (Belum Diinput)';

      return {
        No: idx + 1,
        'Kecamatan': s.kecamatan || '-',
        'Nama Satpen': s.nama,
        'Jenjang': s.jenjang || '-',
        'NSM': s.nsm || '-',
        'NPSN': s.npsn || '-',
        'Status Kelengkapan': statusLabel,
        'Jumlah Guru': s.teachers_count,
        'Data Siswa': siswaKeterangan,
        'Kepala Madrasah': s.kepala_madrasah || '-',
        'No. WhatsApp / HP': s.kepala_whatsapp || s.telepon || '-',
        'Alamat': s.alamat || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 38 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 26 },
      { wch: 14 },
      { wch: 28 },
      { wch: 26 },
      { wch: 18 },
      { wch: 35 },
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = exportType === 'incomplete' ? 'Madrasah Belum Lengkap' : 'Semua Satpen';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename =
      exportType === 'incomplete'
        ? `Monitoring_Madrasah_Belum_Lengkap_Maarif_Cilacap_${dateStr}.xlsx`
        : `Monitoring_Kelengkapan_Data_Maarif_Cilacap_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success('File Excel berhasil diunduh!');
  } catch (err: any) {
    console.error(err);
    toast.error('Gagal mengekspor data: ' + (err.message || 'Terjadi kesalahan'));
  }
}
