import fs from 'node:fs';

const [igvPath, twsePath, tpexPath, outputPath] = process.argv.slice(2);
if (!igvPath || !twsePath || !tpexPath || !outputPath) {
  throw new Error('Usage: node build-software-universe.mjs IGV.csv TWSE.json TPEX.json OUTPUT.json');
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const igvText = fs.readFileSync(igvPath, 'utf8');
const rows = parseCsv(igvText);
const headerIndex = rows.findIndex(row => row[0]?.trim() === 'Ticker');
if (headerIndex < 0) throw new Error('IGV header not found');
const header = rows[headerIndex].map(value => value.trim());
const tickerIndex = header.indexOf('Ticker');
const nameIndex = header.indexOf('Name');
const assetIndex = header.indexOf('Asset Class');
if ([tickerIndex, nameIndex, assetIndex].some(index => index < 0)) throw new Error('Required IGV columns not found');

const igv = rows.slice(headerIndex + 1)
  .filter(row => row[assetIndex]?.trim() === 'Equity' && row[tickerIndex]?.trim() && row[tickerIndex]?.trim() !== '-')
  .map(row => ({ ticker: row[tickerIndex].trim(), name: row[nameIndex].trim(), region: 'us', market: 'IGV 北美', source: 'iShares IGV' }));
const twse = JSON.parse(fs.readFileSync(twsePath, 'utf8'))
  .filter(item => ['30', '36'].includes(String(item['產業別'] || '').trim()))
  .map(item => ({ ticker: String(item['公司代號'] || '').trim(), name: String(item['公司簡稱'] || '').trim(), region: 'twse', market: '台灣上市', source: 'TWSE 產業 30/36' }));
const tpex = JSON.parse(fs.readFileSync(tpexPath, 'utf8'))
  .filter(item => ['30', '36'].includes(String(item.SecuritiesIndustryCode || '').trim()))
  .map(item => ({ ticker: String(item.SecuritiesCompanyCode || '').trim(), name: String(item.CompanyAbbreviation || '').trim(), region: 'tpex', market: '台灣上櫃', source: 'TPEx 產業 30/36' }));
const cloud = [
  ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['BABA', 'Alibaba Group ADR'], ['SAP', 'SAP'],
  ['IBM', 'IBM'], ['BIDU', 'Baidu ADR'], ['TCEHY', 'Tencent ADR']
].map(([ticker, name]) => ({ ticker, name, region: 'cloud', market: '雲端延伸', source: '策略延伸' }));

if (igv.length < 50 || twse.length < 10 || tpex.length < 20) {
  throw new Error(`Official universe looks incomplete: IGV=${igv.length}, TWSE=${twse.length}, TPEx=${tpex.length}`);
}

const items = [...igv, ...twse, ...tpex, ...cloud];
const payload = { as_of: new Date().toISOString().slice(0, 10), counts: { igv: igv.length, twse: twse.length, tpex: tpex.length, cloud: cloud.length }, items };
fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(`Software universe updated: ${items.length} entries`);
