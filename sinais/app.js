'use strict';
/**
 * XTREME SNIPER — commercial preview frontend
 * No fictitious broker data, win/loss or trading execution exists in this client.
 * A separately deployed authenticated read-only feed must expose /api/public-state.
 */
const $ = id => document.getElementById(id);
const settingsKey='xtreme_sniper_preferences_v1';
const defaults={asset:'all',expiry:'M1',strategy:'all',sound:false};
let prefs={...defaults};
try{prefs={...defaults,...JSON.parse(localStorage.getItem(settingsKey)||'{}')}}catch(_){}
let feed=null,feedReceivedAt=0,polling=false,lastSounded='',modalOpen=false;
const timeFmt=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const symbolRe=/^[\p{L}\p{N}_./()+\- ]{1,34}$/u;
const safeAsset=value=>typeof value==='string'&&symbolRe.test(value)?value:'—';
function getMs(value){const n=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(n))return NaN;return typeof value==='number'?(n<1e11?n*1000:n):n}
function stamp(value){const ms=getMs(value);return Number.isFinite(ms)?timeFmt.format(new Date(ms)):'--:--:--'}
function setText(id,value){$(id).textContent=String(value)}
function setConnection(online,details=''){
  $('connectionTag').classList.toggle('live',online);
  setText('connectionLabel',online?'FEED AUTENTICADO':'SEM CONEXÃO BULLEX');
  setText('settingsConnection',online?'FEED RECEBIDO':'FONTE NÃO CONECTADA');
  setText('settingsConnectionDetail',details||'A interface não solicita senha da corretora.');
  if(!online){setText('selectedAsset','—');setText('wins','—');setText('losses','—');setText('accuracy','—');setText('nextCandle','—');setText('historyCount','0 REGISTROS');$('historyRows').replaceChildren(emptyRow('Nenhum resultado validado disponível.'))}
}
function emptyRow(message){const row=document.createElement('tr');row.className='no-records';const td=document.createElement('td');td.colSpan=5;td.textContent=message;row.appendChild(td);return row}
function setPhase(title,detail,active=false){setText('statusTitle',title);setText('statusDescription',detail);$('statusSpinner').classList.toggle('offline',!active)}
function cleanFeed(){
  feed=null;feedReceivedAt=0;setConnection(false,'Sem dados da Bullex validados pelo servidor.');
  setPhase('AGUARDANDO FONTE','Conexão de candles ainda não configurada',false);
  $('signalOverlay').hidden=true;
  drawCandles();
  setText('feedDisclaimer','Sem integração confirmada: não exibimos candles, resultados ou sinais fictícios.');
}
function validFeed(data){
  if(!data||data.ok!==true||data.source!=='BULLEX_PRACTICE'||data.verified!==true)return false;
  const ms=getMs(data.feed_ts);
  return Number.isFinite(ms)&&Math.abs(Date.now()-ms)<15000&&Array.isArray(data.assets)&&Array.isArray(data.history);
}
function fillAssets(assets){
  const select=$('assetSelect'),list=assets.filter(x=>typeof x==='string'&&symbolRe.test(x)).slice(0,200);
  const current=[...select.options].slice(1).map(o=>o.value);
  if(current.length===list.length&&current.every((s,i)=>s===list[i]))return;
  select.replaceChildren(new Option('Todos os ativos disponíveis','all'));
  for(const asset of list)select.add(new Option(asset,asset));
  if(prefs.asset!=='all'&&!list.includes(prefs.asset))prefs.asset='all';
  select.value=prefs.asset;
}
function selectedSignal(){
  const s=feed?.signal;
  if(!s||typeof s!=='object')return null;
  if(!['CALL','PUT'].includes(s.direction)||safeAsset(s.asset)==='—')return null;
  if(!['scheduled','open','pending','closed'].includes(s.status))return null;
  if(prefs.asset!=='all'&&s.asset!==prefs.asset)return null;
  if(prefs.strategy!=='all'&&s.strategy!==prefs.strategy)return null;
  const e=getMs(s.entry_at),x=getMs(s.expires_at);
  if(!Number.isFinite(e)||!Number.isFinite(x)||x<=e||x-e>900000)return null;
  if(feed?.source!=='BULLEX_PRACTICE')return null;
  return {...s,entryMs:e,expiryMs:x};
}
function showOverlay(signal,now){
  const overlay=$('signalOverlay');overlay.hidden=false;overlay.classList.toggle('put',signal.direction==='PUT');
  setText('signalDirection',signal.direction);setText('signalAsset',signal.asset);
  setText('signalEntry',stamp(signal.entry_at));setText('signalExpiry',stamp(signal.expires_at));
  const msRemaining=signal.expiryMs-now,secs=Math.max(0,Math.ceil(msRemaining/1000));
  setText('signalCountdown',String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0'));
  if(signal.status==='closed'){setText('signalOverline','OPERAÇÃO ENCERRADA');setPhase('CONFERINDO RESULTADO','Resultado informado pela fonte',true)}
  else if(now<signal.entryMs){setText('signalOverline','ENTRADA NA PRÓXIMA VELA');setPhase('SINAL IDENTIFICADO','Aguardando horário da entrada',true)}
  else if(now<signal.expiryMs){setText('signalOverline','SINAL EM ANDAMENTO');setPhase('ACOMPANHANDO SINAL','Aguardando o fechamento da operação',true)}
  else{setText('signalOverline','AGUARDANDO RESULTADO');setPhase('CONFERINDO RESULTADO','Sem inventar WIN ou LOSS enquanto não for confirmado',true)}
  if(signal.status==='closed'&&now>signal.expiryMs+4000){
    overlay.hidden=true;
    setPhase('ANALISANDO','Operação encerrada; leitura retomada',true);
  }
  if(signal.id&&signal.id!==lastSounded&&prefs.sound&&signal.status==='scheduled'&&now<signal.expiryMs){
    lastSounded=signal.id;ping();
  }
}
function ping(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(740,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(1040,ctx.currentTime+.14);gain.gain.setValueAtTime(.06,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.24);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25);osc.onended=()=>ctx.close()}catch(_){}}

