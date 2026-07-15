<?php echo json_encode(\App\Models\Teacher::withoutGlobalScopes()->where("nama", "like", "%FUTIKHATUL%")->get()); ?>
