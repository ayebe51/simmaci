<?php

namespace App\Console\Commands;

use App\Models\School;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Mengisi kolom kecamatan yang kosong pada tabel schools secara otomatis.
 *
 * Strategi (berurutan):
 *  1. Parsing kolom `alamat`  — cari pola "Kecamatan X" / "Kec. X" / "Kec X"
 *  2. API Kemdikbud by NPSN   — https://api-sekolah-indonesia.vercel.app/sekolah/:npsn
 *  3. (Manual)                — tetap kosong, harus diisi manual oleh admin
 */
class FillSchoolKecamatan extends Command
{
    protected $signature   = 'schools:fill-kecamatan
                                {--dry-run : Tampilkan rencana perubahan tanpa menyimpan}
                                {--only-alamat : Hanya parsing alamat, tidak memanggil API}
                                {--school= : ID sekolah tertentu (opsional)}';

    protected $description = 'Mengisi kecamatan sekolah yang masih kosong secara otomatis (parsing alamat + API Kemdikbud)';

    /** Pola regex untuk mengekstrak kecamatan dari string alamat */
    private array $patterns = [
        '/\bKecamatan\s+([A-Za-z\s\'\-]+?)(?=\s*(?:,|;|\/|Kabupaten|Kab\.|Provinsi|$))/i',
        '/\bKec(?:amatan)?\.?\s+([A-Za-z\s\'\-]+?)(?=\s*(?:,|;|\/|Kab|Prov|$))/i',
    ];

    public function handle(): int
    {
        $isDryRun   = $this->option('dry-run');
        $onlyAlamat = $this->option('only-alamat');
        $schoolId   = $this->option('school');

        $query = School::whereNull('kecamatan')
            ->orWhere('kecamatan', '');

        if ($schoolId) {
            $query->where('id', $schoolId);
        }

        $schools = $query->get();

        if ($schools->isEmpty()) {
            $this->info('✅ Semua sekolah sudah memiliki kecamatan.');
            return 0;
        }

        $this->info("Ditemukan <fg=yellow>{$schools->count()}</> sekolah dengan kecamatan kosong.");
        if ($isDryRun) {
            $this->warn('(DRY-RUN: tidak ada perubahan yang disimpan)');
        }

        $filled    = 0;
        $fromAlamat = 0;
        $fromApi   = 0;
        $skipped   = 0;

        foreach ($schools as $school) {
            $kecamatan = null;

            // ── Strategi 1: Parsing alamat ──────────────────────────────
            if ($school->alamat) {
                $kecamatan = $this->extractFromAlamat($school->alamat);
                if ($kecamatan) {
                    $fromAlamat++;
                    $source = 'alamat';
                }
            }

            // ── Strategi 2: API Kemdikbud via NPSN ─────────────────────
            if (!$kecamatan && !$onlyAlamat && $school->npsn) {
                $kecamatan = $this->fetchFromKemdikbud($school->npsn);
                if ($kecamatan) {
                    $fromApi++;
                    $source = 'API Kemdikbud';
                }
            }

            if ($kecamatan) {
                // Title case
                $kecamatan = mb_convert_case(mb_strtolower($kecamatan), MB_CASE_TITLE, 'UTF-8');

                $this->line(sprintf(
                    '  <fg=green>✔</> [%d] %s → <fg=cyan>%s</> <fg=gray>(%s)</>',
                    $school->id,
                    $school->nama,
                    $kecamatan,
                    $source
                ));

                if (!$isDryRun) {
                    $school->update(['kecamatan' => $kecamatan]);
                }
                $filled++;
            } else {
                $this->line(sprintf(
                    '  <fg=red>✘</> [%d] %s → tidak dapat ditentukan',
                    $school->id,
                    $school->nama
                ));
                $skipped++;
            }
        }

        $this->newLine();
        $this->info("Selesai: <fg=green>{$filled}</> diisi ({$fromAlamat} dari alamat, {$fromApi} dari API), <fg=red>{$skipped}</> tidak dapat ditentukan.");

        return 0;
    }

    /**
     * Ekstrak kecamatan dari string alamat menggunakan regex.
     */
    private function extractFromAlamat(string $alamat): ?string
    {
        foreach ($this->patterns as $pattern) {
            if (preg_match($pattern, $alamat, $match)) {
                $result = trim($match[1]);
                // Bersihkan sisa tanda baca di akhir
                $result = rtrim($result, ' ,;/');
                if (strlen($result) >= 3) {
                    return $result;
                }
            }
        }
        return null;
    }

    /**
     * Ambil data sekolah dari API Kemdikbud berdasarkan NPSN.
     * Menggunakan api-sekolah-indonesia sebagai wrapper publik.
     */
    private function fetchFromKemdikbud(string $npsn): ?string
    {
        try {
            // Endpoint 1: api-sekolah-indonesia (wrapper publik Kemdikbud)
            $response = Http::timeout(8)->get("https://api-sekolah-indonesia.vercel.app/sekolah/{$npsn}");

            if ($response->successful()) {
                $data = $response->json();
                // Response: { "dataSekolah": { ... "kecamatan": "...", ... } }
                $kecamatan = $data['dataSekolah']['kecamatan']
                    ?? $data['kecamatan']
                    ?? null;

                if ($kecamatan && strlen(trim($kecamatan)) >= 3) {
                    return trim($kecamatan);
                }
            }

            // Endpoint 2: referensi.data.kemdikbud.go.id (fallback)
            $response2 = Http::timeout(8)->get("https://referensi.data.kemdikbud.go.id/tabs.php?npsn={$npsn}");
            if ($response2->successful()) {
                // Parse HTML: cari baris kecamatan
                $html = $response2->body();
                if (preg_match('/Kecamatan.*?<td[^>]*>(.*?)<\/td>/si', $html, $m)) {
                    $kecamatan = strip_tags(trim($m[1]));
                    if ($kecamatan && strlen($kecamatan) >= 3) {
                        return $kecamatan;
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning("FillSchoolKecamatan: API call failed for NPSN {$npsn}: " . $e->getMessage());
        }

        return null;
    }
}
