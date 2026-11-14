export const COVER_DEFAULTS=Object.freeze({reach:25,use:50,gain:40,years:20});
export const COVER_KEYS=Object.keys(COVER_DEFAULTS);
export function readCoverCase(search){
 const p=new URLSearchParams(search);
 if(!COVER_KEYS.some(k=>p.has('case_'+k)))return null;
 const result={};
 for(const k of COVER_KEYS){
  const raw=p.get('case_'+k),v=Number(raw);
  if(raw===null||raw.trim()===''||!Number.isFinite(v)||v< (k==='years'?1:0)||v>100||(k==='years'&&!Number.isInteger(v)))return null;
  result[k]=v;
 }
 return result;
}
export function caseURL(url,settings){
 const next=new URL(url);
 for(const k of COVER_KEYS)next.searchParams.set('case_'+k,String(settings[k]));
 return next;
}
export function clearCaseURL(url){const next=new URL(url);for(const k of COVER_KEYS)next.searchParams.delete('case_'+k);return next;}
export function coverMacro(c){return {capturePercent:c.reach,adoptionPercent:c.use,localGainPercent:c.gain};}
