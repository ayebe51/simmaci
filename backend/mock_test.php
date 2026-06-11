<?php
class TeacherMock {
    public $id;
    public $nama;
    public $nomor_induk_maarif;
    public $tmt;

    public function update($data) {
        if (isset($data['nama'])) $this->nama = $data['nama'];
        if (isset($data['nomor_induk_maarif'])) $this->nomor_induk_maarif = $data['nomor_induk_maarif'];
        if (isset($data['tmt'])) $this->tmt = $data['tmt'];
    }
}

$dbTeachers = [
    // empty DB
];

$documents = [
    [ 'nama' => 'Ali', 'nomor_induk_maarif' => '123', 'tmt' => '2020-07-01' ],
    [ 'nama' => 'Budi', 'nomor_induk_maarif' => '123', 'tmt' => '2021-07-01' ],
    [ 'nama' => 'Kholik', 'nomor_induk_maarif' => '123', 'tmt' => '2022-07-01' ]
];

$seq = 0;
$skDocuments = [];

foreach ($documents as $doc) {
    $teacherData = [ 'nama' => $doc['nama'], 'nomor_induk_maarif' => $doc['nomor_induk_maarif'], 'tmt' => $doc['tmt'] ];

    // Find teacher
    $teacher = null;
    foreach ($dbTeachers as $t) {
        if ($t->nomor_induk_maarif === $teacherData['nomor_induk_maarif']) {
            $teacher = $t;
            break;
        }
    }

    if ($teacher) {
        // Protect against data-entry typos
        $excelBareName = mb_strtoupper($teacherData['nama']);
        $dbBareName = mb_strtoupper($teacher->nama);
        similar_text($excelBareName, $dbBareName, $percent);
        if ($percent < 60) {
            $seq++;
            $skDocuments[] = [ 'nama' => $doc['nama'], 'status' => 'rejected', 'reason' => 'Similar text failed' ];
            continue;
        }

        // update
        $teacher->update($teacherData);
    } else {
        $teacher = new TeacherMock();
        $teacher->id = count($dbTeachers) + 1;
        $teacher->update($teacherData);
        $dbTeachers[] = $teacher;
    }

    $seq++;
    $skDocuments[] = [ 'nama' => $doc['nama'], 'status' => 'menunggu' ];
}

print_r($skDocuments);
