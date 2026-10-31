import { schoolApi, SchoolReadinessItem } from '@/lib/api';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';

export interface GradeColumn {
  label: string;
  gradeNum?: number;
  pattern?: RegExp;
}

export interface JenjangConfig {
  code: string;
  displayName: string;
  title: string;
  classes: GradeColumn[];
}

export const JENJANG_CONFIGS: Record<string, JenjangConfig> = {
  MTS: {
    code: 'MTS',
    displayName: 'MTs',
    title: 'DATA SISWA MTs LP MAARIF NU PCNU CILACAP',
    classes: [
      { label: 'Kls 7', gradeNum: 7 },
      { label: 'Kls 8', gradeNum: 8 },
      { label: 'Kls 9', gradeNum: 9 },
    ],
  },
  MI: {
    code: 'MI',
    displayName: 'MI',
    title: 'DATA SISWA MI LP MAARIF NU PCNU CILACAP',
    classes: [
      { label: 'Kls 1', gradeNum: 1 },
      { label: 'Kls 2', gradeNum: 2 },
      { label: 'Kls 3', gradeNum: 3 },
      { label: 'Kls 4', gradeNum: 4 },
      { label: 'Kls 5', gradeNum: 5 },
      { label: 'Kls 6', gradeNum: 6 },
    ],
  },
  MA: {
    code: 'MA',
    displayName: 'MA',
    title: 'DATA SISWA MA LP MAARIF NU PCNU CILACAP',
    classes: [
      { label: 'Kls 10', gradeNum: 10 },
      { label: 'Kls 11', gradeNum: 11 },
      { label: 'Kls 12', gradeNum: 12 },
    ],
  },
  SMK: {
    code: 'SMK',
    displayName: 'SMK',
    title: 'DATA SISWA SMK LP MAARIF NU PCNU CILACAP',
    classes: [
      { label: 'Kls 10', gradeNum: 10 },
      { label: 'Kls 11', gradeNum: 11 },
      { label: 'Kls 12', gradeNum: 12 },
    ],
  },
  RA: {
    code: 'RA',
    displayName: 'RA',
    title: 'DATA SISWA RA LP MAARIF NU PCNU CILACAP',
    classes: [
      { label: 'Kel. A', pattern: /a\b|kelompok\s*a/i },
      { label: 'Kel. B', pattern: /b\b|kelompok\s*b/i },
    ],
  },
};

/**
 * Returns current academic year format: e.g. "2026-2027"
 */
export function getAcademicYearString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 6 = Jul
  if (month >= 6) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Resolves school jenjang into standardized category code
 */
export function detectSchoolJenjang(school: SchoolReadinessItem): string {
  const jenjang = (school.jenjang || '').toUpperCase().trim();
  const nama = (school.nama || '').toUpperCase().trim();

  if (
    jenjang === 'MTS' ||
    jenjang === 'SMP' ||
    nama.startsWith('MTS ') ||
    nama.includes(' MTS ') ||
    nama.includes('TSANAWIYAH')
  ) {
    return 'MTS';
  }
  if (
    jenjang === 'MI' ||
    jenjang === 'SD' ||
    nama.startsWith('MI ') ||
    nama.includes(' MI ') ||
    nama.includes('IBTIDAIYAH')
  ) {
    return 'MI';
  }
  if (
    jenjang === 'SMK' ||
    nama.startsWith('SMK ') ||
    nama.includes(' SMK ') ||
    nama.includes('KEJURUAN')
  ) {
    return 'SMK';
  }
  if (
    jenjang === 'MA' ||
    jenjang === 'SMA' ||
    nama.startsWith('MA ') ||
    nama.includes(' MA ') ||
    nama.includes('ALIYAH')
  ) {
    return 'MA';
  }
  if (
    jenjang === 'RA' ||
    jenjang === 'TK' ||
    jenjang === 'PAUD' ||
    jenjang === 'BA' ||
    nama.startsWith('RA ') ||
    nama.includes('RAUDHATUL')
  ) {
    return 'RA';
  }

  return 'MTS';
}

/**
 * Extracts student count for a specific class column
 */
