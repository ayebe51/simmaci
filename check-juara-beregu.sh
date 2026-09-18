#!/bin/bash
# ==============================================================================
# Script Menampilkan Nama Anggota Regu Juara Festival Aswaja di VPS
# Target Container: backend-yam0yy9a6l424v8j89hv7pqr-063719964430
# ==============================================================================

BACKEND_CONTAINER="backend-yam0yy9a6l424v8j89hv7pqr-063719964430"

if ! docker ps --format "{{.Names}}" | grep -q "^${BACKEND_CONTAINER}$"; then
    BACKEND_CONTAINER=$(docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$BACKEND_CONTAINER" ]; then
    echo "❌ Error: Container backend tidak ditemukan."
    exit 1
fi

docker exec -i "$BACKEND_CONTAINER" php artisan tinker << 'EOF'
$comps = \App\Models\Competition::whereIn('lomba_type', ['mars_maarif', 'puji_pujian', 'film_dokumenter'])
    ->orWhere('type', 'Beregu')
    ->orWhere('type', 'Group')
    ->get();

echo "\n========================================================================\n";
echo "      DAFTAR NAMA ANGGOTA DARI REGU JUARA (FESTIVAL ASWAJA BEREGU)       \n";
echo "========================================================================\n";

$foundAny = false;

foreach ($comps as $c) {
    // Cari peserta yang berstatus juara (rank 1, 2, 3)
    $winners = \App\Models\CompetitionParticipant::where('competition_id', $c->id)
        ->whereHas('result', function ($q) {
            $q->whereNotNull('rank')->where('rank', '<=', 3);
        })
        ->with('result')
        ->get();

    // Fallback jika rank belum di-generate: ambil top 3 berdasarkan skor tertinggi
    if ($winners->isEmpty()) {
        $winners = \App\Models\CompetitionParticipant::where('competition_id', $c->id)
            ->whereHas('result', function ($q) {
                $q->whereNotNull('score')->where('score', '>', 0);
            })
            ->with('result')
            ->get()
            ->sortByDesc(fn($p) => (float)($p->result->score ?? 0))
            ->take(3);
    }

    if ($winners->isEmpty()) {
        continue;
    }

    $foundAny = true;
    echo sprintf("\n🏆 CABANG LOMBA: %s (ID: %d | Jenjang: %s)\n", $c->name, $c->id, $c->jenjang ?? '-');
    echo str_repeat('-', 72) . "\n";

    $sortedWinners = $winners->sort(function ($a, $b) {
        $rankA = $a->result?->rank ?? 99;
        $rankB = $b->result?->rank ?? 99;
        if ($rankA != $rankB) return $rankA <=> $rankB;
        return ((float)($b->result?->score ?? 0)) <=> ((float)($a->result?->score ?? 0));
    });

    foreach ($sortedWinners as $p) {
        $rankLabel = $p->result?->rank ? "JUARA " . $p->result->rank : "Top Skor";
        $scoreLabel = $p->result?->score !== null ? number_format((float)$p->result->score, 2) : '-';
        $reguName = $p->group_name ?: ($p->name ?: 'Tanpa Nama Regu');

        echo sprintf("🥇 %s (Nilai: %s)\n", $rankLabel, $scoreLabel);
        echo sprintf("   Nama Regu        : %s\n", $reguName);
        echo sprintf("   Asal Madrasah    : %s (Jenjang: %s)\n", $p->institution ?: '-', $p->jenjang ?: '-');
        echo sprintf("   Kontak / HP      : %s (%s)\n", $p->name ?: '-', $p->contact_phone ?: '-');

        $rawMembers = $p->members;
        if (is_string($rawMembers)) {
            $rawMembers = json_decode($rawMembers, true) ?: [];
        }
        $members = is_array($rawMembers) ? $rawMembers : [];

        if (count($members) > 0) {
            echo sprintf("   Daftar Anggota (%d orang):\n", count($members));
            foreach ($members as $mIdx => $m) {
                $nama = is_array($m) ? ($m['name'] ?? '-') : (is_object($m) ? ($m->name ?? '-') : (string)$m);
                $nim = is_array($m) ? ($m['nim'] ?? $m['class'] ?? '') : '';
                $role = is_array($m) ? ($m['role'] ?? '') : '';

                $extra = [];
                if (!empty($nim)) $extra[] = "NIM/Kelas: " . $nim;
                if (!empty($role)) $extra[] = "Peran: " . $role;
                $extraStr = count($extra) > 0 ? " [" . implode(', ', $extra) . "]" : "";

                echo sprintf("     %d. %s%s\n", $mIdx + 1, $nama, $extraStr);
            }
        } else {
            echo "   Daftar Anggota   : (Detail nama anggota belum diinput saat pendaftaran)\n";
        }
        echo "\n";
    }
}

if (!$foundAny) {
    echo "\nBelum ada data juara/skor yang masuk untuk lomba Festival Aswaja Beregu.\n";
    echo "Daftar cabang lomba beregu:\n";
    foreach ($comps as $c) {
        $total = \App\Models\CompetitionParticipant::where('competition_id', $c->id)->count();
        echo sprintf(" - [ID: %d] %s: Total %d peserta terdaftar (belum ada input nilai/juara)\n", $c->id, $c->name, $total);
    }
}
EOF
