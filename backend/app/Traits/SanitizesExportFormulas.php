<?php

namespace App\Traits;

trait SanitizesExportFormulas
{
    /**
     * Prevent CSV/Excel formula injection (DDE attack) by prefixing
     * dangerous trigger characters (=, +, -, @, \t, \r, |) with an apostrophe.
     */
    public static function sanitizeFormula(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        // Trigger characters that spreadsheet engines evaluate as formulas or commands
        if (preg_match('/^[\=\+\-\@\t\r\|]/', $value)) {
            return "'" . $value;
        }

        return $value;
    }
}
