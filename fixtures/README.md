# Fixtures

Local test files (fake CSV/XLSX imports, e.g. a 5-row LinkedIn group export with example names)
go in `fixtures/local/`, which git ignores as a whole. Spreadsheets (`*.csv`, `*.tsv`, `*.xlsx`,
`*.xls`, `*.xlsm`) are ignored everywhere in the repo, so a real export can't be committed by
accident. Never put member, contact or roster data here, even locally: use obviously fake
data (`@example.com`).
