<?php echo "Students with NULL School ID: " . \App\Models\Student::whereNull("school_id")->count() . "\n"; ?>
