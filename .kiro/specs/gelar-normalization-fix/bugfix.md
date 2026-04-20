# Bugfix Requirements Document

## Introduction

Gelar akademik tertentu tidak dinormalisasi dengan benar oleh NormalizationService. Gelar S.Pd.SD. (Sarjana Pendidikan untuk SD), A.Md. (Ahli Madya), dan A.Ma. (Ahli Madya) tidak dikenali atau salah diformat, menyebabkan data guru menjadi tidak konsisten.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN normalizing "S.Pd.SD." THEN the system returns "SPDSD" instead of preserving "S.Pd.SD."

1.2 WHEN normalizing "A.Md." THEN the system returns "Amd." instead of preserving "A.Md."

1.3 WHEN normalizing "A.Ma." in certain input formats THEN the system may not recognize it correctly due to parsing order issues

### Expected Behavior (Correct)

2.1 WHEN normalizing "S.Pd.SD." THEN the system SHALL preserve it as "S.Pd.SD."

2.2 WHEN normalizing "A.Md." THEN the system SHALL preserve it as "A.Md."

2.3 WHEN normalizing "A.Ma." THEN the system SHALL preserve it as "A.Ma."

### Unchanged Behavior (Regression Prevention)

3.1 WHEN normalizing existing degrees like "S.Pd.", "M.Pd.", "Dr.", "Dra." THEN the system SHALL CONTINUE TO normalize them correctly

3.2 WHEN normalizing "Amd.Keb." (Ahli Madya Keperawatan) THEN the system SHALL CONTINUE TO normalize it to "Amd.Keb."

3.3 WHEN normalizing teacher names without degrees THEN the system SHALL CONTINUE TO convert names to UPPERCASE

3.4 WHEN normalizing teacher names with multiple degrees THEN the system SHALL CONTINUE TO separate degrees with ", "

3.5 WHEN normalizing "A.Ma.Pust." and "A.Ma.Pd." THEN the system SHALL CONTINUE TO normalize them correctly
