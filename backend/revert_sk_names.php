<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

$log = <<<EOF
- Mengupdate: RITA NOFITA, S.Pd., M.Pd. -> RITA NOFITA
- Mengupdate: YUDHA PRIHANTORO -> YUDHA PRIHANTORO, S.Pd.
- Mengupdate: ZAKIYAH ISNAENI -> ZAKIYAH ISNAENI, S.H.
- Mengupdate: FITRI NUR ELVI HANDAYANI, S.Pd. -> FITRI NUR ELVI HANDAYANI
- Mengupdate: NAZMA HUROHMAH -> NAZMAH HUROHMAH
- Mengupdate: FITRI NUR ELVI HANDAYANI, S.Pd. -> FITRI NUR ELVI HANDAYANI
- Mengupdate: RUMINAH -> RUMINAH, S.Pd.I
- Mengupdate: SUKRON ALI MANSUR -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: PRIMAWANTI, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: WARSENO -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: KHALIMATUS SA'DIYAH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: SURYANTI -> SURYANTI, S.Pd.I
- Mengupdate: KHAMIM MAFTUH -> KHAMIM MAFTUH, S.Pd.
- Mengupdate: AHMAD MAHRUM, S.Pd.I -> ANA WAHAYU, S.Pd.I
- Mengupdate: KHASBI ASSIDIQI -> KHASBI ASSIDIQI, S.Pd.
- Mengupdate: MARSUMI -> MARSUMI, S.Pd.I
- Mengupdate: AFRIZAL NURCAHYA AJI -> TAFRIKHATUL UNSA, S.Pd.
- Mengupdate: YEYEN OKIYANA -> YEYEN OKIYANA, S.Pd.
- Mengupdate: LAZIMATUL MASRUROH -> LAZIMATUL MASRUROH, S.Pd.
- Mengupdate: INDRI LISTIYANI -> INDRI LISTIYANI, S.Pd.SD.
- Mengupdate: HILMI HAIDAR ALI, S.Kom. -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: AKMAL MAULANA, S.H. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: WARSENO -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: NIDA NUR HIDAYAH -> NIDA NUR HIDAYAH, S.Pd.I
- Mengupdate: MUHAMAD TAMYIS ARIFIN -> MUHAMAD TAMYIS ARIFIN, S.Pd.SD.
- Mengupdate: SRI LESTARI, S.Pd. -> KHOTIB ROHMAN, S.Pd.
- Mengupdate: KHULISOTUL MUKARROMAH, S.Ag. -> KHULISOTUL MUKAROMAH, S.Ag.
- Mengupdate: INSYAF SYAEFANA -> INSYAF SYAEFANA, S.Pd.
- Mengupdate: VIERA LIESTIANY -> VIERA LIESTIANY, S.Pd.SD.
- Mengupdate: MATORI, S.H.I -> MATORI, S.Pd.
- Mengupdate: ANGGA SIDIQ SETYAJI -> ANGGA SIDIK SETYAJI, S.Pd.
- Mengupdate: MOHAMAD ISKANDAR -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: ITTA QUNNISA -> RATINO
- Mengupdate: DANY RAMADHAN SYAH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: WAHID YUDIANTO -> WAHID YUDIANTO, S.Pd.I
- Mengupdate: MARYANTI -> MARYANTI, S.Pd.
- Mengupdate: MUHAMMAD MUNIRUL HAKIM, S.Pd.I -> KUNY AZIZATUN NISA, S.Pd.
- Mengupdate: RITA NOFITA, S.Pd., M.Pd. -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: UMI LATIFAH, S.Pd.Si. -> UMI LATIFAH, S.Pd.
- Mengupdate: TITI MASYLACHAH TARTILA -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: DWI YULIYANTI, S.Pd. -> AHMAD ALFARIQI
- Mengupdate: KHADIQOH ZAKIYAH -> KHADIQOH ZAKIYAH, S.Pd.I
- Mengupdate: NANI WIDIANINGSIH DEWI -> ULIN NABILLAH
- Mengupdate: MUNAWAROH -> MUNAWAROH, S.Pd.I
- Mengupdate: KHULISOTUL MUKARROMAH, S.Ag. -> KHULISOTUL MUKAROMAH, S.Ag.
- Mengupdate: LENI HERAWATI, S.Pd. -> LENI HERAWATI, S.Pd.I
- Mengupdate: INSYAF SYAEFANA -> INSYAF SYAEFANA, S.Pd.
- Mengupdate: OSIK BYAK KURNIASIH, S.Pd. -> OSIK BYAR KURNIASIH, S.Pd.
- Mengupdate: TRI OKTA ISTIYONO, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: IMAM WAHYUDI -> IMAM WAHYUDI, S.Pd.
- Mengupdate: FITRI NUR ELVI HANDAYANI, S.Pd. -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: DIN AZIZAH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: KARTINI SURATMI, S.I.Pust. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: AAN RUSLIANA, S.Pd.I -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: NAFISAH, S.Pd. -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: KHAMIM MAFTUH -> KHAMIM MAFTUH, S.Pd.
- Mengupdate: IDA MUHTARI, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: LARAS NURJANAH -> SYIFAURROHMAH, S.Pd.
- Mengupdate: KHOTIBUL UMAM AL MUSYARROF, S.Pd. -> HANI NUR AFIYAH, S.Ag.
- Mengupdate: DANY RAMADHAN SYAH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: DIN AZIZAH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: FATHUR ROKHMAN, S.Pd.I -> FATHUR ROKHMAN, S.Pd.
- Mengupdate: KARTINI SURATMI, S.I.Pust. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: SLAMET SUBKHI -> SLAMET SUBKHI, S.Pd.I
- Mengupdate: LUVI PURWADI, S.Pd.I -> SUKARNI, S.Pd.I
- Mengupdate: INTIHA'US SANGADAH, S.Pd. -> MAFTUHIN, S.Pd.I
- Mengupdate: TOPIK HERDIANA, S.Pd. -> KUNY AZIZATUN NISA, S.Pd.
- Mengupdate: SITI WAHIDAH, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: MUHAMMAD AZIZ MUTTAQIN -> MUHAMMAD AZIZ MUTTAQIN, M.Pd.
- Mengupdate: RUMINAH, S.Pd.I -> RUMINAH
- Mengupdate: ARIF SYAIFULLOH -> ARIF SYAIFULLOH, S.Pd.
- Mengupdate: AMANATUL BROKAH -> AMANATUL BAROKAH, S.Pd.
- Mengupdate: ANNIESCHATUL AZIZAH -> ANNIESCHATUL AZIZAH, S.Pd.
- Mengupdate: SAEFUL ANAM, S.Pd. -> KHOTIB ROHMAN, S.Pd.
- Mengupdate: INDRA KARIMAH -> INDRA KARIMAH, S.Kom.
- Mengupdate: HILMI HAIDAR ALI -> HILMI HAIDAR ALI, S.Kom.
- Mengupdate: NAFISAH -> NAFISAH, S.Pd.
- Mengupdate: SITI SALIMATUN SUBURIYAH, S.Pd. -> KUNY AZIZATUN NISA, S.Pd.
- Mengupdate: KUNY AZIZATUN NISA, S.Pd. -> KINY AZIZATUN NISA, S.Pd.
- Mengupdate: WAHIDA TUZZAHRO -> WAHIDA TUZZAHRO, S.Ag.
- Mengupdate: LUVI PURWADI, S.Pd.I -> SITI NURSANGIDAH, S.Pd.
- Mengupdate: SELLA ANDRIYANI, S.Pd. -> SITI NURSANGIDAH, S.Pd.
- Mengupdate: FARHAN IMADUDIN -> FARHAN IMADUDIN, S.Pd.
- Mengupdate: ALFIYAH, S.Pd.I -> MARSUMI, S.Pd.I
- Mengupdate: PURWANINGSIH, S.Pd. -> LAELATUL FITRIYAH, S.Pd.
- Mengupdate: QONINGATURRIZKINUZILAH, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: LAELATUL ISTINGADAH, S.Pd.I, S.Pd.I -> LAELATUL ISTINGADAH, S.Pd.I
- Mengupdate: 'TUTI ROHAYATI, S.Pd. -> TUTI ROHAYATI, S.Pd.
- Mengupdate: SUPRIYATUN, S.Pd.I -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: WARDIYAH -> WARDIYAH, S.Pd.SD.
- Mengupdate: SAGITA SEPTIYANINGRUM -> SAGITA SEPTIYANINGRUM, S.Pd.
- Mengupdate: ALFIATUS ZAHRO, S.Pd.I -> ALFIATUS ZAHROH, S.Pd.I
- Mengupdate: DASINI, S.Pd.I -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: AHMAD MAFTUH, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: UMI MIFTAHUL JANAH -> UMI MIFTAHUL JANAH, S.Pd.I
- Mengupdate: INDRI LISTIYANI -> INDRI LISTIYANI, S.Pd.SD.
- Mengupdate: SYIFAURROHMAH -> SYIFAURROHMAH, S.Pd.
- Mengupdate: LISTIANA -> LISTIANA, S.Pd.I
- Mengupdate: ITTA QUNNISA -> RATINO
- Mengupdate: ANGGA SIDIK SETYAJI -> ANGGA SIDIK SETYAJI, S.Pd.
- Mengupdate: NUR ROHMAH -> NUR ROHMAH, S.Pd.
- Mengupdate: MISRIYATUN INI'MAH, S.Pd.I -> MISRIYATUN NI'MAH, S.Pd.I
- Mengupdate: MATORI, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: SEPTI PUJI MUHAROMAH, S.Pd. -> SEPTI PUJI MUHAROMAH
- Mengupdate: NURAFNI HIDAYAH, S.Pd. -> KHOTIB ROHMAN, S.Pd.
- Mengupdate: FUTIKHATUL HIDAYATI KHOIRIYAH, S.Pd.I -> KHOTIB ROHMAN, S.Pd.
- Mengupdate: MUHAMAD TAMYIS ARIFIN -> MUHAMAD TAMYIS ARIFIN, S.Pd.SD.
- Mengupdate: AYUSROSIBAWAIHI, S.Ag. -> A. YUSROSIBAWAIHI, S.Ag.
- Mengupdate: KHOTIMATUL MAULIDAH -> KHOTIMATUL MAULIDAH, M.Pd.
- Mengupdate: RIZKA AENI -> CANDRA RATNASARI, S.Sos.
- Mengupdate: SITI NURSANGIDAH, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: INDRA KARIMAH, S.Kom. -> AGUNG ZAKARIYA, S.Pd.I
- Mengupdate: ARIF MUDAKIR -> ARIF MUDAKIR, S.Pd.I, M.Pd.
- Mengupdate: WARDIYAH -> WARDIYAH, S.Pd.SD.
- Mengupdate: INTIHA'US SANGADAH, S.Pd. -> MAFTUHIN, S.Pd.I
- Mengupdate: LAELATUL MUKAROMAH -> LAELATUL MUKAROMAH, S.Pd.
- Mengupdate: PUJI ASTUTI, S.Pd. -> PUJI ASTUTI, S.H.I, M.Pd.
- Mengupdate: PANCA THOLIP RAMADANI -> PANCA THOLIP RAMADANI, S.Pd.
- Mengupdate: ELI NGAZIZATUL KHASANAH -> ELI NGAZIZATUL KHASANAH, S.Pd.
- Mengupdate: SOLIKHATUN NAFISAH -> SOLIKHATUN NAFISAH, S.Mat.
- Mengupdate: M. MIFTACHUL FAUZI -> M. MIFTACHUL FAUZI, S.Pd.
- Mengupdate: AAN RUSLIANA, S.Pd.I -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: KHAYAT -> KHAYAT, S.Pd.I
- Mengupdate: THOLINGUL ANHAR I., S.H. -> THOLINGUL ANHAR, S.H.I
- Mengupdate: MUSIROTUT DINIYAH -> MUSIROTUT DINIYAH, S.Pd.I
- Mengupdate: TRI OKTA ISTIYONO, S.Pd. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: SITI HUJIYAH -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: QONINGATURRIZKINUZILAH, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: IIS SUGIYANTI, S.Pd. -> CANDRA RATNASARI, S.Sos.
- Mengupdate: MUSLIMIN, A.Md. -> MUSLIMIN
- Mengupdate: SITI ZAENAB, S.Pd. -> SENTOT SUCIPTO, S.Pd.
- Mengupdate: SHOLEHAN -> SHOLEHAN, S.Pd.I
- Mengupdate: USWATUN HASANAH -> USWATUN HASANAH, S.Pd.I
- Mengupdate: SUKIRMAN -> SUKIRMAN, S.Pd.I
- Mengupdate: LARAS NURJANAH, S.Pd. -> SYIFAURROHMAH, S.Pd.
- Mengupdate: ZAENAL MUFTI -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: ZAENAL MUFTI -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: SELLA ANDRIYANI, S.Pd. -> SUKARNI, S.Pd.I
- Mengupdate: ALFIYAH -> MARSUMI, S.Pd.I
- Mengupdate: HASAN BASRI -> HASAN BASRI, A.Md.
- Mengupdate: HANI NUR AFIYAH, S.Ag. -> KHOTIBUL UMAM AL MUSYARROF, S.Pd.
- Mengupdate: SITI NURHASANAH, S.Pd. -> PUTRI DEWI PANDHAN WANGI, S.Pd.
- Mengupdate: TRI WAHYUNI, S.Pd.I -> TRI WAHYUNI
- Mengupdate: TITI FARIDA, S.Pd.I -> TITI FARIDA
- Mengupdate: HAMBAR HERU PURNOMO, A.Md. -> HAMBAR HERU PURNOMO
- Mengupdate: MUHAMAD NUR IKHSAN -> MUHAMMAD NUR IKHSAN
- Mengupdate: KUNI FIKRIYATUL FITHRIYAH -> KUNI FIKRIYATUL FITHRIYAH, S.Pd.
- Mengupdate: DWI ELSA ANGGRAENI -> DWI ELSA ANGGRAENI, S.Pd.
- Mengupdate: SITI WAHIDAH, S.Pd. -> SITI NURSANGIDAH, S.Pd.
- Mengupdate: AKMAL MAULANA, S.H. -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: ARDI SETIAWAN IRSYAD -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: ITTA QUNNISA, S.Pd. -> RATINO
- Mengupdate: SANGEN -> ALFINA AMANATUL FAUZAH, S.Pd.
- Mengupdate: RITA NOFITA, S.Pd., M.Pd. -> RITA NOFITA
- Mengupdate: AHMAD MAHRUM, S.Pd.I -> ANA WAHAYU, S.Pd.I
EOF;

