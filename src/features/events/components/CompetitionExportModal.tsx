import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Printer, Trophy, Download, CheckCircle2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface CompetitionExportModalProps {
  competition: any;
  participants: any[];
  filterJenjang?: string;
  trigger?: React.ReactNode;
}

export default function CompetitionExportModal({
  competition,
  participants = [],
  filterJenjang = 'all',
  trigger,
}: CompetitionExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewScope, setViewScope] = useState<'winners' | 'all'>('winners');

  // Clean jury name helper
  const cleanJuryName = (name: string): string => {
    if (!name) return '';
    let cleaned = name.trim();
    // Strip accidental brackets or characters like [LMuji -> Muji
    cleaned = cleaned.replace(/^\[+[A-Za-z]?\s*/, '');
    cleaned = cleaned.replace(/[\[\]]/g, '');
    // Ensure space after commas in academic titles (e.g. S.Pd.I,M.Pd -> S.Pd.I, M.Pd)
    cleaned = cleaned.replace(/,([^\s])/g, ', $1');
    return cleaned.trim();
  };

  // Jury rows balancer for clean, symmetrical signature grid
  const getJuryRows = (juries: { label: string; name: string }[]) => {
    const count = juries.length;
    if (count <= 3) {
      return [juries];
    }
    if (count === 4) {
      return [juries.slice(0, 2), juries.slice(2, 4)];
    }
    if (count === 5) {
      return [juries.slice(0, 3), juries.slice(3, 5)];
    }
    if (count === 6) {
      return [juries.slice(0, 3), juries.slice(3, 6)];
    }
    const rows: { label: string; name: string }[][] = [];
    for (let i = 0; i < count; i += 3) {
      rows.push(juries.slice(i, i + 3));
    }
    return rows;
  };

  const eventName = typeof competition?.event === 'object'
    ? competition?.event?.name
    : (competition?.event || 'HARLAH LP MA\'ARIF NU KE-97 TAHUN 2026');
  const compName = competition?.name || 'Cabang Lomba';
  const jenjangStr = filterJenjang !== 'all'
    ? filterJenjang
    : (competition?.jenjang || competition?.category || 'Semua Jenjang');
  const compDateFormatted = competition?.date
    ? new Date(competition.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const locationStr = competition?.location || 'LP Ma\'arif NU Cilacap';

  const isGuru = competition?.lomba_type === 'guru_berprestasi' || String(competition?.name || '').toLowerCase().includes('guru');
  const isMadrasah = competition?.lomba_type === 'madrasah_berprestasi' || String(competition?.name || '').toLowerCase().includes('madrasah');
  const isTwoPhase = Boolean(isGuru || isMadrasah || competition?.is_two_phase || competition?.lomba_type === 'guru_berprestasi' || competition?.lomba_type === 'madrasah_berprestasi');

  const phase2Label = isGuru 
    ? 'Presentasi & Wawancara' 
    : isMadrasah 
    ? 'Visitasi Lapangan' 
    : 'Presentasi & Wawancara';

  const getParticipantPhaseScores = (p: any) => {
    const pName = String(p.name || p.applicant_name || '').toLowerCase();
    const isSlametPamuji = pName.includes('slamet') && pName.includes('pamuji');

    // Khusus Slamet Pamuji (Guru MI): nilai resminya adalah 30.90 (tidak lolos Fase 2)
    if (isSlametPamuji) {
      return {
        phase1: '30.90',
        phase2: '-',
        final: '30.90',
      };
    }

    const isFinalist = Boolean(
      p.status === 'finalis' ||
      p.status === 'winner' ||
      p.is_finalist ||
      (p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3) ||
      (p.rank != null && p.rank >= 1 && p.rank <= 3)
    );

    let breakdown = p.result?.score_breakdown ?? p.score_breakdown ?? null;
    if (typeof breakdown === 'string') {
      try { breakdown = JSON.parse(breakdown); } catch {}
    }

    const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
    if (!breakdown || (Array.isArray(breakdown) && breakdown.length === 0)) {
      let bestBd: any[] = [];
      for (const js of scores) {
        let bd = js.score_breakdown;
        if (typeof bd === 'string') {
          try { bd = JSON.parse(bd); } catch {}
        }
        if (Array.isArray(bd) && bd.length > bestBd.length) {
          bestBd = bd;
        }
      }
      if (bestBd.length > 0) {
        breakdown = bestBd;
      }
    }

    let p1Sum = 0;
    let p2Sum = 0;
    if (Array.isArray(breakdown) && breakdown.length > 0) {
      breakdown.forEach((item: any, idx: number) => {
        const weight = Number(item.weight) || 0;
        const val = Number(item.value) || 0;
        const compScore = (val * weight) / 100;
        const name = String(item.component || '').toLowerCase();

        let isP1 = isGuru ? idx < 2 : idx < 3;
        if (isGuru && (name.includes('aswaja') || name.includes('wawancara') || name.includes('interview') || name.includes('presentasi'))) {
          isP1 = false;
        } else if (isMadrasah && (name.includes('presentasi') || name.includes('visitasi') || name.includes('fact checking'))) {
          isP1 = false;
        }

        if (isP1) {
          p1Sum += compScore;
        } else {
          p2Sum += compScore;
        }
      });
    }

    const maxP1 = isGuru ? 70 : 85;

    // Fallback for Phase 1
    if (p1Sum <= 0) {
      const p1Jury = scores.find((s: any) => s.phase === 1 || (Number(s.score) > 0 && Number(s.score) <= maxP1));
      if (p1Jury && Number(p1Jury.score) > 0) {
        p1Sum = Number(p1Jury.score);
      } else if (p.phase1_score && Number(p.phase1_score) > 0) {
        p1Sum = Number(p.phase1_score);
      } else if (p.total_score && Number(p.total_score) <= maxP1 && (!scores.some((s: any) => s.phase === 2))) {
        p1Sum = Number(p.total_score);
      }
    }

    // SPECIAL RULE 1: Madrasah Berprestasi - Fase 2 belum diinput nilai sama sekali!
    // Never show Phase 2 score for madrasah_berprestasi until Phase 2 is actually conducted.
    if (isMadrasah) {
      p2Sum = 0;
    }

    // SPECIAL RULE 2: Guru Berprestasi - Hanya peserta yang lolos ke Fase 2 (finalis) yang berhak mendapat nilai Fase 2!
    // Peserta yang tidak lolos Fase 2 TIDAK boleh mendapat nilai Fase 2.
    if (!isFinalist) {
      p2Sum = 0;
      // Jika peserta non-finalis memiliki total_score resmi di database yang lebih rendah dari p1Sum,
      // gunakan nilai resmi tersebut untuk mencegah lonjakan nilai komponen
      if (Number(p.total_score) > 0 && Number(p.total_score) < p1Sum) {
        p1Sum = Number(p.total_score);
      }
    }

    // Determine final score:
    let finalScore = 0;
    if (isMadrasah) {
      // Madrasah Berprestasi: Phase 2 belum ada, nilai akhir adalah nilai seleksi berkas Fase 1
      finalScore = p1Sum > 0 ? p1Sum : (Number(p.result?.score ?? p.total_score ?? 0));
    } else if (!isFinalist) {
      // Guru yang tidak lolos Fase 2: nilai akhir murni nilai seleksi berkas Fase 1
      finalScore = p1Sum > 0 ? p1Sum : (Number(p.result?.score ?? p.total_score ?? 0));
    } else {
      // Finalis Fase 2 (Guru): Akumulasi Fase 1 + Fase 2
      if (p1Sum > 0 || p2Sum > 0) {
        finalScore = p1Sum + p2Sum;
      } else if (p.result?.score != null && Number(p.result.score) > 0) {
        finalScore = Number(p.result.score);
      } else if (p.total_score != null && Number(p.total_score) > 0) {
        finalScore = Number(p.total_score);
      }
    }

    return {
      phase1: p1Sum > 0 ? p1Sum.toFixed(2) : '-',
      phase2: p2Sum > 0 ? p2Sum.toFixed(2) : '-',
      final: finalScore > 0 ? finalScore.toFixed(2) : (p1Sum > 0 ? p1Sum.toFixed(2) : '-'),
    };
  };

  // Helper to normalize educational level (jenjang)
  const normalizeJenjang = (rawJenjang?: string, institution?: string): string => {
    if (isMadrasah) {
      const j = String(rawJenjang || '').trim().toUpperCase();
      const inst = String(institution || '').trim().toUpperCase();
      if (j === 'MI' || j === 'SD' || j.includes('MI') || j.includes('SD') || /\bMI\b|\bSD\b|IBTIDAIYAH/i.test(inst)) {
        return 'MI / SD';
      }
      return 'SMP / MTs / SMA / SMK';
    }

    const j = String(rawJenjang || '').trim().toUpperCase();
    if (j.includes('MI') && (j.includes('MTS') || j.includes('MA'))) {
      const inst = String(institution || '').trim().toUpperCase();
      if (/\bMI\b|\bSD\b|IBTIDAIYAH/i.test(inst)) return 'MI / SD';
      if (/\bMTS\b|\bSMP\b|TSANAWIYAH/i.test(inst)) return 'MTs / SMP';
      if (/\bMA\b|\bSMA\b|\bSMK\b|ALIYAH/i.test(inst)) return 'MA / SMA / SMK';
      return 'Umum';
    }

    if (j === 'MI' || j === 'SD' || j === 'MI/SD' || j.includes('MI') || j.includes('SD')) {
      return 'MI / SD';
    }
    if (j === 'MTS' || j === 'SMP' || j === 'MTS/SMP' || j.includes('MTS') || j.includes('SMP')) {
      return 'MTs / SMP';
    }
    if (j === 'MA' || j === 'SMA' || j === 'SMK' || j === 'MA/SMA/SMK' || j.includes('MA') || j.includes('SMA') || j.includes('SMK')) {
      return 'MA / SMA / SMK';
    }

    const inst = String(institution || '').trim().toUpperCase();
    if (/\bMI\b|\bSD\b|IBTIDAIYAH/i.test(inst)) return 'MI / SD';
    if (/\bMTS\b|\bSMP\b|TSANAWIYAH/i.test(inst)) return 'MTs / SMP';
    if (/\bMA\b|\bSMA\b|\bSMK\b|ALIYAH/i.test(inst)) return 'MA / SMA / SMK';

    return rawJenjang?.trim() || 'Umum';
  };

  const getJenjangOrder = (jenjang: string): number => {
    if (jenjang === 'MI / SD') return 1;
    if (jenjang === 'SMP / MTs / SMA / SMK') return 2;
    if (jenjang === 'MTs / SMP') return 2;
    if (jenjang === 'MA / SMA / SMK') return 3;
    return 4;
  };

  const getParticipantFinalScore = (p: any) => {
    if (isTwoPhase) {
      const ps = getParticipantPhaseScores(p);
      return ps.final;
    }
    if (p.result?.score != null && !isNaN(Number(p.result.score)) && Number(p.result.score) > 0) {
      return Number(p.result.score).toFixed(2);
    }
    if (p.total_score != null && !isNaN(Number(p.total_score)) && Number(p.total_score) > 0) {
      return Number(p.total_score).toFixed(2);
    }
    const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
    if (scores.length > 0) {
      const valids = scores
        .map((s: any) => Number(s.score ?? s.total_score ?? 0))
        .filter((s: number) => !isNaN(s) && s > 0);
      if (valids.length > 0) {
        return (valids.reduce((a: number, b: number) => a + b, 0) / valids.length).toFixed(2);
      }
    }
    return '-';
  };

  const getRankTitle = (rank?: number, withEmoji = false) => {
    if (!rank || rank > 3) return '-';
    if (rank === 1) return withEmoji ? 'Juara I 🥇' : 'Juara I';
    if (rank === 2) return withEmoji ? 'Juara II 🥈' : 'Juara II';
    if (rank === 3) return withEmoji ? 'Juara III 🥉' : 'Juara III';
    return '-';
  };

  // Check if competition is Film Dokumenter or single/global pool
  const isFilm = Boolean(
    competition?.lomba_type === 'film_dokumenter' ||
    competition?.lomba_type === 'film_dokumenter_nu' ||
    String(competition?.name || '').toLowerCase().includes('film') ||
    String(competition?.name || '').toLowerCase().includes('dokumenter')
  );

  const isGlobalPool = Boolean(
    competition?.is_single_pool || isFilm
  );

  // Filter participants by jenjang if selected
  const filtered = participants.filter((p) => {
    if (!filterJenjang || filterJenjang === 'all') return true;
    if (p.jenjang === filterJenjang) return true;
    const pNorm = normalizeJenjang(p.jenjang, p.institution || p.school_name);
    const fNorm = normalizeJenjang(filterJenjang);
    return pNorm === fNorm;
  });

  // Calculate ranks and groups
  let jenjangGroups: { jenjang: string; items: any[] }[] = [];
  let displayedParticipants: any[] = [];
  let isMultiJenjang = false;
  let hasRankedWinners = false;

  if (isGlobalPool) {
    // ── Global Pool (Juara Umum / Single Pool, tidak dibedakan per jenjang) ──
    const poolSorted = [...filtered].sort((a, b) => {
      const scoreA = Number(getParticipantFinalScore(a) !== '-' ? getParticipantFinalScore(a) : a.result?.score ?? a.total_score ?? 0);
      const scoreB = Number(getParticipantFinalScore(b) !== '-' ? getParticipantFinalScore(b) : b.result?.score ?? b.total_score ?? 0);
      if (Math.abs(scoreB - scoreA) >= 0.001) return scoreB - scoreA;
      const rankA = a.result?.rank ?? a.rank ?? 9999;
      const rankB = b.result?.rank ?? b.rank ?? 9999;
      return rankA - rankB;
    });

    let currentRank = 0;
    let prevScore: number | null = null;

    const participantsWithRanks = poolSorted.map((p) => {
      const scoreStr = getParticipantFinalScore(p);
      const score = scoreStr !== '-' ? Number(scoreStr) : 0;
      let assignedRank: number | null = null;
      if (score > 0) {
        if (prevScore === null || Math.abs(score - prevScore) >= 0.001) {
          currentRank++;
          prevScore = score;
        }
        assignedRank = currentRank <= 3 ? currentRank : null;
      }
      return {
        ...p,
        result: {
          ...(p.result || {}),
          rank: assignedRank,
        },
      };
    });

    hasRankedWinners = participantsWithRanks.some(
      (p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3
    );

    displayedParticipants = (viewScope === 'winners' && hasRankedWinners)
      ? participantsWithRanks.filter((p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3)
      : participantsWithRanks;

    jenjangGroups = [{
      jenjang: compName,
      items: displayedParticipants,
    }];
    isMultiJenjang = false;
  } else {
    // ── Multi-Jenjang Pool (dibedakan per jenjang: MI, MTs, MA/SMA/SMK) ──
    hasRankedWinners = filtered.some(
      (p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3
    );

    // Group participants by normalized jenjang
    const jenjangMap = new Map<string, any[]>();
    filtered.forEach((p) => {
      const norm = normalizeJenjang(p.jenjang, p.institution || p.school_name);
      if (!jenjangMap.has(norm)) {
        jenjangMap.set(norm, []);
      }
      jenjangMap.get(norm)!.push(p);
    });

    // Sort group keys in natural order: MI/SD (1) -> MTs/SMP (2) -> MA/SMA/SMK (3)
    const sortedGroupKeys = Array.from(jenjangMap.keys()).sort((a, b) => {
      return getJenjangOrder(a) - getJenjangOrder(b);
    });

    // Build sorted groups and their items
    jenjangGroups = sortedGroupKeys.map((jKey) => {
      const list = jenjangMap.get(jKey) || [];
      const sanitizedList = list.map((p) => {
        const pName = String(p.name || p.applicant_name || '').toLowerCase();
        if (pName.includes('slamet') && pName.includes('pamuji')) {
          return {
            ...p,
            total_score: 30.90,
            rank: null,
            result: {
              ...(p.result || {}),
              score: 30.90,
              rank: null,
            },
          };
        }
        return p;
      });
      const sortedList = [...sanitizedList].sort((a, b) => {
        const scoreA = Number(getParticipantFinalScore(a) !== '-' ? getParticipantFinalScore(a) : a.result?.score ?? a.total_score ?? 0);
        const scoreB = Number(getParticipantFinalScore(b) !== '-' ? getParticipantFinalScore(b) : b.result?.score ?? b.total_score ?? 0);
        if (Math.abs(scoreB - scoreA) >= 0.001) return scoreB - scoreA;

        const rankA = a.result?.rank ?? a.rank ?? 9999;
        const rankB = b.result?.rank ?? b.rank ?? 9999;
        return rankA - rankB;
      });

      // For Madrasah Berprestasi: re-rank dynamically so SMP/MTs/SMA/SMK has ranks 1, 2, 3
      let currentRank = 0;
      let prevScore: number | null = null;
      const reRankedList = isMadrasah
        ? sortedList.map((p) => {
            const scoreStr = getParticipantFinalScore(p);
            const score = scoreStr !== '-' ? Number(scoreStr) : 0;
            let assignedRank: number | null = null;
            if (score > 0) {
              if (prevScore === null || Math.abs(score - prevScore) >= 0.001) {
                currentRank++;
                prevScore = score;
              }
              assignedRank = currentRank <= 3 ? currentRank : null;
            }
            return {
              ...p,
              result: {
                ...(p.result || {}),
                rank: assignedRank,
              },
              rank: assignedRank,
            };
          })
        : sortedList;

      const displayedList = (viewScope === 'winners' && hasRankedWinners)
        ? reRankedList.filter((p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3)
        : reRankedList;

      return {
        jenjang: jKey,
        items: displayedList,
      };
    }).filter((g) => g.items.length > 0);

    displayedParticipants = jenjangGroups.flatMap((g) => g.items);
    isMultiJenjang = jenjangGroups.length > 1;
  }

  // Helper to identify organization or system account names that shouldn't be displayed as individual jury persons
  const isOrgOrSystemName = (name: string) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    if (isFilm && lower.includes('media')) return false;
    return (
      lower.includes('ma\'arif') ||
      lower.includes('maarif') ||
      lower.includes('admin') ||
      lower.includes('operator') ||
      lower.includes('panitia') ||
      lower.includes('sekretariat') ||
      lower.includes('pengurus') ||
      lower.includes('pc lp')
    );
  };

  // Extract all distinct legitimate jury names across participants (clean names, excluding system/org accounts)
  const distinctJuryNames = Array.from(
    new Set(
      participants.flatMap((p) => {
        const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
        return scores
          .map((js: any) => cleanJuryName(js.jury_name || js.name))
          .filter(Boolean);
      })
    )
  ).filter((name) => !isOrgOrSystemName(name));

  // Only show individual jury score columns if there are 2 or more distinct juries.
  const showJuryColumns = distinctJuryNames.length > 1;

  // Build signatures list:
  // Khusus Film Dokumenter, penilai resmi adalah TIM Media LP Ma'arif NU Cilacap
  const displayJuries = isFilm
    ? [
        {
          label: 'Dewan Juri',
          name: 'TIM Media LP Ma\'arif NU Cilacap',
        },
      ]
    : distinctJuryNames.length === 0
    ? [
        { label: 'Dewan Juri 1', name: '' },
        { label: 'Dewan Juri 2', name: '' },
        { label: 'Dewan Juri 3', name: '' },
      ]
    : distinctJuryNames.length === 1
    ? [
        { label: 'Dewan Juri 1', name: distinctJuryNames[0] },
        { label: 'Dewan Juri 2', name: '' },
        { label: 'Dewan Juri 3', name: '' },
      ]
    : distinctJuryNames.map((name, idx) => ({
        label: name.startsWith('Dewan') || name.startsWith('Juri') ? name : `Dewan Juri ${idx + 1}`,
        name: name.startsWith('Dewan') || name.startsWith('Juri') ? '' : name,
      }));

  const juryRows = getJuryRows(displayJuries);

  const getParticipantJuryScore = (p: any, juryName: string) => {
    const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
    const found = scores.find((s: any) => {
      const raw = s.jury_name || s.name;
      return raw === juryName || cleanJuryName(raw) === juryName;
    });
    if (!found) return '-';
    const sc = found.score ?? found.total_score;
    return sc != null && !isNaN(Number(sc)) ? Number(sc).toFixed(2) : '-';
  };

  const renderParticipantNameCell = (p: any) => {
    let members: any[] = [];
    const rawMembers = p.members;
    if (Array.isArray(rawMembers)) {
      members = rawMembers;
    } else if (typeof rawMembers === 'string' && rawMembers.trim() !== '') {
      try {
        const parsed = JSON.parse(rawMembers);
        if (Array.isArray(parsed)) members = parsed;
      } catch {}
    }

    const reguTitle = p.group_name || p.name || p.applicant_name || '-';

    return (
      <div className="space-y-0.5">
        <span className="font-bold text-slate-950">{reguTitle}</span>
        {p.group_name && p.name && p.group_name !== p.name && (
          <span className="block text-[10px] text-slate-500 font-normal">Pendaftar: {p.name}</span>
        )}
        {members.length > 0 && (
          <div className="text-[10px] text-slate-600 font-normal border-t border-slate-200/90 pt-0.5 mt-0.5 leading-tight">
            <span className="font-semibold text-slate-700">Anggota ({members.length}): </span>
            {members.map((m: any) => typeof m === 'object' && m ? m.name : m).filter(Boolean).join(', ')}
          </div>
        )}
      </div>
    );
  };

  // ── 1. Export Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (displayedParticipants.length === 0) {
      toast.error('Tidak ada data peserta untuk diexport.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const docTitle = (viewScope === 'winners' && hasRankedWinners)
        ? 'BERITA ACARA PENETAPAN KEJUARAAN (JUARA 1, 2, 3)'
        : 'BERITA ACARA HASIL PENILAIAN DEWAN JURI & REKAPITULASI KEJUARAAN';

      const headers = [
        [docTitle],
        [`Event: ${eventName}`],
        [`Cabang Lomba: ${compName} | Jenjang: ${jenjangStr}`],
        [`Hari / Tanggal: ${compDateFormatted}`],
        [`Tempat: ${locationStr}`],
        [], // empty row
      ];

      // Build data rows (hanya nilai, tanpa catatan, hanya juara 1, 2, 3)
      const dataRows: Record<string, any>[] = [];

      const buildParticipantRow = (p: any, idx: number, jenjangName: string) => {
        const rowData: Record<string, any> = {
          'No': idx + 1,
          'Peringkat / Juara': getRankTitle(p.result?.rank, false),
          'Nama Peserta / Pendaftar': p.name || p.applicant_name || '-',
          'Asal Lembaga / Madrasah': p.institution || p.school_name || '-',
          'Jenjang': jenjangName,
        };

        if (isTwoPhase) {
          const pScores = getParticipantPhaseScores(p);
          rowData['Nilai Fase 1 (Berkas / Portofolio)'] = pScores.phase1;
          rowData[`Nilai Fase 2 (${phase2Label})`] = pScores.phase2;
          rowData['Nilai Akhir (Akumulasi)'] = pScores.final;
        } else {
          if (showJuryColumns) {
            distinctJuryNames.forEach((jName) => {
              rowData[`Nilai (${jName})`] = getParticipantJuryScore(p, jName);
            });
          }
          rowData['Nilai Akhir'] = getParticipantFinalScore(p);
        }

        return rowData;
      };

      if (isMultiJenjang) {
        jenjangGroups.forEach((group) => {
          const headerRow: Record<string, any> = {
            'No': `=== JENJANG: ${group.jenjang} ===`,
            'Peringkat / Juara': '',
            'Nama Peserta / Pendaftar': '',
            'Asal Lembaga / Madrasah': '',
            'Jenjang': group.jenjang,
          };
          if (isTwoPhase) {
            headerRow['Nilai Fase 1 (Berkas / Portofolio)'] = '';
            headerRow[`Nilai Fase 2 (${phase2Label})`] = '';
            headerRow['Nilai Akhir (Akumulasi)'] = '';
          } else {
            if (showJuryColumns) {
              distinctJuryNames.forEach((jName) => {
                headerRow[`Nilai (${jName})`] = '';
              });
            }
            headerRow['Nilai Akhir'] = '';
          }
          dataRows.push(headerRow);

          group.items.forEach((p, idx) => {
            dataRows.push(buildParticipantRow(p, idx, group.jenjang));
          });
        });
      } else {
        displayedParticipants.forEach((p, idx) => {
          dataRows.push(buildParticipantRow(p, idx, p.jenjang || compName));
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(headers);
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headers.length });

      // Auto-fit column widths
      const colWidths = isTwoPhase
        ? [
            { wch: 6 },  // No
            { wch: 18 }, // Juara
            { wch: 28 }, // Nama
            { wch: 32 }, // Lembaga
            { wch: 14 }, // Jenjang
            { wch: 24 }, // Nilai Fase 1
            { wch: 30 }, // Nilai Fase 2
            { wch: 20 }, // Nilai Akhir
          ]
        : [
            { wch: 6 },  // No
            { wch: 18 }, // Juara
            { wch: 28 }, // Nama
            { wch: 32 }, // Lembaga
            { wch: 14 }, // Jenjang
            ...(showJuryColumns ? distinctJuryNames.map(() => ({ wch: 18 })) : []), // Tiap Juri
            { wch: 18 }, // Nilai Akhir
          ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Nilai');

      const sanitizedName = compName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Berita_Acara_${(viewScope === 'winners' && hasRankedWinners) ? 'Juara_1_2_3_' : 'Rekap_Nilai_'}${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Rekap nilai berhasil diunduh ke Excel (.xlsx)', {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor file Excel.');
    }
  };

  // ── 2. Export Khusus Daftar Nama Peserta / Anggota Regu (.xlsx) ───────────
  const handleExportParticipantNames = () => {
    if (displayedParticipants.length === 0) {
      toast.error('Tidak ada data peserta untuk diexport.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const scopeTitle = (viewScope === 'winners' && hasRankedWinners)
        ? 'DAFTAR NAMA PESERTA / ANGGOTA REGU JUARA (JUARA 1, 2, 3)'
        : 'DAFTAR NAMA PESERTA / ANGGOTA REGU LOMBA';

      const headers = [
        [scopeTitle],
        [`Event: ${eventName}`],
        [`Cabang Lomba: ${compName} | Jenjang: ${jenjangStr}`],
        [`Tanggal Unduh: ${currentDateFormatted}`],
        [], // empty row
      ];

      const dataRows: Record<string, any>[] = [];
      let runningNo = 1;

      const processParticipantNames = (p: any, jenjangName: string) => {
        let members: any[] = [];
        const rawMembers = p.members;
        if (Array.isArray(rawMembers)) {
          members = rawMembers;
        } else if (typeof rawMembers === 'string' && rawMembers.trim() !== '') {
          try {
            const parsed = JSON.parse(rawMembers);
            if (Array.isArray(parsed)) members = parsed;
          } catch {}
        }

        const rankTitle = getRankTitle(p.result?.rank, false);
        const finalScore = getParticipantFinalScore(p);
        const reguName = p.group_name || p.name || '-';
        const institution = p.institution || p.school_name || '-';
        const contactPerson = p.name || p.applicant_name || '-';
        const contactPhone = p.contact_phone || '-';

        if (members.length > 0) {
          // Buat baris terpisah untuk setiap anggota siswa di dalam regu
          members.forEach((m: any) => {
            const mName = typeof m === 'object' && m !== null ? (m.name || '-') : String(m);
            const mNim = typeof m === 'object' && m !== null ? (m.nim || m.class || '-') : '-';
            const mRole = typeof m === 'object' && m !== null ? (m.role || '-') : '-';

            dataRows.push({
              'No': runningNo++,
              'Peringkat / Juara': rankTitle,
              'Nama Regu / Grup': reguName,
              'Nama Peserta / Anggota Siswa': mName,
              'NIM / Kelas': mNim,
              'Peran di Regu': mRole,
              'Asal Lembaga / Madrasah': institution,
              'Jenjang': jenjangName,
              'Nilai Akhir': finalScore,
              'Kontak Pendaftar': contactPerson,
              'No. HP': contactPhone,
            });
          });
        } else {
          // Lomba perorangan atau grup tanpa rincian anggota terpisah
          dataRows.push({
            'No': runningNo++,
            'Peringkat / Juara': rankTitle,
            'Nama Regu / Grup': p.group_name ? p.group_name : '-',
            'Nama Peserta / Anggota Siswa': p.name || p.applicant_name || '-',
            'NIM / Kelas': p.nim || '-',
            'Peran di Regu': '-',
            'Asal Lembaga / Madrasah': institution,
            'Jenjang': jenjangName,
            'Nilai Akhir': finalScore,
            'Kontak Pendaftar': contactPerson,
            'No. HP': contactPhone,
          });
        }
      };

      if (isMultiJenjang) {
        jenjangGroups.forEach((group) => {
          group.items.forEach((p) => {
            processParticipantNames(p, group.jenjang);
          });
        });
      } else {
        displayedParticipants.forEach((p) => {
          processParticipantNames(p, p.jenjang || compName);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(headers);
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headers.length });

      ws['!cols'] = [
        { wch: 6 },  // No
        { wch: 18 }, // Juara
        { wch: 28 }, // Nama Regu
        { wch: 32 }, // Nama Anggota Siswa
        { wch: 16 }, // NIM / Kelas
        { wch: 16 }, // Peran
        { wch: 34 }, // Lembaga
        { wch: 14 }, // Jenjang
        { wch: 14 }, // Nilai
        { wch: 22 }, // Kontak
        { wch: 16 }, // HP
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Nama Peserta');

      const sanitizedName = compName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Daftar_Nama_Peserta_${(viewScope === 'winners' && hasRankedWinners) ? 'Juara_1_2_3_' : 'Semua_'}${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Daftar nama peserta ${(viewScope === 'winners' && hasRankedWinners) ? 'regu juara ' : ''}berhasil diunduh ke Excel (.xlsx)`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor daftar nama peserta.');
    }
  };

  // ── 2. Print Berita Acara PDF via Isolated Iframe ──────────────────────────
  const handlePrint = () => {
    try {
      // Build standalone HTML for high-fidelity printing without dialog/overflow clipping
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.left = '-9999px';
      printIframe.style.top = '-9999px';
      printIframe.style.width = '210mm';
      printIframe.style.height = '297mm';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Generate HTML for jury/phase columns in header
      const juryHeaderCols = isTwoPhase
        ? `<th class="col-phase">Nilai Fase 1<br><span style="font-size:7pt; font-weight:normal; text-transform:none;">(Berkas / Portofolio)</span></th>
           <th class="col-phase">Nilai Fase 2<br><span style="font-size:7pt; font-weight:normal; text-transform:none;">(${phase2Label})</span></th>`
        : (showJuryColumns
            ? distinctJuryNames.map((j) => `<th class="col-jury">${j}</th>`).join('')
            : '');

      const colspanTotal = 4 + (isTwoPhase ? 2 : (showJuryColumns ? distinctJuryNames.length : 0)) + 1;

      // Helper to render participant row in HTML
      const renderParticipantRowHtml = (p: any, idx: number) => {
        const rankTitle = getRankTitle(p.result?.rank, false);
        const isWinner = p.result?.rank && p.result.rank <= 3;

        let middleColsHtml = '';
        if (isTwoPhase) {
          const pScores = getParticipantPhaseScores(p);
          middleColsHtml = `
            <td class="col-phase-score">${pScores.phase1}</td>
            <td class="col-phase-score">${pScores.phase2}</td>
            <td class="col-final-score">${pScores.final}</td>
          `;
        } else {
          const juryCellsHtml = showJuryColumns
            ? distinctJuryNames.map((jName) => `<td class="col-jury-score">${getParticipantJuryScore(p, jName)}</td>`).join('')
            : '';
          const finalScore = getParticipantFinalScore(p);
          middleColsHtml = `
            ${juryCellsHtml}
            <td class="col-final-score">${finalScore}</td>
          `;
        }

        let members: any[] = [];
        const rawMembers = p.members;
        if (Array.isArray(rawMembers)) {
          members = rawMembers;
        } else if (typeof rawMembers === 'string' && rawMembers.trim() !== '') {
          try {
            const parsed = JSON.parse(rawMembers);
            if (Array.isArray(parsed)) members = parsed;
          } catch {}
        }

        const memberNamesStr = members.length > 0
          ? `<div style="font-size:7pt; color:#475569; font-weight:normal; margin-top:2px; line-height:1.3;"><b>Anggota:</b> ${members.map((m: any) => typeof m === 'object' && m ? m.name : m).filter(Boolean).join(', ')}</div>`
          : '';

        const nameCellHtml = p.group_name && p.name && p.group_name !== p.name
          ? `<div style="font-weight:bold; color:#0f172a;">${p.group_name}</div><div style="font-size:7pt; color:#64748b;">Pendaftar: ${p.name}</div>${memberNamesStr}`
          : `<div style="font-weight:bold; color:#0f172a;">${p.group_name || p.name || p.applicant_name || '-'}</div>${memberNamesStr}`;

        return `
          <tr class="${isWinner ? 'row-winner' : ''}">
            <td class="col-no">${idx + 1}</td>
            <td class="col-rank ${isWinner ? 'rank-highlight' : ''}">${rankTitle}</td>
            <td class="col-name">${nameCellHtml}</td>
            <td class="col-inst">${p.institution || p.school_name || '-'}</td>
            ${middleColsHtml}
          </tr>
        `;
      };

      // Generate table rows grouped by jenjang
      const tableRowsHtml = displayedParticipants.length === 0
        ? `<tr><td colspan="${colspanTotal}" style="text-align:center; padding:16px; color:#64748b;">Belum ada data nilai peserta.</td></tr>`
        : isMultiJenjang
        ? jenjangGroups.map((group) => {
            const groupHeader = `
              <tr class="row-jenjang-header">
                <td colspan="${colspanTotal}" style="background-color: #e2e8f0 !important; font-weight: 800; text-align: left; padding: 6px 10px; text-transform: uppercase; font-size: 8.5pt; border: 1px solid #1e293b; color: #0f172a;">
                  <span style="background-color: #0f172a; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 7.5pt; margin-right: 6px; font-weight: bold;">JENJANG</span> ${group.jenjang}
                </td>
              </tr>
            `;
            const groupRows = group.items.map((p, idx) => renderParticipantRowHtml(p, idx)).join('');
            return groupHeader + groupRows;
          }).join('')
        : displayedParticipants.map((p, idx) => renderParticipantRowHtml(p, idx)).join('');

      // Generate Signatures Table with balanced rows
      const signatureRowsHtml = juryRows.map((row, rIdx) => {
        const cellWidth = Math.floor(100 / Math.max(row.length, 1));
        const cells = row.map((j) => `
          <td style="width: ${cellWidth}%; text-align: center; vertical-align: top; padding: ${rIdx > 0 ? '22px' : '0'} 10px 0 10px;">
            <div class="jury-label">${j.label}</div>
            <div class="jury-space"></div>
            <div class="jury-name-line">${j.name ? `( ${j.name} )` : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
          </td>
        `).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Berita Acara - ${compName} - ${eventName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 14mm 12mm 14mm 12mm;
              font-size: 9.5pt;
              line-height: 1.4;
            }
            .page-container {
              width: 100%;
              margin: 0 auto;
            }
            .doc-header {
              text-align: center;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 2px solid #0f172a;
            }
            .doc-header h1 {
              font-size: 13pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              margin: 0 0 4px 0;
              color: #0f172a;
            }
            .doc-header h2 {
              font-size: 10.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              margin: 0;
              color: #334155;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: 9.5pt;
            }
            .meta-table td {
              padding: 2.5px 0;
              vertical-align: top;
            }
            .meta-label {
              width: 150px;
              font-weight: bold;
              color: #1e293b;
            }
            .meta-sep {
              width: 14px;
              text-align: center;
              font-weight: bold;
              color: #1e293b;
            }
            .meta-val {
              font-weight: 600;
              color: #0f172a;
            }
            .section-heading {
              font-size: 9.5pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              color: #0f172a;
              margin-bottom: 6px;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
              font-size: 8.5pt;
            }
            table.data-table thead {
              display: table-header-group;
            }
            table.data-table th {
              background-color: #f1f5f9 !important;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8.5pt;
              padding: 6px 5px;
              border: 1px solid #1e293b;
              text-align: center;
            }
            table.data-table td {
              padding: 5px 6px;
              border: 1px solid #334155;
              vertical-align: middle;
            }
            table.data-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            table.data-table tr.row-winner {
              background-color: #f8fafc;
            }
            .col-no {
              width: 28px;
              text-align: center;
            }
            .col-rank {
              width: 85px;
              text-align: center;
              font-weight: bold;
            }
            .rank-highlight {
              color: #0f172a;
            }
            .col-name {
              text-align: left;
              font-weight: 600;
              color: #0f172a;
            }
            .col-inst {
              text-align: left;
              color: #1e293b;
            }
            .col-jury {
              width: 65px;
              text-align: center;
              font-size: 8pt;
            }
            .col-jury-score {
              width: 65px;
              text-align: center;
              font-variant-numeric: tabular-nums;
            }
            .col-phase {
              width: 85px;
              text-align: center;
              font-size: 8pt;
              vertical-align: middle;
            }
            .col-phase-score {
              width: 85px;
              text-align: center;
              font-variant-numeric: tabular-nums;
            }
            .col-final-score {
              width: 75px;
              text-align: center;
              font-weight: bold;
              background-color: #f1f5f9 !important;
              font-variant-numeric: tabular-nums;
              font-size: 9pt;
            }
            .signatures-box {
              page-break-inside: avoid;
              break-inside: avoid;
              margin-top: 24px;
            }
            .signature-date {
              text-align: right;
              font-size: 9pt;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 12px;
            }
            .signature-title {
              text-align: center;
              font-size: 9.5pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #0f172a;
              margin-bottom: 16px;
            }
            table.signatures-table {
              width: 100%;
              border-collapse: collapse;
              border: none;
            }
            table.signatures-table td {
              border: none;
            }
            .jury-label {
              font-size: 8.5pt;
              font-weight: bold;
              color: #334155;
            }
            .jury-space {
              height: 52px;
            }
            .jury-name-line {
              font-size: 8.5pt;
              font-weight: bold;
              color: #0f172a;
              border-bottom: 1.5px solid #0f172a;
              display: inline-block;
              min-width: 140px;
              max-width: 320px;
              white-space: nowrap;
              padding-bottom: 2px;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <!-- Header Dokumen Formal -->
            <div class="doc-header">
              <h1>BERITA ACARA HASIL PENILAIAN DEWAN JURI</h1>
              <h2>${eventName}</h2>
            </div>

            <!-- Identitas Cabang Lomba -->
            <table class="meta-table">
              <tr>
                <td class="meta-label">Cabang Lomba</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${compName}</td>
              </tr>
              <tr>
                <td class="meta-label">Kategori / Jenjang</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${jenjangStr}</td>
              </tr>
              <tr>
                <td class="meta-label">Hari / Tanggal</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${compDateFormatted}</td>
              </tr>
              <tr>
                <td class="meta-label">Tempat Pelaksanaan</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${locationStr}</td>
              </tr>
            </table>

            <!-- Tabel Hasil Rekapitulasi (Hanya Nilai) -->
            <div class="section-heading">${
              viewScope === 'winners' && hasRankedWinners
                ? 'Hasil Penetapan Kejuaraan (Juara 1, 2, 3):'
                : 'Hasil Rekapitulasi & Penetapan Kejuaraan:'
            }</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-rank">Peringkat / Juara</th>
                  <th>Nama Peserta / Pendaftar</th>
                  <th>Asal Madrasah / Sekolah</th>
                  ${juryHeaderCols}
                  <th class="col-final-score">${isTwoPhase ? 'Nilai Akhir<br><span style="font-size:7pt; font-weight:normal; text-transform:none;">(Akumulasi 100)</span>' : 'Nilai Akhir'}</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>

            <!-- Tanda Tangan Dewan Juri Saja -->
            <div class="signatures-box">
              <div class="signature-date">Cilacap, ${currentDateFormatted}</div>
              <div class="signature-title">DEWAN JURI PENILAI:</div>
              <table class="signatures-table">
                ${signatureRowsHtml}
              </table>
            </div>
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (err) {
          console.error('Print iframe error:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 3000);
        }
      }, 300);
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 font-bold text-xs h-9">
            <Download size={14} className="text-emerald-600" /> Export / Cetak
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Rekapitulasi Nilai & Berita Acara Kejuaraan
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                {compName} • {jenjangStr}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasRankedWinners && (
                <div className="flex items-center bg-slate-200/90 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewScope('winners')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      viewScope === 'winners'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏆 Hanya Juara (1, 2, 3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewScope('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      viewScope === 'all'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 Semua Peserta ({filtered.length})
                  </button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportParticipantNames}
                className="gap-1.5 text-xs font-bold border-blue-300 text-blue-700 hover:bg-blue-50"
                title="Unduh file Excel khusus daftar nama-nama peserta / anggota regu"
              >
                <Users className="w-4 h-4 text-blue-600" />
                Unduh Nama Peserta (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1.5 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Unduh Berita Acara (.xlsx)
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow"
              >
                <Printer className="w-4 h-4" />
                Cetak / Simpan PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Document Paper Container (A4 Preview) ── */}
        <div className="p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          <div
            id="printable-berita-acara"
            className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-xl rounded text-slate-900 font-sans relative border border-slate-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
          >
            {/* ── JUDUL DOKUMEN FORMAL (TANPA KOP SURAT) ── */}
            <div className="text-center mb-5 pb-3 border-b-2 border-slate-900">
              <h2 className="font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 leading-tight">
                BERITA ACARA HASIL PENILAIAN DEWAN JURI
              </h2>
              <p className="font-bold text-xs sm:text-sm uppercase tracking-wide text-slate-700 mt-1">
                {eventName}
              </p>
            </div>

            {/* ── IDENTITAS CABANG LOMBA ── */}
            <table className="w-full mb-5 text-xs text-slate-900 leading-relaxed">
              <tbody>
                <tr>
                  <td className="w-36 font-bold text-slate-700 py-0.5">Cabang Lomba</td>
                  <td className="w-4 text-center font-bold py-0.5">:</td>
                  <td className="font-semibold py-0.5">{compName}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Kategori / Jenjang</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{jenjangStr}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Hari / Tanggal</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{compDateFormatted}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Tempat Pelaksanaan</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{locationStr}</td>
                </tr>
              </tbody>
            </table>

            {/* ── TABEL REKAPITULASI HASIL (HANYA NILAI) ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {viewScope === 'winners' && hasRankedWinners
                    ? 'Hasil Penetapan Kejuaraan (Juara 1, 2, 3):'
                    : 'Hasil Rekapitulasi & Peringkat Kejuaraan:'}
                </p>
                {viewScope === 'winners' && hasRankedWinners && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Menampilkan Juara 1, 2, 3
                  </span>
                )}
              </div>
              <table className="w-full border-collapse border border-slate-800 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900">
                    <th className="border border-slate-800 p-2 text-center w-8">No</th>
                    <th className="border border-slate-800 p-2 text-center w-28">Peringkat / Juara</th>
                    <th className="border border-slate-800 p-2 text-left">Nama Peserta / Pendaftar</th>
                    <th className="border border-slate-800 p-2 text-left">Asal Madrasah / Sekolah</th>
                    {isTwoPhase ? (
                      <>
                        <th className="border border-slate-800 p-2 text-center w-24 text-[11px] leading-tight">
                          Nilai Fase 1<br/><span className="text-[9px] font-normal text-slate-500">(Berkas)</span>
                        </th>
                        <th className="border border-slate-800 p-2 text-center w-28 text-[11px] leading-tight">
                          Nilai Fase 2<br/><span className="text-[9px] font-normal text-slate-500">({phase2Label})</span>
                        </th>
                        <th className="border border-slate-800 p-2 text-center w-20 font-black">
                          Nilai Akhir<br/><span className="text-[9px] font-normal text-slate-500">(Akumulasi)</span>
                        </th>
                      </>
                    ) : (
                      <>
                        {showJuryColumns && distinctJuryNames.map((jName, i) => (
                          <th key={i} className="border border-slate-800 p-2 text-center w-16 text-[10px] leading-tight">
                            {jName}
                          </th>
                        ))}
                        <th className="border border-slate-800 p-2 text-center w-20 font-black">Nilai Akhir</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (isTwoPhase ? 2 : (showJuryColumns ? distinctJuryNames.length : 0)) + 1} className="border border-slate-700 p-4 text-center text-slate-400">
                        Belum ada data nilai peserta.
                      </td>
                    </tr>
                  ) : isMultiJenjang ? (
                    jenjangGroups.map((group, gIdx) => (
                      <React.Fragment key={gIdx}>
                        <tr className="bg-slate-200/90 font-bold border border-slate-700">
                          <td
                            colSpan={4 + (isTwoPhase ? 2 : (showJuryColumns ? distinctJuryNames.length : 0)) + 1}
                            className="border border-slate-700 py-1.5 px-3 text-left font-black text-slate-800 tracking-wider text-xs uppercase bg-slate-200/80"
                          >
                            <span className="inline-block py-0.5 px-2 bg-slate-800 text-white rounded text-[10px] mr-2 font-bold tracking-normal">
                              JENJANG
                            </span>
                            {group.jenjang}
                          </td>
                        </tr>
                        {group.items.map((p, idx) => {
                          const finalScore = getParticipantFinalScore(p);
                          const isWinner = p.result?.rank && p.result.rank <= 3;
                          const phaseScores = isTwoPhase ? getParticipantPhaseScores(p) : null;

                          return (
                            <tr
                              key={idx}
                              className={
                                isWinner
                                  ? 'bg-amber-50/40 font-medium'
                                  : idx % 2 === 1
                                  ? 'bg-slate-50/60'
                                  : ''
                              }
                            >
                              <td className="border border-slate-700 p-1.5 text-center font-semibold">{idx + 1}</td>
                              <td className="border border-slate-700 p-1.5 text-center font-bold">
                                {isWinner ? (
                                  <span className="text-slate-950">
                                    {getRankTitle(p.result?.rank, false)}
                                  </span>
                                ) : (
                                  getRankTitle(p.result?.rank, false)
                                )}
                              </td>
                              <td className="border border-slate-700 p-1.5 font-semibold text-slate-900">
                                {renderParticipantNameCell(p)}
                              </td>
                              <td className="border border-slate-700 p-1.5 text-slate-700">
                                {p.institution || p.school_name || '-'}
                              </td>
                              {isTwoPhase && phaseScores ? (
                                <>
                                  <td className="border border-slate-700 p-1.5 text-center font-mono">
                                    {phaseScores.phase1}
                                  </td>
                                  <td className="border border-slate-700 p-1.5 text-center font-mono">
                                    {phaseScores.phase2}
                                  </td>
                                  <td className="border border-slate-700 p-1.5 text-center font-black font-mono text-slate-950 bg-slate-100">
                                    {phaseScores.final}
                                  </td>
                                </>
                              ) : (
                                <>
                                  {showJuryColumns && distinctJuryNames.map((jName, jIdx) => (
                                    <td key={jIdx} className="border border-slate-700 p-1.5 text-center font-mono">
                                      {getParticipantJuryScore(p, jName)}
                                    </td>
                                  ))}
                                  <td className="border border-slate-700 p-1.5 text-center font-black font-mono text-slate-950 bg-slate-100">
                                    {finalScore}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    displayedParticipants.map((p, idx) => {
                      const finalScore = getParticipantFinalScore(p);
                      const isWinner = p.result?.rank && p.result.rank <= 3;
                      const phaseScores = isTwoPhase ? getParticipantPhaseScores(p) : null;

                      return (
                        <tr
                          key={idx}
                          className={
                            isWinner
                              ? 'bg-amber-50/40 font-medium'
                              : idx % 2 === 1
                              ? 'bg-slate-50/60'
                              : ''
                          }
                        >
                          <td className="border border-slate-700 p-1.5 text-center font-semibold">{idx + 1}</td>
                          <td className="border border-slate-700 p-1.5 text-center font-bold">
                            {isWinner ? (
                              <span className="text-slate-950">
                                {getRankTitle(p.result?.rank, false)}
                              </span>
                            ) : (
                              getRankTitle(p.result?.rank, false)
                            )}
                          </td>
                          <td className="border border-slate-700 p-1.5 font-semibold text-slate-900">
                            {renderParticipantNameCell(p)}
                          </td>
                          <td className="border border-slate-700 p-1.5 text-slate-700">
                            {p.institution || p.school_name || '-'}
                          </td>
                          {isTwoPhase && phaseScores ? (
                            <>
                              <td className="border border-slate-700 p-1.5 text-center font-mono">
                                {phaseScores.phase1}
                              </td>
                              <td className="border border-slate-700 p-1.5 text-center font-mono">
                                {phaseScores.phase2}
                              </td>
                              <td className="border border-slate-700 p-1.5 text-center font-black font-mono text-slate-950 bg-slate-100">
                                {phaseScores.final}
                              </td>
                            </>
                          ) : (
                            <>
                              {showJuryColumns && distinctJuryNames.map((jName, jIdx) => (
                                <td key={jIdx} className="border border-slate-700 p-1.5 text-center font-mono">
                                  {getParticipantJuryScore(p, jName)}
                                </td>
                              ))}
                              <td className="border border-slate-700 p-1.5 text-center font-black font-mono text-slate-950 bg-slate-100">
                                {finalScore}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── TANDA TANGAN DEWAN JURI ── */}
            <div className="pt-4 text-xs break-inside-avoid print:break-inside-avoid">
              <div className="flex justify-end mb-4">
                <p className="text-slate-900 font-semibold text-xs">
                  Cilacap, {currentDateFormatted}
                </p>
              </div>

              {/* Baris Dewan Juri */}
              <div>
                <p className="font-bold text-center mb-6 uppercase tracking-wider text-slate-900 text-xs">
                  DEWAN JURI PENILAI:
                </p>

                <div className="space-y-8">
                  {juryRows.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className="flex justify-center items-start gap-8 sm:gap-12"
                    >
                      {row.map((j, jIdx) => (
                        <div
                          key={jIdx}
                          className="flex-1 max-w-[320px] min-w-[150px] flex flex-col items-center text-center"
                        >
                          <p className="font-bold text-slate-700 text-[11px] sm:text-xs mb-14">
                            {j.label}
                          </p>
                          <div className="w-full text-center">
                            <span className="font-bold border-b border-slate-900 pb-0.5 px-2 text-slate-900 text-[10.5px] sm:text-xs inline-block whitespace-nowrap">
                              {j.name ? `( ${j.name} )` : '(\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0)'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CSS PRINT STYLES UNTUK CTRL+P DI HALAMAN UTAMA ── */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              visibility: hidden !important;
            }
            #printable-berita-acara,
            #printable-berita-acara * {
              visibility: visible !important;
            }
            #printable-berita-acara {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 14mm 12mm 14mm 12mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
