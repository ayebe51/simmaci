<?php

use Illuminate\Support\Facades\Schema;

echo 'headmaster_tenures: ' . implode(',', Schema::getColumnListing('headmaster_tenures')) . PHP_EOL;
echo 'nuptk_submissions: ' . implode(',', Schema::getColumnListing('nuptk_submissions')) . PHP_EOL;
echo 'teacher_mutations: ' . implode(',', Schema::getColumnListing('teacher_mutations')) . PHP_EOL;
echo 'teacher_attendances: ' . implode(',', Schema::getColumnListing('teacher_attendances')) . PHP_EOL;