function getBareName($name) {
    return strtoupper(trim(preg_replace('/[^a-zA-Z\s]/', '', explode(',', $name)[0])));
}

$lines = explode("\n", trim($log));
$updates = [];
foreach ($lines as $line) {
    if (preg_match('/- Mengupdate: (.+?) -> (.+)/', $line, $matches)) {
        $oldName = trim($matches[1]);
        $newName = trim($matches[2]);
        
        $bareOld = getBareName($oldName);
        $bareNew = getBareName($newName);
        
        // Hanya revert jika orangnya berbeda jauh (salah sasaran)
        // Jika beda sedikit (typo atau penambahan gelar), berarti benar.
        // Kita bandingkan 3 huruf pertama dan panjang string untuk toleransi typo
        similar_text($bareOld, $bareNew, $percent);
        if ($percent < 70 && !str_contains($bareOld, $bareNew) && !str_contains($bareNew, $bareOld)) {
            $updates[] = [
                'old' => $oldName,
                'new' => $newName,
                'bareOld' => $bareOld
            ];
        }
    }
}

echo "Ditemukan " . count($updates) . " nama yang tertukar dan akan diperbaiki...\n\n";

$fixedCount = 0;

foreach ($updates as $u) {
    $oldName = $u['old'];
    $newName = $u['new'];
    
    echo "Menganalisa tertukar: {$oldName} -> {$newName}\n";
    
    // Cari SK dengan nama baru (yg salah)
    $wrongSks = SkDocument::withoutGlobalScopes()->where('nama', $newName)->get();
    
    // Cari data guru ASLI berdasarkan nama lama
    $trueTeacher = Teacher::withTrashed()
        ->where(DB::raw("UPPER(TRIM(SPLIT_PART(nama, ',', 1)))"), 'like', '%' . $u['bareOld'] . '%')
        ->first();
        
    if ($trueTeacher) {
        // Cari SK mana yang sesuai dengan sekolah guru asli
        $matchingSk = $wrongSks->firstWhere('school_id', $trueTeacher->school_id);
        
        if ($matchingSk) {
            $matchingSk->nama = $oldName;
            $matchingSk->teacher_id = $trueTeacher->id;
            $matchingSk->save();
            $fixedCount++;
            echo "   ✅ BERHASIL DIKEMBALIKAN! SK ID {$matchingSk->id} kembali menjadi {$oldName} (Guru ID yang benar: {$trueTeacher->id})\n";
        } else {
            // Jika tidak ketemu berdasarkan sekolah, coba cari yang updated_at-nya hari ini
            $recentSk = $wrongSks->where('updated_at', '>=', now()->subHours(2))->first();
            if ($recentSk) {
                $recentSk->nama = $oldName;
                $recentSk->teacher_id = $trueTeacher->id;
                $recentSk->save();
                $fixedCount++;
                echo "   ✅ BERHASIL DIKEMBALIKAN (Fallback)! SK ID {$recentSk->id} kembali menjadi {$oldName} (Guru ID yang benar: {$trueTeacher->id})\n";
            } else {
                echo "   ❌ GAGAL: Tidak menemukan SK atas nama {$newName} yang cocok.\n";
            }
        }
    } else {
        echo "   ❌ GAGAL: Tidak menemukan Master Guru untuk nama asli {$oldName}.\n";
    }
}

echo "\nTotal SK yang berhasil diselamatkan dari salah nama: {$fixedCount}\n";
