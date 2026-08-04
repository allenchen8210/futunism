// Data is mirrored by the GitHub Pages workflow because TWSE does not allow
// browser cross-origin requests from a static site.
const API='data/';
const $=id=>document.getElementById(id);
let allStocks=[];
const num=v=>Number(String(v??'').replaceAll(',',''));
const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function rocDate(s){
  if(!/^\d{7}$/.test(s||''))return s||'最新盤後資料';
  return `${Number(s.slice(0,3))+1911}/${s.slice(3,5)}/${s.slice(5)}`;
}

function scoreStock(s){
  const pe=s.pe,y=s.yield,pb=s.pb,changePct=s.changePct,value=s.tradeValue;
  // Scores reward reasonable—not simply lowest—valuation and cap outliers.
  const peScore=pe>=8&&pe<=18?100:pe>18&&pe<=30?100-(pe-18)*4:pe>=4&&pe<8?65+(pe-4)*8:20;
  const yieldScore=clamp(y/6*100,0,100);
  const pbScore=pb>=.6&&pb<=1.6?100:pb<.6?65:clamp(100-(pb-1.6)*22,15,100);
  const liquidityScore=clamp(Math.log10(Math.max(value,1)/1e7)*38,0,100);
  const momentumScore=changePct>=0&&changePct<=3?80+changePct*6:changePct>-3&&changePct<0?75+changePct*12:changePct>3&&changePct<=5?70:30;
  return Math.round(peScore*.25+pbScore*.10+yieldScore*.25+liquidityScore*.25+momentumScore*.15);
}

function joinData(prices,values){
  const fundamentals=new Map(values.map(v=>[v.Code,v]));
  return prices.filter(p=>/^\d{4}$/.test(p.Code)).map(p=>{
    const f=fundamentals.get(p.Code)||{};
    const close=num(p.ClosingPrice),change=num(p.Change),previous=close-change;
    const stock={code:p.Code,name:p.Name,close,change,changePct:previous?change/previous*100:0,tradeValue:num(p.TradeValue),volume:num(p.TradeVolume),pe:num(f.PEratio),yield:num(f.DividendYield),pb:num(f.PBratio),date:f.Date||''};
    stock.score=scoreStock(stock); return stock;
  }).filter(s=>s.close>0&&s.pe>=4&&s.pe<=60&&s.pb>.1&&s.pb<=8&&s.tradeValue>=1e7&&s.yield>=0&&s.yield<=15).sort((a,b)=>b.score-a.score);
}

function reason(s){
  const points=[];
  if(s.pe<=18)points.push(`本益比 ${fmt(s.pe,1)} 倍`); else points.push('估值仍需確認');
  if(s.yield>=4)points.push(`殖利率 ${fmt(s.yield,1)}%`);
  if(s.tradeValue>=1e8)points.push('成交流動性佳');
  if(s.changePct>3)points.push('今日漲幅偏高勿追價'); else if(s.changePct>=0)points.push('價格動能溫和');
  return points.join(' · ');
}

function filtered(){
  const q=$('search').value.trim().toLowerCase(),minYield=+$('minYield').value,maxPe=+$('maxPe').value,minValue=+$('minLiquidity').value*1e6;
  return allStocks.filter(s=>(!q||s.code.includes(q)||s.name.toLowerCase().includes(q))&&s.yield>=minYield&&s.pe<=maxPe&&s.tradeValue>=minValue);
}

function render(){
  const list=filtered(); $('qualified').textContent=list.length;
  $('summary').textContent=list.length?`依目前條件選出 ${list.length} 檔；前三名仍需閱讀財報與重大訊息。`:'目前沒有股票通過你設定的條件。';
  $('leaders').innerHTML=list.slice(0,3).map((s,i)=>`<article class="leader"><div class="rank">0${i+1}</div><div class="ticker">TWSE · ${s.code}</div><h3>${s.name}</h3><div class="price">收盤 NT$ ${fmt(s.close)} · <span class="${s.change>=0?'positive':'negative'}">${s.change>=0?'+':''}${fmt(s.changePct)}%</span></div><div class="score">${s.score}<small> / 100 研究分數</small></div><div class="chips"><span class="chip">P/E ${fmt(s.pe,1)}</span><span class="chip">殖利率 ${fmt(s.yield,1)}%</span><span class="chip">P/B ${fmt(s.pb,1)}</span></div><p class="why">${reason(s)}</p></article>`).join('')||'<article class="leader empty">調整篩選條件以查看候選股票。</article>';
  $('ranking').innerHTML=list.slice(0,30).map((s,i)=>`<tr><td><div class="stock-cell"><span class="number">${String(i+1).padStart(2,'0')}</span><div><strong>${s.name}</strong><small>${s.code} · 上市</small></div></div></td><td><div class="bar"><i style="width:${s.score}%"></i></div><b>${s.score}</b></td><td>${fmt(s.close)}</td><td class="${s.change>=0?'positive':'negative'}">${s.change>=0?'+':''}${fmt(s.changePct)}%</td><td>${fmt(s.pe,1)}</td><td>${fmt(s.yield,1)}%</td><td>${fmt(s.pb,1)}</td><td class="verdict">${s.score>=78?'優先研究':s.score>=68?'加入觀察':'保留'}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">沒有符合條件的股票</td></tr>';
}

async function load(){
  $('refresh').disabled=true;$('refresh').textContent='更新中…';
  try{
    const [priceRes,valueRes]=await Promise.all([fetch(API+'STOCK_DAY_ALL.json',{cache:'no-store'}),fetch(API+'BWIBBU_ALL.json',{cache:'no-store'})]);
    if(!priceRes.ok||!valueRes.ok)throw new Error('TWSE request failed');
    const [prices,values]=await Promise.all([priceRes.json(),valueRes.json()]);
    allStocks=joinData(prices,values); $('universe').textContent=allStocks.length;
    $('asOf').textContent=`資料日期 ${rocDate(values[0]?.Date)}`; render();
  }catch(error){
    console.error('Unable to load market data:',error);
    $('asOf').textContent='資料載入失敗';
    $('summary').textContent='目前無法載入市場資料。請重新整理頁面或稍後再試。';
    $('leaders').innerHTML='<article class="leader empty">官方資料暫時無法取得；本頁不會用過期示範資料冒充今日排行。</article>';
    $('ranking').innerHTML='<tr><td colspan="8" class="empty">等待證交所資料</td></tr>';
  }finally{$('refresh').disabled=false;$('refresh').textContent='更新今日排行'}
}

['search','minYield','maxPe','minLiquidity'].forEach(id=>$(id).addEventListener('input',()=>{
  $('yieldOut').textContent=`${$('minYield').value}%`; $('peOut').textContent=$('maxPe').value;
  $('liquidityOut').textContent=`${+$('minLiquidity').value/100>=1?(+$('minLiquidity').value/100).toFixed(1)+'億':$('minLiquidity').value+'00萬'}`;
  render();
}));
$('refresh').addEventListener('click',load);load();
