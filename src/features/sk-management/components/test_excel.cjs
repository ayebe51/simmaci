const XLSX = require('xlsx');

const wsData = [
  ['NAMA', 'NIM', 'TMT'],
  ['Ali', '111', '2020'],
  ['Budi', '222', '2021'],
  ['Kholik', '333', '2022']
];

const ws = XLSX.utils.aoa_to_sheet(wsData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log("Rows:", rows);

const HEADER_MAP = {
  "nama": ["nama lengkap", "nama guru", "nama"],
  "nomor_induk_maarif": ["nim", "nomor induk maarif"],
  "tmt": ["tmt"]
};

let bestRowIndex = 0;
let highestScore = 0;
const allAliases = Object.values(HEADER_MAP).flat();

for (let i = 0; i < Math.min(rows.length, 15); i++) {
  const rowValues = (rows[i] || []).map(v => String(v || '').toLowerCase().trim());
  let score = 0;
  rowValues.forEach(v => {
    if (v && allAliases.some(a => v === a || v.includes(a))) score++;
  });
  if (score > highestScore) {
    highestScore = score;
    bestRowIndex = i;
  }
}

const headers = rows[bestRowIndex].map(h => String(h || '').toLowerCase().trim());
const colMap = {};

Object.entries(HEADER_MAP).forEach(([key, aliases]) => {
  let idx = headers.findIndex(h => aliases.some(a => h === a));
  if (idx === -1) {
    idx = headers.findIndex(h => aliases.some(a => h.includes(a)));
  }
  if (idx !== -1) {
    colMap[key] = idx;
  }
});

const data = rows.slice(bestRowIndex + 1).map(row => {
  const obj = {};
  Object.entries(colMap).forEach(([key, idx]) => {
    let val = row[idx];
    if (typeof val === 'string') {
       val = val.trim();
    }
    obj[key] = val;
  });
  return obj;
}).filter(o => o.nama);

console.log("Data:", data);
