// Data is mirrored by the GitHub Pages workflow because TWSE does not allow
// browser cross-origin requests from a static site.
const API='data/';
const $=id=>document.getElementById(id);
let allStocks=[];
const sourceHealth={twse:'loading',universe:'loading'};
const num=v=>Number(String(v??'').replaceAll(',',''));
const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function rocDate(s){
  if(!/^\d{7}$/.test(s||''))return s||'最新盤後資料';
  return `${Number(s.slice(0,3))+1911}/${s.slice(3,5)}/${s.slice(5)}`;
}

function rocIso(s){
  if(!/^\d{7}$/.test(s||''))return '';
  return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5)}`;
}

function daysSince(iso){
  const date=new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())?NaN:Math.floor((Date.now()-date.getTime())/864e5);
}

function updateDecisionStatus(){
  const hero=$('today'),freshness=$('decisionFreshness'),health=$('decisionHealth'),catalyst=$('nextCatalyst');
  if(!hero||!freshness||!health||!catalyst)return;
  const researchDate=hero.dataset.researchDate||'',age=daysSince(researchDate),stale=Number.isFinite(age)&&age>7;
  freshness.textContent=Number.isFinite(age)?`${researchDate.replaceAll('-','/')} · ${age===0?'今日':`${age} 天前`}`:'日期未標示';
  freshness.className=stale?'stale':'';
  document.body.classList.toggle('data-stale',stale);
  const healthy=Object.values(sourceHealth).filter(value=>value!=='loading'&&value!=='error').length;
  const errors=Object.values(sourceHealth).filter(value=>value==='error').length;
  health.textContent=errors?`${errors} 個來源載入失敗；暫停新訊號`:healthy===2?'2 / 2 官方資料來源正常':'正在核對官方資料';
  health.className=errors?'stale':healthy===2?'healthy':'';
  const eventDate=catalyst.dataset.eventDate||'',days=-daysSince(eventDate);
  if(Number.isFinite(days)&&days>=0)catalyst.textContent=`NVDA 財報 · ${days===0?'今天':`${days} 天後`}`;
  else if(Number.isFinite(days)){catalyst.textContent='NVDA 財報已公布 · 等待結果確認';document.querySelectorAll('[data-event-date]').forEach(element=>element.classList.add('event-expired'))}
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
  $('leaders').innerHTML=list.slice(0,3).map((s,i)=>`<article class="leader"><div class="rank">0${i+1}</div><div class="ticker">TWSE · ${s.code}</div><h3>${esc(s.name)}</h3><div class="price">收盤 NT$ ${fmt(s.close)} · <span class="${s.change>=0?'positive':'negative'}">${s.change>=0?'+':''}${fmt(s.changePct)}%</span></div><div class="score">${s.score}<small> / 100 研究分數</small></div><div class="chips"><span class="chip">P/E ${fmt(s.pe,1)}</span><span class="chip">殖利率 ${fmt(s.yield,1)}%</span><span class="chip">P/B ${fmt(s.pb,1)}</span></div><p class="why">${esc(reason(s))}</p></article>`).join('')||'<article class="leader empty">調整篩選條件以查看候選股票。</article>';
  $('ranking').innerHTML=list.slice(0,30).map((s,i)=>`<tr><td><div class="stock-cell"><span class="number">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(s.name)}</strong><small>${s.code} · 上市</small></div></div></td><td><div class="bar"><i style="width:${s.score}%"></i></div><b>${s.score}</b></td><td>${fmt(s.close)}</td><td class="${s.change>=0?'positive':'negative'}">${s.change>=0?'+':''}${fmt(s.changePct)}%</td><td>${fmt(s.pe,1)}</td><td>${fmt(s.yield,1)}%</td><td>${fmt(s.pb,1)}</td><td class="verdict">${s.score>=78?'優先研究':s.score>=68?'加入觀察':'保留'}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">沒有符合條件的股票</td></tr>';
}

async function load(force=false){
  $('refresh').disabled=true;$('refresh').textContent='更新中…';
  try{
    const cacheMode=force?'reload':'default';
    const [priceRes,valueRes]=await Promise.all([fetch(API+'STOCK_DAY_ALL.json',{cache:cacheMode}),fetch(API+'BWIBBU_ALL.json',{cache:cacheMode})]);
    if(!priceRes.ok||!valueRes.ok)throw new Error('TWSE request failed');
    const [prices,values]=await Promise.all([priceRes.json(),valueRes.json()]);
    allStocks=joinData(prices,values); $('universe').textContent=allStocks.length;
    sourceHealth.twse=rocIso(values[0]?.Date)||'available';
    $('asOf').textContent=`資料日期 ${rocDate(values[0]?.Date)}`; render();
  }catch(error){
    console.error('Unable to load market data:',error);
    sourceHealth.twse='error';
    $('asOf').textContent='資料載入失敗';
    $('summary').textContent='目前無法載入市場資料。請重新整理頁面或稍後再試。';
    $('leaders').innerHTML='<article class="leader empty">官方資料暫時無法取得；本頁不會用過期示範資料冒充今日排行。</article>';
    $('ranking').innerHTML='<tr><td colspan="8" class="empty">等待證交所資料</td></tr>';
  }finally{$('refresh').disabled=false;$('refresh').textContent='更新今日資料';updateDecisionStatus()}
}