function drawCandles(){
  const canvas=$('marketCanvas');
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  const dpi=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.floor(rect.width*dpi);canvas.height=Math.floor(rect.height*dpi);
  const ctx=canvas.getContext('2d');ctx.scale(dpi,dpi);
  ctx.clearRect(0,0,rect.width,rect.height);
  // No candle is drawn until the authenticated feed supplied real OHLC.
  const bars=Array.isArray(feed?.candles)?feed.candles.slice(-34).filter(c=>c&&
    [c.open,c.high,c.low,c.close].every(x=>typeof x==='number'&&Number.isFinite(x))):[];
  if(!bars.length)return;
  const min=Math.min(...bars.map(x=>x.low)),max=Math.max(...bars.map(x=>x.high)),span=max-min||.001;
  const low=min-span*.12,high=max+span*.12;
  const y=v=>rect.height-(v-low)/(high-low)*rect.height;
  const slot=rect.width/bars.length,bodyWidth=Math.max(3,Math.min(slot*.55,12));
  ctx.lineWidth=1;
  for(let i=0;i<bars.length;i++){
    const b=bars[i],x=slot*(i+.5),up=b.close>=b.open;
    const col=up?'#22edc3':'#ff638e';
    ctx.globalAlpha=b.closed===false?.8:.65;ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.beginPath();ctx.moveTo(x,y(b.high));ctx.lineTo(x,y(b.low));ctx.stroke();
    ctx.fillRect(x-bodyWidth/2,Math.min(y(b.open),y(b.close)),bodyWidth,Math.max(2,Math.abs(y(b.open)-y(b.close))));
  }
  ctx.globalAlpha=1;
}

