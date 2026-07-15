<?php

use App\Models\School;

echo "School 164: " . School::find(164)->nama . "\n";
echo "School 50: " . School::find(50)->nama . "\n";