['search','minYield','maxPe','minLiquidity'].forEach(id=>$(id).addEventListener('input',()=>{
  $('yieldOut').textContent=`${$('minYield').value}%`; $('peOut').textContent=$('maxPe').value;
  $('liquidityOut').textContent=`${+$('minLiquidity').value/100>=1?(+$('minLiquidity').value/100).toFixed(1)+'億':$('minLiquidity').value+'00萬'}`;
  render();
}));
$('refresh').addEventListener('click',()=>load(true));load();

const inputNum=id=>{const v=$(id)?.value;return v===''||v==null?NaN:Number(v)};
function updateRule40(){
  const total=inputNum('ruleGrowth')+inputNum('ruleFcf'),out=$('ruleResult');
  if(!out)return;
  out.textContent=Number.isFinite(total)?`${fmt(total,1)} · ${total>=40?'通過':'未通過'}`:'請輸入兩項數值';
  out.className=Number.isFinite(total)&&total>=40?'pass':'fail';
}
function updateTechnical(){
  const price=inputNum('techPrice'),ma20=inputNum('techMa20'),ma50=inputNum('techMa50'),stock=inputNum('techReturn'),benchmark=inputNum('techBenchmark'),volume=inputNum('techVolume'),rsi=inputNum('techRsi'),out=$('technicalResult');
  if(!out)return;
  if(![price,ma20,ma50,stock,benchmark,volume,rsi].every(Number.isFinite)||price<=0||ma20<=0||ma50<=0){out.textContent='輸入完整行情後計算';out.className='';return}
  let score=0;
  if(price>ma20)score+=20;if(ma20>ma50)score+=20;if(stock>benchmark)score+=20;if(volume>=1.2)score+=20;if(rsi>=45&&rsi<=70)score+=10;
  const extension=price/ma20;if(extension>=.98&&extension<=1.08)score+=10;
  out.textContent=`${score} / 100 · ${score>=70?'技術通過':score>=50?'中性':'不通過'}`;out.className=score>=70?'pass':score<50?'fail':'';
}
['ruleGrowth','ruleFcf'].forEach(id=>$(id)?.addEventListener('input',updateRule40));
['techPrice','techMa20','techMa50','techReturn','techBenchmark','techVolume','techRsi'].forEach(id=>$(id)?.addEventListener('input',updateTechnical));
updateRule40();

function updateMarketGate(){
  const cape=inputNum('marketCape'),eps=inputNum('marketEpsGrowth'),price=inputNum('marketPrice'),ma200=inputNum('marketMa200'),out=$('marketGateResult');
  if(!out)return;
  if(![cape,eps,price,ma200].every(Number.isFinite)||price<=0||ma200<=0||cape<0){out.textContent='請輸入完整且有效的數值';out.className='';return}
  const extension=price/ma200-1;
  let state='safe',text=`綠燈 · 趨勢向上，EPS 年增 ${fmt(eps,1)}%`,reason='趨勢與總體獲利正向；仍依個股失效條件控制部位。';
  if(price<ma200&&eps<0){
    state='danger';text=`紅燈 · 跌破 MA200，EPS 年增 ${fmt(eps,1)}%`;reason='趨勢與企業獲利同步轉弱：取消財報前押注，只保留現金與財報後確認。';
  }else{
    const reasons=[];
    if(cape>=35)reasons.push(`CAPE ${fmt(cape,1)}×`);
    if(extension>=.15)reasons.push(`高於 MA200 ${fmt(extension*100,1)}%`);
    if(eps<5)reasons.push(`EPS 年增僅 ${fmt(eps,1)}%`);
    if(reasons.length){state='warning';text=`黃燈 · ${reasons.join('、')}`;reason='獲利與長期趨勢仍正向；估值或乖離偏高，降低事件部位。'}
  }
  out.textContent=text;out.className=state;
  const homeCard=$('homeRegimeCard'),homeRegime=$('homeRegime'),homeReason=$('homeRegimeReason');
  if(homeCard&&homeRegime&&homeReason){homeCard.className=`regime-card ${state}`;homeRegime.textContent=state==='danger'?'紅燈':state==='warning'?'黃燈':'綠燈';homeReason.textContent=reason}
  document.body.classList.toggle('market-red',state==='danger');
}
['marketCape','marketEpsGrowth','marketPrice','marketMa200'].forEach(id=>$(id)?.addEventListener('input',updateMarketGate));
updateMarketGate();

