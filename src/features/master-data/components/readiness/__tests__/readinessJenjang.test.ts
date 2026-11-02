import { describe, it, expect } from 'vitest';
import {
  resolveSchoolJenjang,
  getGradeLevelsForSchool,
  FORMAL_GRADE_LEVELS,
} from '../readinessConstants';
import {
  detectSchoolJenjang,
  JENJANG_CONFIGS,
  sortSchoolsByKecamatanAndName,
} from '../readinessExport';

describe('Jenjang Unification & Resolution Unit Tests', () => {
  it('correctly handles MTs Plus Al Jawami Tritih Kulon without falsely matching MI', () => {
    // Edge case: "Al Jawami" ends in "mi ", which previously caused false match with MI
    const schoolName = 'MTs Plus Al Jawami Tritih Kulon';
    const tier = resolveSchoolJenjang(null, schoolName);
    expect(tier).toBe('MTs / SMP');

    const gradeLevels = getGradeLevelsForSchool(null, schoolName);
    expect(gradeLevels).toEqual(['Kelas 7', 'Kelas 8', 'Kelas 9']);
    expect(gradeLevels?.length).toBe(3);

    const exportJenjang = detectSchoolJenjang({ nama: schoolName, id: 1, teachers_count: 0, effective_students_count: 0 } as any);
    expect(exportJenjang).toBe('MTS');
  });

  it('correctly identifies MTs and SMP as unified tier with 3 classes', () => {
    expect(resolveSchoolJenjang('MTS', 'MTs Ma\'arif')).toBe('MTs / SMP');
    expect(resolveSchoolJenjang('SMP', 'SMP Ma\'arif 1')).toBe('MTs / SMP');
    expect(resolveSchoolJenjang(null, 'SMP Islam Terpadu')).toBe('MTs / SMP');

    expect(getGradeLevelsForSchool('MTS')).toEqual(['Kelas 7', 'Kelas 8', 'Kelas 9']);
    expect(getGradeLevelsForSchool('SMP')).toEqual(['Kelas 7', 'Kelas 8', 'Kelas 9']);
  });

  it('correctly identifies MA, SMK, and SMA as unified tier with 3 classes', () => {
    expect(resolveSchoolJenjang('MA', 'MA Ma\'arif')).toBe('MA / SMK / SMA');
    expect(resolveSchoolJenjang('SMK', 'SMK Ma\'arif 1 Kroya')).toBe('MA / SMK / SMA');
    expect(resolveSchoolJenjang('SMA', 'SMA Ma\'arif')).toBe('MA / SMK / SMA');
    expect(resolveSchoolJenjang(null, 'SMK Diponegoro')).toBe('MA / SMK / SMA');
    expect(resolveSchoolJenjang(null, 'MA Al Huda')).toBe('MA / SMK / SMA');

    expect(getGradeLevelsForSchool('MA')).toEqual(['Kelas 10', 'Kelas 11', 'Kelas 12']);
    expect(getGradeLevelsForSchool('SMK')).toEqual(['Kelas 10', 'Kelas 11', 'Kelas 12']);
    expect(getGradeLevelsForSchool('SMA')).toEqual(['Kelas 10', 'Kelas 11', 'Kelas 12']);
  });

  it('correctly identifies MI and SD as unified tier with 6 classes', () => {
    expect(resolveSchoolJenjang('MI', 'MI Ma\'arif NU 01')).toBe('MI / SD');
    expect(resolveSchoolJenjang('SD', 'SD Islam Nusantara')).toBe('MI / SD');
    expect(resolveSchoolJenjang(null, 'MI Ma\'arif NU')).toBe('MI / SD');

    expect(getGradeLevelsForSchool('MI')).toEqual([
      'Kelas 1',
      'Kelas 2',
      'Kelas 3',
      'Kelas 4',
      'Kelas 5',
      'Kelas 6',
    ]);
  });

  it('correctly excludes RA / TK / PAUD from formal grade levels', () => {
    expect(resolveSchoolJenjang('RA', 'RA Masyithoh 01')).toBe('RA / TK');
    expect(resolveSchoolJenjang('TK', 'TK Muslimat')).toBe('RA / TK');
    expect(getGradeLevelsForSchool('RA')).toBeNull();
  });

  it('correctly tests real-world edge cases with Ma\'arif in the school name', () => {
    // School with "MA" and "Ma'arif"
    expect(resolveSchoolJenjang(null, 'MA Ma\'arif 1 Cilacap')).toBe('MA / SMK / SMA');
    expect(getGradeLevelsForSchool(null, 'MA Ma\'arif 1 Cilacap')).toEqual(['Kelas 10', 'Kelas 11', 'Kelas 12']);

    // School with "SMK" and "Ma'arif"
    expect(resolveSchoolJenjang(null, 'SMK Ma\'arif 1 Kroya')).toBe('MA / SMK / SMA');
    expect(getGradeLevelsForSchool(null, 'SMK Ma\'arif 1 Kroya')).toEqual(['Kelas 10', 'Kelas 11', 'Kelas 12']);

    // School with "SMP" and "Ma'arif"
    expect(resolveSchoolJenjang(null, 'SMP Ma\'arif 1 Cilacap')).toBe('MTs / SMP');
    expect(getGradeLevelsForSchool(null, 'SMP Ma\'arif 1 Cilacap')).toEqual(['Kelas 7', 'Kelas 8', 'Kelas 9']);

    // School with "MI" and "Ma'arif"
    expect(resolveSchoolJenjang(null, 'MI Ma\'arif NU 01 Tritih Kulon')).toBe('MI / SD');
    expect(getGradeLevelsForSchool(null, 'MI Ma\'arif NU 01 Tritih Kulon')?.length).toBe(6);

    // School with "MTs" and "Al Jawami"
    expect(resolveSchoolJenjang(null, 'MTs Plus Al Jawami Tritih Kulon')).toBe('MTs / SMP');
    expect(getGradeLevelsForSchool(null, 'MTs Plus Al Jawami Tritih Kulon')).toEqual(['Kelas 7', 'Kelas 8', 'Kelas 9']);
  });

  it('provides unified Excel export sheet configs', () => {
    expect(JENJANG_CONFIGS.MTS.displayName).toBe('MTs - SMP');
    expect(JENJANG_CONFIGS.MI.displayName).toBe('MI - SD');
    expect(JENJANG_CONFIGS.MA.displayName).toBe('MA - SMK - SMA');
  });

  it('correctly groups and sorts schools by kecamatan then by school name', () => {
    const rawSchools = [
      { id: 1, nama: 'MI Al Falaah 01 Tritih Wetan', kecamatan: 'Jeruklegi' },
      { id: 2, nama: 'MI Al Falah Bulaksari', kecamatan: 'Bantarsari' },
      { id: 3, nama: 'MI Al Hasan Mulyadadi', kecamatan: 'Cipari' },
      { id: 4, nama: 'MI Al Hassan Pasirgaru Bojongsari', kecamatan: 'Kedungreja' },
      { id: 5, nama: 'MI Al Hidayah Kamulyan', kecamatan: 'Bantarsari' },
      { id: 6, nama: 'MI Al Hidayah Mulyadadi', kecamatan: 'Cipari' },
      { id: 7, nama: 'MI Al Hidayah Sidasari', kecamatan: 'Cipari' },
      { id: 8, nama: 'MI Al Ihya Mulyadadi', kecamatan: 'Majenang' },
      { id: 9, nama: 'MI Al Kholidiyah', kecamatan: 'Binangun' },
      { id: 10, nama: 'MI Al Ma\'arif 01 Bumireja', kecamatan: 'Kedungreja' },
    ] as any[];

    const sorted = sortSchoolsByKecamatanAndName(rawSchools);

    // Grouped by Kecamatan A-Z:
    // 1 & 2: Bantarsari
    expect(sorted[0].kecamatan).toBe('Bantarsari');
    expect(sorted[0].nama).toBe('MI Al Falah Bulaksari');
    expect(sorted[1].kecamatan).toBe('Bantarsari');
    expect(sorted[1].nama).toBe('MI Al Hidayah Kamulyan');

    // 3: Binangun
    expect(sorted[2].kecamatan).toBe('Binangun');
    expect(sorted[2].nama).toBe('MI Al Kholidiyah');

    // 4, 5, 6: Cipari
    expect(sorted[3].kecamatan).toBe('Cipari');
    expect(sorted[3].nama).toBe('MI Al Hasan Mulyadadi');
    expect(sorted[4].kecamatan).toBe('Cipari');
    expect(sorted[4].nama).toBe('MI Al Hidayah Mulyadadi');
    expect(sorted[5].kecamatan).toBe('Cipari');
    expect(sorted[5].nama).toBe('MI Al Hidayah Sidasari');

    // 7: Jeruklegi
    expect(sorted[6].kecamatan).toBe('Jeruklegi');
    expect(sorted[6].nama).toBe('MI Al Falaah 01 Tritih Wetan');

    // 8 & 9: Kedungreja
    expect(sorted[7].kecamatan).toBe('Kedungreja');
    expect(sorted[7].nama).toBe('MI Al Hassan Pasirgaru Bojongsari');
    expect(sorted[8].kecamatan).toBe('Kedungreja');
    expect(sorted[8].nama).toBe('MI Al Ma\'arif 01 Bumireja');

    // 10: Majenang
    expect(sorted[9].kecamatan).toBe('Majenang');
    expect(sorted[9].nama).toBe('MI Al Ihya Mulyadadi');
  });
});