function updateHistory(){
  const entries=feed.history.filter(x=>x&&typeof x==='object'&&(prefs.asset==='all'||x.asset===prefs.asset)&&(prefs.strategy==='all'||x.strategy===prefs.strategy)).slice(0,30);
  const body=$('historyRows');body.replaceChildren();
  if(!entries.length){body.appendChild(emptyRow('Nenhum resultado validado disponível.'));setText('historyCount','0 REGISTROS');return}
  for(const item of entries){
    const tr=document.createElement('tr'),cells=[stamp(item.entry_at),safeAsset(item.asset),['CALL','PUT'].includes(item.direction)?item.direction:'—',stamp(item.expires_at),['WIN','LOSS','DRAW'].includes(item.result)?item.result:'PENDENTE'];
    for(let i=0;i<cells.length;i++){const td=document.createElement('td');td.textContent=cells[i];if(i===2)td.className='direction-'+String(cells[i]).toLowerCase();if(i===4)td.className='result-'+String(cells[i]).toLowerCase();tr.appendChild(td)}
    body.appendChild(tr);
  }
  setText('historyCount',entries.length+' REGISTROS');
}
function updateScore(){
  const h=feed.history.filter(x=>x&&typeof x==='object'&&(prefs.asset==='all'||x.asset===prefs.asset)&&(prefs.strategy==='all'||x.strategy===prefs.strategy));
  const wins=h.filter(x=>x.result==='WIN').length,losses=h.filter(x=>x.result==='LOSS').length,completed=h.filter(x=>['WIN','LOSS','DRAW'].includes(x.result)).length;
  setText('wins',wins);setText('losses',losses);setText('accuracy',completed?((wins/completed)*100).toFixed(1).replace('.',',')+'%':'—');
}
function tick(){
  if(!feed||Date.now()-feedReceivedAt>10000){if(feed)cleanFeed();return}
  const serverBase=getMs(feed.server_now),now=(Number.isFinite(serverBase)?serverBase:Date.now())+(Date.now()-feedReceivedAt);
  const next=Math.ceil(now/60000)*60000;
  const seconds=Math.max(0,Math.ceil((next-now)/1000));setText('nextCandle','00:'+String(seconds%60).padStart(2,'0'));
  const sig=selectedSignal();
  if(sig){showOverlay(sig,now);return}
  $('signalOverlay').hidden=true;setPhase('ANALISANDO','Monitorando candles da fonte autenticada',true);
}
function applyFeed(data){
  feed=data;feedReceivedAt=Date.now();setConnection(true,'Fonte recebida; confirmação final da integridade depende do operador da integração.');
  fillAssets(feed.assets);drawCandles();
  const active=prefs.asset==='all'?safeAsset(feed.current_asset):safeAsset(prefs.asset);
  setText('selectedAsset',active);
  setText('timeframeLabel',prefs.strategy==='xtreme'?'M5 → M1':'M1');
  setText('strategyMode',prefs.strategy==='xtreme'?'M5 CONFIRMA':'M1 ANALISA');
  updateHistory();updateScore();setText('feedDisclaimer','Os sinais e resultados exibidos foram recebidos do servidor. Consulte a metodologia e a origem dos candles.');
  tick();
}
async function poll(){
  if(polling)return;polling=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
  try{
    const res=await fetch('/api/public-state',{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('feed unavailable');
    const data=await res.json();
    if(!validFeed(data))throw Error('feed not verifiable');
    applyFeed(data);
  }catch(e){cleanFeed()}finally{clearTimeout(timeout);polling=false}
}
function openSettings(){
  modalOpen=true;$('settingsBackdrop').hidden=false;$('settingsPanel').classList.add('open');$('settingsPanel').setAttribute('aria-hidden','false');$('closeSettings').focus();
}
function closeSettings(){
  modalOpen=false;$('settingsBackdrop').hidden=true;$('settingsPanel').classList.remove('open');$('settingsPanel').setAttribute('aria-hidden','true');$('openSettings').focus();
}
function saveSettings(){
  prefs.asset=$('assetSelect').value;prefs.expiry=$('expirySelect').value;
  prefs.strategy=$('strategySelect').value;prefs.sound=$('soundToggle').checked;
  try{localStorage.setItem(settingsKey,JSON.stringify(prefs))}catch(_){}
  if(feed){setText('selectedAsset',prefs.asset==='all'?safeAsset(feed.current_asset):safeAsset(prefs.asset));setText('timeframeLabel',prefs.strategy==='xtreme'?'M5 → M1':'M1');setText('strategyMode',prefs.strategy==='xtreme'?'M5 CONFIRMA':'M1 ANALISA');updateHistory();updateScore();tick()}
  closeSettings();
}
$('openSettings').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',closeSettings);
$('settingsBackdrop').addEventListener('click',closeSettings);
$('saveSettings').addEventListener('click',saveSettings);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen)closeSettings()});
$('expirySelect').value=['M1','M2','M5'].includes(prefs.expiry)?prefs.expiry:'M1';
$('strategySelect').value=['all','scalper_m1','xtreme'].includes(prefs.strategy)?prefs.strategy:'all';$('soundToggle').checked=Boolean(prefs.sound);
window.addEventListener('resize',drawCandles);
cleanFeed();void poll();setInterval(poll,3000);setInterval(tick,500);
