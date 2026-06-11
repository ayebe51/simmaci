const HEADER_MAP = {
  nama: ['nama lengkap', 'nama guru', 'nama'],
  nomor_induk_maarif: ['nim', 'nomor induk maarif', 'no induk maarif', 'nomor induk'],
  tmt: ['tmt', 'terhitung mulai tanggal']
};

const rows = [
  ["NIM", "NAMA", "TMT"],
  ["111", "Ali", "2020"],
  ["222", "Budi", "2021"],
  ["333", "Cici", "2022"]
];

const bestRowIndex = 0;
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
  const obj = {}
  Object.entries(colMap).forEach(([key, idx]) => {
    let val = row[idx]
    obj[key] = val
  })
  return obj
}).filter(o => o.nama)

console.log(data);