function updatePerformanceGate(){
  const months=inputNum('perfMonths'),strategy=inputNum('perfStrategy'),benchmark=inputNum('perfBenchmark'),cost=inputNum('perfCost'),drawdown=inputNum('perfDrawdown'),oos=$('perfOos')?.value==='yes',out=$('performanceResult'),badge=$('performanceBadge');
  if(!out||!badge)return;
  if(![months,strategy,benchmark,cost,drawdown].every(Number.isFinite)){out.textContent='請輸入完整數值';out.className='';return}
  const netAlpha=strategy-benchmark-cost,reasons=[];
  if(months<36)reasons.push(`樣本僅 ${months} 個月`);
  if(netAlpha<=0)reasons.push(`扣成本後超額報酬 ${fmt(netAlpha,1)}%`);
  if(drawdown>15)reasons.push(`最大回撤 ${fmt(drawdown,1)}%`);
  if(!oos)reasons.push('尚未完成樣本外測試');
  const pass=reasons.length===0;
  badge.textContent=pass?'VALIDATED INPUT':'NOT VALIDATED';badge.className=`validation-badge${pass?' pass':''}`;
  out.textContent=pass?`通過輸入門檻 · 扣成本後 Alpha ${fmt(netAlpha,1)}%`:`尚未驗證 · ${reasons.join('；')}`;
  out.className=pass?'pass':'';
}
['perfMonths','perfStrategy','perfBenchmark','perfCost','perfDrawdown','perfOos'].forEach(id=>$(id)?.addEventListener('input',updatePerformanceGate));
updatePerformanceGate();
updateDecisionStatus();

let allSoftware=[];
let softwareLimit=25;

function renderSoftwareUniverse(){
  const body=$('softwareUniverseRows'),coverage=$('softwareCoverage');
  if(!body||!coverage)return;
  const query=$('softwareSearch')?.value.trim().toLowerCase()||'',region=$('softwareRegion')?.value||'all';
  const list=allSoftware.filter(item=>(region==='all'||item.region===region)&&(!query||item.ticker.toLowerCase().includes(query)||item.name.toLowerCase().includes(query)));
  const visible=list.slice(0,softwareLimit),showMore=$('softwareShowMore');
  coverage.textContent=`顯示 ${visible.length} / 符合 ${list.length} / 母體 ${allSoftware.length}`;
  body.innerHTML=visible.map(item=>`<tr><td>${esc(item.ticker)}</td><td><strong>${esc(item.name)}</strong></td><td>${esc(item.market)}</td><td>${esc(item.source)}</td><td>母體涵蓋；待基本面評分</td></tr>`).join('')||'<tr><td colspan="5" class="empty">沒有符合搜尋條件的公司</td></tr>';
  if(showMore){showMore.hidden=visible.length>=list.length;showMore.textContent=`再顯示 ${Math.min(25,list.length-visible.length)} 檔`}
}

async function loadSoftwareUniverse(){
  const body=$('softwareUniverseRows'),coverage=$('softwareCoverage');
  if(!body||!coverage)return;
  try{
    const universeRes=await fetch(API+'software-universe.json',{cache:'default'});
    if(!universeRes.ok)throw new Error('Software universe request failed');
    const payload=await universeRes.json();
    if(!Array.isArray(payload.items)||payload.items.length<50)throw new Error('Software universe is incomplete');
    const seen=new Set();
    allSoftware=payload.items.map(item=>({ticker:String(item.ticker||'').trim(),name:String(item.name||'').trim(),region:String(item.region||'').trim(),market:String(item.market||'').trim(),source:String(item.source||'').trim()})).filter(item=>item.ticker&&item.name&&!seen.has(`${item.region}:${item.ticker}`)&&seen.add(`${item.region}:${item.ticker}`));
    sourceHealth.universe=String(payload.as_of||'available');
    coverage.title=`資料日期 ${String(payload.as_of||'未標示')}`;
    renderSoftwareUniverse();
  }catch(error){
    console.error('Unable to load software universe:',error);
    sourceHealth.universe='error';
    coverage.textContent='官方母體載入失敗';
    body.innerHTML='<tr><td colspan="5" class="empty">官方母體目前無法載入；本頁不以舊清單冒充完整掃描。</td></tr>';
  }finally{updateDecisionStatus()}
}
['softwareSearch','softwareRegion'].forEach(id=>$(id)?.addEventListener('input',()=>{softwareLimit=25;renderSoftwareUniverse()}));
$('softwareShowMore')?.addEventListener('click',()=>{softwareLimit+=25;renderSoftwareUniverse()});
loadSoftwareUniverse();