/**
 * Extracts student count for a specific class column
 * Priority: manual per-class input first; fallback to detail_students_per_kelas if manual not entered
 */
export function getGradeCount(
  school: SchoolReadinessItem,
  col: GradeColumn
): number {
  let manualPerClass = school.jumlah_siswa_per_kelas;
  if (typeof manualPerClass === 'string') {
    try {
      manualPerClass = JSON.parse(manualPerClass);
    } catch {
      manualPerClass = null;
    }
  }

  // Data terpercaya adalah manual. Jika belum diinput manual, pakai data sebelumnya
  const sources: (Record<string, number> | null | undefined)[] = [
    manualPerClass,
    school.detail_students_per_kelas,
  ];

  const romanMap: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
    7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII',
  };

  for (const map of sources) {
    if (!map || typeof map !== 'object') continue;

    if (col.gradeNum) {
      const g = col.gradeNum;
      const rom = romanMap[g];

      const directKeys = [
        `Kelas ${g}`,
        `Kls ${g}`,
        `Kelas ${rom}`,
        `Kls ${rom}`,
        String(g),
        rom,
      ];

      for (const k of directKeys) {
        if (k && map[k] !== undefined && map[k] !== null) {
          const parsed = Number(map[k]);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }

      // Check section/fuzzy matching: "7A", "7B", "VII-A"
      let sum = 0;
      let matched = false;
      for (const [key, val] of Object.entries(map)) {
        const numVal = Number(val) || 0;
        if (numVal <= 0) continue;
        const cleanKey = key.trim();

        const matchNum = new RegExp(`(^|\\b|Kelas\\s*|Kls\\s*)${g}([A-Za-z]|\\b|\\-|_)`, 'i').test(cleanKey);
        const matchRom = rom && new RegExp(`(^|\\b|Kelas\\s*|Kls\\s*)${rom}([A-Za-z]|\\b|\\-|_)`, 'i').test(cleanKey);

        if (matchNum || matchRom) {
          sum += numVal;
          matched = true;
        }
      }

      if (matched && sum > 0) return sum;
    }

    if (col.pattern) {
      let sum = 0;
      let matched = false;
      for (const [key, val] of Object.entries(map)) {
        const numVal = Number(val) || 0;
        if (numVal <= 0) continue;
        if (col.pattern.test(key)) {
          sum += numVal;
          matched = true;
        }
      }
      if (matched && sum > 0) return sum;
    }
  }

  return 0;
}

export interface SiswaBaruThreeYears {
  years: string[];
  counts: [number, number, number];
}

/**
 * Returns labels for 3 academic years back: e.g. ["2024/2025", "2025/2026", "2026/2027"]
 */
export function getNewStudentYears(academicYearStr: string): string[] {
  const parts = academicYearStr.split(/[-/]/);
  const startYear = parseInt(parts[0], 10) || 2026;
  return [
    `${startYear - 2}/${startYear - 1}`,
    `${startYear - 1}/${startYear}`,
    `${startYear}/${startYear + 1}`,
  ];
}

/**
 * Resolves new student intake for the past 3 academic years.
 * Checks explicit keys first; otherwise maps cohorts from class grades.
 */
