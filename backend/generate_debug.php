<?php file_put_contents('debug.json', json_encode(\App\Models\Teacher::withoutGlobalScopes()->where('nama', 'like', '%FUTIKHATUL%')->get(), JSON_PRETTY_PRINT)); ?>
