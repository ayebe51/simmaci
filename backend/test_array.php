<?php
$documents = [
    [ 'nama' => 'Ali', 'nim' => '111' ],
    [ 'nama' => 'Budi', 'nim' => '222' ],
    [ 'nama' => 'Kholik', 'nim' => '333' ],
];

foreach ($documents as $index => $doc) {
    echo "Processing: " . $doc['nama'] . "\n";
    $doc['nama'] = "M." . $doc['nama']; // fake normalize
    $skData = [ 'nama' => $doc['nama'] ];
    echo "SK Data: " . $skData['nama'] . "\n";
}
