'use strict';
/**
 * Read-only bridge to a separately authenticated market-data server.
 * NEVER place Bullex credentials or feed tokens in client-side files.
 * The connected source must be audited before enabling paid subscriptions.
 */
module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  const target=process.env.XTREME_FEED_URL;
  const token=process.env.XTREME_FEED_TOKEN;
  // Commercial accounts must be protected by verified Supabase sessions
  // BEFORE enabling this route in production. This is a non-commercial preview.
  if(!target||!token)return res.status(503).json({ok:false,error:'FEED_NOT_CONFIGURED'});
  let url;
  try{url=new URL(target);if(url.protocol!=='https:')throw Error('HTTPS_REQUIRED')}catch(_){return res.status(503).json({ok:false,error:'INVALID_FEED_CONFIGURATION'})}
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),5000);
  try{
    const upstream=await fetch(url.toString(),{
      method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
      signal:abort.signal,redirect:'error',cache:'no-store'
    });
    if(!upstream.ok)return res.status(503).json({ok:false,error:'FEED_UNAVAILABLE'});
    const text=await upstream.text();
    if(text.length>200000)throw Error('PAYLOAD_TOO_LARGE');
    const data=JSON.parse(text);
    const now=Date.now();
    const feedTs=typeof data.feed_ts==='number'?(data.feed_ts<1e11?data.feed_ts*1000:data.feed_ts):NaN;
    if(data.source!=='BULLEX_PRACTICE'||data.verified!==true||!Number.isFinite(feedTs)||Math.abs(now-feedTs)>12000){
      return res.status(503).json({ok:false,error:'FEED_NOT_VERIFIED_OR_STALE'});
    }
    const asset=v=>typeof v==='string'&&v.length<=34&&/^[\w\p{L} ./()+-]+$/u.test(v)?v:null;
    const timestamp=v=>typeof v==='number'&&Number.isFinite(v)?v:(typeof v==='string'&&!Number.isNaN(Date.parse(v))?v:null);
    const liveAssets=Array.isArray(data.assets)?data.assets.map(asset).filter(Boolean).slice(0,200):[];
    const history=Array.isArray(data.history)?data.history.slice(-80).reverse().map(s=>({
      id:typeof s.id==='string'?s.id.slice(0,80):null,
      asset:asset(s.asset),direction:['CALL','PUT'].includes(s.direction)?s.direction:null,
      entry_at:timestamp(s.entry_at),expires_at:timestamp(s.expires_at),
      result:['WIN','LOSS','DRAW'].includes(s.result)?s.result:'PENDING'
    })).filter(s=>s.asset&&s.direction&&s.entry_at&&s.expires_at).slice(0,30):[];
    let signal=null;
    if(data.signal&&typeof data.signal==='object'){
      const s=data.signal;
      if(asset(s.asset)&&['CALL','PUT'].includes(s.direction)&&['scheduled','open','pending','closed'].includes(s.status)&&timestamp(s.entry_at)&&timestamp(s.expires_at)){
        signal={id:typeof s.id==='string'?s.id.slice(0,100):null,
          asset:asset(s.asset),direction:s.direction,status:s.status,entry_at:timestamp(s.entry_at),
          expires_at:timestamp(s.expires_at)};
      }
    }
    const candles=Array.isArray(data.candles)?data.candles.slice(-45).map(c=>{
      if(!c||typeof c!=='object')return null;
      const open=Number(c.open),high=Number(c.high),low=Number(c.low),close=Number(c.close);
      if(![open,high,low,close].every(Number.isFinite)||low>Math.min(open,close)||high<Math.max(open,close)||high<low)return null;
      return {open,high,low,close,time:timestamp(c.time),closed:c.closed===true};
    }).filter(c=>c&&c.time):[];
    return res.status(200).json({
      ok:true,source:'BULLEX_PRACTICE',verified:true,feed_ts:data.feed_ts,server_now:now/1000,
      current_asset:asset(data.current_asset),assets:liveAssets,signal,history,candles
    });
  }catch(_){
    return res.status(503).json({ok:false,error:'FEED_UNAVAILABLE'});
  }finally{clearTimeout(timeout)}
};