export function getSiswaBaruThreeYears(
  school: SchoolReadinessItem,
  config: JenjangConfig,
  academicYear: string,
  classCounts: number[],
  effectiveTotal: number
): SiswaBaruThreeYears {
  const years = getNewStudentYears(academicYear);

  let manualMap = school.jumlah_siswa_per_kelas;
  if (typeof manualMap === 'string') {
    try {
      manualMap = JSON.parse(manualMap);
    } catch {
      manualMap = null;
    }
  }

  const parseExplicit = (keys: string[]): number | null => {
    if (!manualMap || typeof manualMap !== 'object') return null;
    for (const k of keys) {
      if (manualMap[k] !== undefined && manualMap[k] !== null && manualMap[k] !== '') {
        const val = Number(manualMap[k]);
        if (!isNaN(val) && val >= 0) return val;
      }
    }
    return null;
  };

  const expY1 = parseExplicit(['siswa_baru_2024', 'siswa_baru_2024_2025', '2024/2025', '2024-2025', '2024']);
  const expY2 = parseExplicit(['siswa_baru_2025', 'siswa_baru_2025_2026', '2025/2026', '2025-2026', '2025']);
  const expY3 = parseExplicit(['siswa_baru_2026', 'siswa_baru_2026_2027', '2026/2027', '2026-2027', '2026']);

  if (expY1 !== null || expY2 !== null || expY3 !== null) {
    return {
      years,
      counts: [expY1 ?? 0, expY2 ?? 0, expY3 ?? 0],
    };
  }

  // Derive by cohort entry grade:
  // Year 3 (this academic year intake) = Entry class (Kls 7 / Kls 1 / Kls 10 / Kel. A)
  // Year 2 (1 year ago intake) = Second class (Kls 8 / Kls 2 / Kls 11 / Kel. B)
  // Year 1 (2 years ago intake) = Third class (Kls 9 / Kls 3 / Kls 12)
  let y1 = 0;
  let y2 = 0;
  let y3 = 0;

  if (config.code === 'MTS' || config.code === 'MA' || config.code === 'SMK') {
    y3 = classCounts[0] || 0; // Kls 7 / 10
    y2 = classCounts[1] || 0; // Kls 8 / 11
    y1 = classCounts[2] || 0; // Kls 9 / 12
  } else if (config.code === 'MI') {
    y3 = classCounts[0] || 0; // Kls 1
    y2 = classCounts[1] || 0; // Kls 2
    y1 = classCounts[2] || 0; // Kls 3
  } else if (config.code === 'RA') {
    y3 = classCounts[0] || 0; // Kel. A
    y2 = classCounts[1] || 0; // Kel. B
    y1 = classCounts[1] || classCounts[0] || 0;
  } else {
    y3 = classCounts[0] || 0;
    y2 = classCounts[1] || 0;
    y1 = classCounts[2] || 0;
  }

  // Fallback: If no per-class distribution exists but total students is positive
  if (y1 === 0 && y2 === 0 && y3 === 0 && effectiveTotal > 0) {
    const divisor = config.classes.length || 3;
    const est = Math.round(effectiveTotal / divisor);
    y1 = est;
    y2 = est;
    y3 = est;
  }

  return {
    years,
    counts: [y1, y2, y3],
  };
}

/**
 * Builds formatted Excel Worksheet matching official PC LP Ma'arif NU Cilacap standard
 */
