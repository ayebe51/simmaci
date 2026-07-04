<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

$sks = DB::table('sk_documents as sk')
    ->join('teachers as t', 'sk.teacher_id', '=', 't.id')
    ->select('sk.id as sk_id', 'sk.nama as sk_nama', 'sk.school_id as sk_school', 't.id as t_id', 't.nama as t_nama', 't.school_id as t_school')
    ->whereNotNull('sk.teacher_id')
    ->whereColumn('sk.school_id', '!=', 't.school_id')
    ->get();

$nullSchool = $sks->whereNull('t_school')->count();
$diffSchool = $sks->whereNotNull('t_school')->count();

echo "Total Cross-School: " . $sks->count() . "\n";
echo "Teachers with NULL school_id: " . $nullSchool . "\n";
echo "Teachers with DIFFERENT school_id: " . $diffSchool . "\n";

echo "\nContoh 5 SK dengan school_id BERBEDA:\n";
foreach ($sks->whereNotNull('t_school')->take(5) as $sk) {
    echo "SK {$sk->sk_id} (School {$sk->sk_school} - {$sk->sk_nama}) -> Teacher {$sk->t_id} (School {$sk->t_school} - {$sk->t_nama})\n";
}