function buildJenjangWorksheet(
  config: JenjangConfig,
  schools: SchoolReadinessItem[],
  academicYear: string
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const numClasses = config.classes.length;
  // Columns: NO, Kec, Satpen, Alamat, Status, [classes], Jumlah, [Siswa Baru Y1, Y2, Y3], Kamad, WA
  const totalCols = 11 + numClasses;
  const colJumlah = 5 + numClasses;
  const colSiswaBaruStart = colJumlah + 1;
  const colKamad = colJumlah + 4;
  const colWa = colJumlah + 5;

  const newStudentYears = getNewStudentYears(academicYear);

  // ── Cell Styles ──
  const title1Style = {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const title2Style = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const headerStyle = {
    fill: { fgColor: { rgb: 'D9D9D9' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const dataStyleCenter = {
    font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const dataStyleLeft = {
    font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const totalLabelStyle = {
    fill: { fgColor: { rgb: 'EAEAEA' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'double', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const totalNumStyle = {
    fill: { fgColor: { rgb: 'EAEAEA' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'double', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  function setCell(r: number, c: number, val: any, style: any, type: string = 's') {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws[addr] = { v: val, t: type, s: style };
  }

  // ── Row 1 & 2: Title Block ──
  setCell(0, 0, config.title, title1Style);
  setCell(1, 0, `TAHUN PELAJARAN ${academicYear}`, title2Style);

  // ── Header Rows (Rows 2 & 3, 0-indexed) ──
  // Row 2 (Excel Row 3)
  setCell(2, 0, 'NO', headerStyle);
  setCell(2, 1, 'Kecamatan', headerStyle);
  setCell(2, 2, 'Nama Satuan Pendidikan', headerStyle);
  setCell(2, 3, 'Alamat', headerStyle);
  setCell(2, 4, "Status (\nJam'iyyah/Jamaah)", headerStyle);

  // Jumlah Siswa group header
  setCell(2, 5, 'Jumlah Siswa', headerStyle);
  for (let i = 1; i < numClasses; i++) {
    setCell(2, 5 + i, '', headerStyle);
  }

  setCell(2, colJumlah, 'Jumlah', headerStyle);

  // Jumlah Siswa Baru 3 Tahun Terakhir group header (span 3 cols)
  setCell(2, colSiswaBaruStart, "Jumlah Siswa Baru\n(3 Tahun Terakhir)", headerStyle);
  setCell(2, colSiswaBaruStart + 1, '', headerStyle);
  setCell(2, colSiswaBaruStart + 2, '', headerStyle);

  setCell(2, colKamad, 'Nama Kepala Madrasah', headerStyle);
  setCell(2, colWa, 'Nomor WA Kepala Madrasah', headerStyle);

  // Row 3 (Excel Row 4) - Subheaders
  setCell(3, 0, '', headerStyle);
  setCell(3, 1, '', headerStyle);
  setCell(3, 2, '', headerStyle);
  setCell(3, 3, '', headerStyle);
  setCell(3, 4, '', headerStyle);

  config.classes.forEach((cls, i) => {
    setCell(3, 5 + i, cls.label, headerStyle);
  });

  setCell(3, colJumlah, '', headerStyle);

  // Siswa Baru 3 Tahun Subheaders
  setCell(3, colSiswaBaruStart, newStudentYears[0], headerStyle);
  setCell(3, colSiswaBaruStart + 1, newStudentYears[1], headerStyle);
  setCell(3, colSiswaBaruStart + 2, newStudentYears[2], headerStyle);

  setCell(3, colKamad, '', headerStyle);
  setCell(3, colWa, '', headerStyle);

  const merges: XLSX.Range[] = [
    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }, // NO
    { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }, // Kecamatan
    { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }, // Nama Satpen
    { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } }, // Alamat
    { s: { r: 2, c: 4 }, e: { r: 3, c: 4 } }, // Status
    { s: { r: 2, c: 5 }, e: { r: 2, c: colJumlah - 1 } }, // Jumlah Siswa span
    { s: { r: 2, c: colJumlah }, e: { r: 3, c: colJumlah } }, // Jumlah
    { s: { r: 2, c: colSiswaBaruStart }, e: { r: 2, c: colSiswaBaruStart + 2 } }, // Siswa Baru span 3 cols
    { s: { r: 2, c: colKamad }, e: { r: 3, c: colKamad } }, // Nama Kamad
    { s: { r: 2, c: colWa }, e: { r: 3, c: colWa } }, // WA Kamad
  ];

  // ── Data Rows ──
  const classSums = new Array(numClasses).fill(0);
  const sbYearSums = [0, 0, 0];
  let grandTotalStudents = 0;

  schools.forEach((s, idx) => {
    const r = 4 + idx;

    setCell(r, 0, idx + 1, dataStyleCenter, 'n');
    setCell(r, 1, s.kecamatan || '-', dataStyleLeft);
    setCell(r, 2, s.nama, dataStyleLeft);
    setCell(r, 3, s.alamat || '-', dataStyleLeft);
    setCell(r, 4, s.status_jamiyyah || "Jam'iyyah", dataStyleCenter);

    const counts = config.classes.map((cls) => getGradeCount(s, cls));
    const sumOfClasses = counts.reduce((a, b) => a + b, 0);

    // Data terpercaya adalah manual. Jika belum diinput manual, pakai data sebelumnya
    let effectiveTotal = 0;
    if (s.jumlah_siswa_manual && s.jumlah_siswa_manual > 0) {
      effectiveTotal = s.jumlah_siswa_manual;
    } else if (sumOfClasses > 0) {
      effectiveTotal = sumOfClasses;
    } else if (s.effective_students_count && s.effective_students_count > 0) {
      effectiveTotal = s.effective_students_count;
    } else if (s.students_detail_count && s.students_detail_count > 0) {
      effectiveTotal = s.students_detail_count;
    } else {
      effectiveTotal = 0;
    }

    const sbData = getSiswaBaruThreeYears(s, config, academicYear, counts, effectiveTotal);

    // Fill class counts
    counts.forEach((cVal, cIdx) => {
      classSums[cIdx] += cVal;
      if (sumOfClasses > 0) {
        setCell(r, 5 + cIdx, cVal, dataStyleCenter, 'n');
      } else {
        // If no per-class breakdown was submitted
        setCell(r, 5 + cIdx, '-', dataStyleCenter, 's');
      }
    });

    // Jumlah total
    grandTotalStudents += effectiveTotal;
    setCell(r, colJumlah, effectiveTotal, dataStyleCenter, 'n');

    // Siswa Baru 3 Tahun Terakhir
    sbYearSums[0] += sbData.counts[0];
    sbYearSums[1] += sbData.counts[1];
    sbYearSums[2] += sbData.counts[2];

    setCell(r, colSiswaBaruStart, sbData.counts[0], dataStyleCenter, 'n');
    setCell(r, colSiswaBaruStart + 1, sbData.counts[1], dataStyleCenter, 'n');
    setCell(r, colSiswaBaruStart + 2, sbData.counts[2], dataStyleCenter, 'n');

    // Kepala Madrasah
    setCell(r, colKamad, s.kepala_madrasah || '-', dataStyleLeft);

    // Nomor WA Kepala Madrasah (stored as string to protect leading zeroes)
    const rawPhone = s.kepala_whatsapp || s.telepon || '-';
    setCell(r, colWa, rawPhone, dataStyleCenter, 's');
  });

  // ── Summary / Total Row ──
  const totalRowIdx = 4 + schools.length;
  merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 4 } });

  setCell(totalRowIdx, 0, 'JUMLAH TOTAL', totalLabelStyle);
  for (let c = 1; c <= 4; c++) {
    setCell(totalRowIdx, c, '', totalLabelStyle);
  }

  // Sum for each class
  classSums.forEach((sumVal, cIdx) => {
    setCell(totalRowIdx, 5 + cIdx, sumVal, totalNumStyle, 'n');
  });

  // Grand total active students
  setCell(totalRowIdx, colJumlah, grandTotalStudents, totalNumStyle, 'n');

  // Sums for Siswa Baru 3 Tahun
  setCell(totalRowIdx, colSiswaBaruStart, sbYearSums[0], totalNumStyle, 'n');
  setCell(totalRowIdx, colSiswaBaruStart + 1, sbYearSums[1], totalNumStyle, 'n');
  setCell(totalRowIdx, colSiswaBaruStart + 2, sbYearSums[2], totalNumStyle, 'n');

  // Empty cells for Kamad & WA
  setCell(totalRowIdx, colKamad, '', totalNumStyle);
  setCell(totalRowIdx, colWa, '', totalNumStyle);

  // ── Sheet Dimensions & Metadata ──
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: totalCols - 1 },
  });

  ws['!merges'] = merges;

  ws['!cols'] = [
    { wch: 6 },  // NO
    { wch: 18 }, // Kecamatan
    { wch: 38 }, // Nama
    { wch: 32 }, // Alamat
    { wch: 18 }, // Status
    ...config.classes.map(() => ({ wch: 10 })), // Classes
    { wch: 12 }, // Jumlah
    { wch: 13 }, // Siswa Baru Th 1 (2024/2025)
    { wch: 13 }, // Siswa Baru Th 2 (2025/2026)
    { wch: 13 }, // Siswa Baru Th 3 (2026/2027)
    { wch: 28 }, // Kepala
    { wch: 22 }, // WA
  ];

  const rowsMeta: { hpt: number }[] = [
    { hpt: 22 }, // Row 1
    { hpt: 20 }, // Row 2
    { hpt: 28 }, // Row 3
    { hpt: 24 }, // Row 4
  ];
  for (let i = 0; i < schools.length; i++) {
    rowsMeta.push({ hpt: 20 });
  }
  rowsMeta.push({ hpt: 22 }); // Total row
  ws['!rows'] = rowsMeta;

  return ws;
}

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
    toast.info('Menyiapkan file Excel format rekapitulasi siswa...');

    // Fetch up to 2000 schools matching active filters
    const exportRes = await schoolApi.getDataReadiness({
      search: debouncedSearch || undefined,
      kecamatan: filterKecamatan !== 'all' ? filterKecamatan : undefined,
      jenjang: filterJenjang !== 'all' ? filterJenjang : undefined,
      status: exportType === 'incomplete' ? 'incomplete' : 'all',
      page: 1,
      per_page: 2000,
    });

    let allSchools = exportRes.data || [];

    // Safety fallback: if pagination has multiple pages
    if (exportRes.last_page > 1) {
      for (let p = 2; p <= exportRes.last_page; p++) {
        const nextRes = await schoolApi.getDataReadiness({
          search: debouncedSearch || undefined,
          kecamatan: filterKecamatan !== 'all' ? filterKecamatan : undefined,
          jenjang: filterJenjang !== 'all' ? filterJenjang : undefined,
          status: exportType === 'incomplete' ? 'incomplete' : 'all',
          page: p,
          per_page: 2000,
        });
        if (nextRes.data && nextRes.data.length > 0) {
          allSchools = allSchools.concat(nextRes.data);
        }
      }
    }

    if (allSchools.length === 0) {
      toast.warning('Tidak ada data madrasah yang sesuai untuk diekspor');
      return;
    }

    const academicYear = getAcademicYearString();
    const workbook = XLSX.utils.book_new();

    // If filtered by specific Jenjang
    if (filterJenjang !== 'all') {
      const targetJenjang = filterJenjang.toUpperCase().trim();
      const configKey = Object.keys(JENJANG_CONFIGS).find((k) => k === targetJenjang) || 'MTS';
      const config = JENJANG_CONFIGS[configKey];

      const worksheet = buildJenjangWorksheet(config, allSchools, academicYear);
      XLSX.utils.book_append_sheet(workbook, worksheet, config.displayName);
    } else {
      // Group by Jenjang: MTs, MI, MA, SMK, RA
      const grouped: Record<string, SchoolReadinessItem[]> = {
        MTS: [],
        MI: [],
        MA: [],
        SMK: [],
        RA: [],
      };

      allSchools.forEach((s) => {
        const detected = detectSchoolJenjang(s);
        if (grouped[detected]) {
          grouped[detected].push(s);
        } else {
          grouped.MTS.push(s);
        }
      });

      // Priority order for sheets: MTs first (as requested), then MI, MA, SMK, RA
      const sheetOrder = ['MTS', 'MI', 'MA', 'SMK', 'RA'];
      let addedSheetCount = 0;

      sheetOrder.forEach((code) => {
        const config = JENJANG_CONFIGS[code];
        const schoolsInGroup = grouped[code] || [];
        if (schoolsInGroup.length > 0 || allSchools.length > 0) {
          const worksheet = buildJenjangWorksheet(config, schoolsInGroup, academicYear);
          XLSX.utils.book_append_sheet(workbook, worksheet, config.displayName);
          addedSheetCount++;
        }
      });

      // Fallback if none added
      if (addedSheetCount === 0) {
        const worksheet = buildJenjangWorksheet(JENJANG_CONFIGS.MTS, allSchools, academicYear);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
      }
    }

    const jenjangPart = filterJenjang !== 'all' ? `_${filterJenjang.toUpperCase()}` : '';
    const statusPart = exportType === 'incomplete' ? '_Belum_Lengkap' : '';
    const filename = `DATA_SISWA${jenjangPart}${statusPart}_LP_MAARIF_CILACAP_${academicYear}.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success('File Excel data jumlah siswa berhasil diunduh!');
  } catch (err: any) {
    console.error('Failed to export readiness to excel:', err);
    toast.error('Gagal mengekspor data: ' + (err.message || 'Terjadi kesalahan'));
  }
}
