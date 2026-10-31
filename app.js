"use strict";
const SLOTS = [["08:05","08:55"],["08:55","09:45"],["10:00","10:50"],["10:55","11:45"],["11:50","12:40"],["12:50","13:40"],["13:45","14:35"],["14:40","15:30"],["15:35","16:25"],["16:30","17:20"]];
const DAYN = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const KIND = {schularbeit:"Schularbeit",test:"Test",pruefung:"Test",termin:"Termin"};
const $ = id => document.getElementById(id);
let CFG = {}, KLASSEN = [], KLASSE = "", TT = null, ALL_EVENTS = [], EVENTS = [], STAND = null;
let monday, dayIdx;

function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return addDays(x,-((x.getDay()+6)%7)); }
function fmt(s){ const [y,m,d]=s.split("-"); return d+"."+m+"."; }
function esc(s){ return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function slotIndex(t){ let i=SLOTS.findIndex(s=>s[0]===t); if(i<0) i=SLOTS.findIndex(s=>s[0]>t)-1; return Math.max(i,0); }
function slotEnd(t){ let i=SLOTS.findIndex(s=>s[1]===t); if(i<0) i=SLOTS.findIndex(s=>s[1]>t); return i<0?SLOTS.length-1:i; }
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

function goToday(){ const n=new Date(); monday=mondayOf(n); dayIdx=Math.min(Math.max(n.getDay()-1,0),4); if(n.getDay()===0||n.getDay()===6){ monday=addDays(monday,7); dayIdx=0; } }
goToday();

function saSubjects(){ const m=CFG.schularbeitsfaecher||{}; return new Set(m[KLASSE]||m.standard||[]); }
function normKind(e){ const a=String(e.art||"").toLowerCase();
  if(a.startsWith("schul")) return "schularbeit"; if(a.startsWith("test")) return "test";
  if(a.startsWith("termin")||a.startsWith("event")) return "termin";
  if(e.fach) return saSubjects().has(e.fach)?"schularbeit":"test";
  return "termin"; }

const L = x => { const a=String(x).split("|"); a[5]=+a[5]; a[6]=+a[6]; return a; };
function dayData(ds){ if(!TT||!TT.days||!TT.days[ds]) return null; const d=TT.days[ds]; return {h:(d.h||[]).map(L), g:(d.g||[]).map(L)}; }
function parsePos(str, dict){ return (str||"").split(",").filter(Boolean).map(p=>{ let st=""; if(/^[A-Z]:/.test(p)){ st=p[0]; p=p.slice(2); } const [cur,rem]=p.split("~"); return {cur, rem, st, long:(dict||{})[cur]||cur}; }); }

function periodsOf(str){ const n=(String(str||"").match(/\d+/g)||[]).map(Number).filter(x=>x>=1&&x<=SLOTS.length); if(!n.length) return null; const a=Math.min(...n), b=Math.max(...n); const r=[]; for(let i=a;i<=b;i++) r.push(i); return r; }
function codesOf(e){ const c=new Set(); if(e.fach) c.add(e.fach); if(TT&&e.titel){ Object.keys(TT.dict.su).forEach(k=>{ if(new RegExp("(^|[^A-Za-zÄÖÜäöü])"+k+"($|[^A-Za-zÄÖÜäöü])").test(e.titel)) c.add(k); }); } return c; }
function lessonSubs(l){ return String(l[7]||"").split(",").map(x=>x.replace(/^[A-Z]:/,"").split("~")[0]); }
function eventsOn(ds){ return EVENTS.filter(e=>e.datum===ds).sort((a,b)=>String(a.stunden||"").localeCompare(String(b.stunden||""))); }
function evWhat(e){ return e.titel || (TT&&TT.dict.su[e.fach]) || e.fach || ""; }

// Mit Stundenangabe: diese Stunden werden komplett übernommen. Ohne: Stunde des Fachs. Sonst ganztägig.
function placeEvents(ds, lessons){
  const perEv=[], subj=new Map(), allday=[];
  eventsOn(ds).forEach(ev=>{
    const per=periodsOf(ev.stunden), codes=codesOf(ev);
    if(per && lessons.length){ perEv.push(Object.assign({_per:per},ev)); return; }
    let hit=false;
    if(codes.size){ const m=lessons.filter(l=>lessonSubs(l).some(x=>codes.has(x)));
      const full=m.filter(l=>+l[6]>=1000 && l[3]!=="CANCELLED"); const pick=(full.length?full:m.filter(l=>l[3]!=="CANCELLED")).slice(0,1);
      (pick.length?pick:m.slice(0,1)).forEach(l=>{ const k=l.join("|"); if(!subj.has(k)) subj.set(k,[]); subj.get(k).push(ev); hit=true; }); }
    if(!hit) allday.push(ev);
  });
  return {perEv, subj, allday};
}
function overlayHTML(e, replaced){
  const rep=(replaced||[]).filter(l=>!lessonSubs(l).some(x=>codesOf(e).has(x)));
  const statt = rep.length ? "statt "+rep.map(l=>{ const t=String(l[8]||"").replace(/^[A-Z]:/,"").split("~")[0]; const tn=TT.dict.te[t]; return lessonSubs(l).join("/")+(tn?" ("+tn.split(" ")[0]+")":""); }).join(", ")+" entfällt" : "";
  const info=[e.stunden?e.stunden+" Std.":"", e.notiz].filter(Boolean).join(" · ");
  return `<button class="ov" data-k="${esc(e.art)}" data-id="${esc(e.id)}"><span class="k">${esc(KIND[e.art]||"Eintrag")}${e.unsicher?" ⚠":""}</span><span class="w">${esc(evWhat(e))}</span>${info?`<span class="x">${esc(info)}</span>`:""}${statt?`<span class="x">${esc(statt)}</span>`:""}</button>`;
}
function lessonHTML(e){
  const [s,en,type,status,detail,,,su,te,ro] = e;
  const subs=parsePos(su,TT.dict.su), tes=parsePos(te,TT.dict.te), ros=parsePos(ro,TT.dict.ro);
  let cls="", tag="";
  if(status==="CANCELLED"){ cls="cancelled"; tag= detail==="MOVED"?"verlegt":"Entfall"; }
  else if(status==="CHANGED"){ cls="changed"; tag="Vertretung"; }
  else if(status==="ADDITIONAL"){ cls="additional"; tag= detail==="MOVED"?"verlegt hierher":"Zusatz"; }
  const sub=subs.map(x=>esc(x.cur)).join(" / ");
  const tee=tes.map(x=>esc(x.long)+(x.rem?` <del>${esc(TT.dict.te[x.rem]||x.rem)}</del>`:"")).join(", ");
  const roo=ros.map(x=>esc(x.long)+(x.rem?` <del>${esc(TT.dict.ro[x.rem]||x.rem)}</del>`:"")).join(", ");
  return `<div class="les ${cls}" title="${esc(subs.map(x=>x.long).join(" / "))}"><div class="s">${sub}</div><div class="te">${tee}</div><div class="r">${roo}</div>${tag?`<span class="tag">${tag}</span>`:""}</div>`;
}
function evButton(e){ return `<button class="evc" data-k="${esc(e.art)}" data-id="${esc(e.id)}"><b>${esc(KIND[e.art]||"")}</b> ${esc(evWhat(e))}${e.stunden?` <span class="st">${esc(e.stunden)} Std.</span>`:""}${e.unsicher?" ⚠":""}</button>`; }
function holidayChips(dd){ if(!dd||!dd.g.length) return ""; return dd.h.filter(h=>h[0]==="HOLIDAY").map(h=>`<span class="evc" data-k="termin">${esc(h[2])}</span>`).join(""); }

function render(){
  const days=[0,1,2,3,4].map(i=>addDays(monday,i));
  $("range").textContent = fmt(iso(days[0]))+" – "+fmt(iso(days[4]))+days[4].getFullYear();
  const narrow = matchMedia("(max-width:760px)").matches;
  const todayS = iso(new Date());
  $("tabs").innerHTML = days.map((d,i)=>{ const ds=iso(d); const has=eventsOn(ds).some(e=>e.art!=="termin");
    return `<button class="tab" role="tab" aria-selected="${i===dayIdx}" data-i="${i}">${DAYN[d.getDay()]}<small>${fmt(ds)}</small>${has?'<span class="dot"></span>':""}</button>`; }).join("");
  const show = narrow ? [days[dayIdx]] : days;
  const g=$("grid"); g.style.setProperty("--cols", show.length);
  const place={}, dds={};
  show.forEach(d=>{ const ds=iso(d); dds[ds]=dayData(ds); place[ds]=placeEvents(ds, dds[ds]?dds[ds].g:[]); });
  const hasAD = show.some(d=>place[iso(d)].allday.length);
  const O = hasAD?3:2;
  let html = `<div class="hd"></div>`;
  show.forEach(d=>{ const ds=iso(d), hc=holidayChips(dds[ds]);
    html += `<div class="hd${ds===todayS?" today":""}"><div class="dn">${DAYN[d.getDay()]}<small>${fmt(ds)}</small></div>${hc?`<div class="ev">${hc}</div>`:""}</div>`; });
  if(hasAD){ html += `<div class="tm ad" style="grid-row:2;grid-column:1"><b>Ganzer Tag</b></div>`;
    show.forEach((d,ci)=>{ html += `<div class="allday" style="grid-row:2;grid-column:${ci+2}">${place[iso(d)].allday.map(evButton).join("")}</div>`; }); }
  SLOTS.forEach((s,i)=>{ html += `<div class="tm" style="grid-row:${i+O};grid-column:1"><b>${i+1}.</b>${s[0]}</div>`; });
  show.forEach((d,ci)=>{ const ds=iso(d), col=ci+2, dd=dds[ds], P=place[ds];
    if(!dd){ html += `<div class="free" style="grid-column:${col};grid-row:${O} / span ${SLOTS.length}">${TT?"Keine Stundenplandaten":"Wird beim nächsten Abgleich geladen"}</div>`; return; }
    const holiday=dd.h.filter(h=>h[0]==="HOLIDAY");
    if(holiday.length && !dd.g.length){ const name=[...new Set(holiday.map(h=>h[2]))].filter(n=>!/^Ferien\d/.test(n)).join(" · ")||"Schulfrei";
      html += `<div class="free" style="grid-column:${col};grid-row:${O} / span ${SLOTS.length}">${esc(name)}</div>`; return; }
    const groups={}; dd.g.forEach(e=>{ const k=e[0]+"-"+e[1]; (groups[k]=groups[k]||[]).push(e); });
    const used=new Set();
    Object.values(groups).forEach(arr=>{ const a=slotIndex(arr[0][0]), b=slotEnd(arr[0][1]);
      arr.sort((x,y)=>x[5]-y[5]); for(let r=a;r<=b;r++) used.add(r);
      const hit=P.perEv.filter(ev=>ev._per.some(x=>x>=a+1&&x<=b+1));
      const sh=[...new Set(arr.flatMap(l=>P.subj.get(l.join("|"))||[]))];
      const inner = hit.length ? hit.map(ev=>overlayHTML(ev,arr)).join("") : sh.length ? sh.map(ev=>overlayHTML(ev,arr)).join("") : arr.map(lessonHTML).join("");
      html += `<div class="cell" style="grid-column:${col};grid-row:${a+O} / ${b+O+1}">${inner}</div>`; });
    SLOTS.forEach((s,r)=>{ if(used.has(r)) return; const hit=P.perEv.filter(ev=>ev._per.includes(r+1));
      html += `<div class="cell" style="grid-column:${col};grid-row:${r+O}">${hit.map(ev=>overlayHTML(ev,[])).join("")}</div>`; });
  });
  g.innerHTML = html;
  const up = EVENTS.filter(e=>e.datum>=todayS).sort((a,b)=>a.datum.localeCompare(b.datum)).slice(0,12);
  $("strip").innerHTML = up.length ? up.map(e=>`<button class="chip" data-k="${esc(e.art)}" data-id="${esc(e.id)}"><span class="d">${DAYN[new Date(e.datum+"T12:00:00").getDay()]} ${fmt(e.datum)}${e.stunden?" · "+esc(e.stunden)+" Std.":""}</span><span class="t">${esc(KIND[e.art]||"")} ${esc(evWhat(e))}</span></button>`).join("")
    : `<span class="status">Keine kommenden Einträge für diese Klasse.</span>`;
  const note=(CFG.hinweise||{})[KLASSE]||""; $("notesSec").hidden=!note; $("notes").textContent=note;
  const st = (STAND&&STAND.letzterAbgleich) || (TT&&TT.updatedAt);
  $("updated").textContent = st ? "Stundenplan aus WebUntis, zuletzt abgeglichen "+new Date(st).toLocaleString("de-AT",{dateStyle:"medium",timeStyle:"short"})+". Bei Abweichungen gilt WebUntis." : "";
}

function showDetail(e){
  if(!e) return;
  $("dTitle").textContent = (KIND[e.art]||"Eintrag")+" · "+evWhat(e);
  const rows=[["Datum",DAYN[new Date(e.datum+"T12:00:00").getDay()]+", "+fmt(e.datum)+e.datum.slice(0,4)],["Stunde",e.stunden?e.stunden+" Stunde":"ganzer Tag / laut Fach"],["Fach",e.fach?(TT&&TT.dict.su[e.fach]?TT.dict.su[e.fach]+" ("+e.fach+")":e.fach):""],["Notiz",e.notiz]].filter(r=>r[1]);
  $("dBody").innerHTML = rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("");
  $("dWarn").hidden=!e.unsicher; $("scrim").hidden=false; $("dClose").focus();
}

document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-id]"); if(t){ showDetail(EVENTS.find(e=>e.id===t.dataset.id)); return; }
  const tab=ev.target.closest(".tab"); if(tab){ dayIdx=+tab.dataset.i; render(); }
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape") $("scrim").hidden=true; });
$("dClose").onclick=()=>{ $("scrim").hidden=true; };
$("scrim").addEventListener("click",e=>{ if(e.target.id==="scrim") $("scrim").hidden=true; });
$("prev").onclick=()=>{ monday=addDays(monday,-7); render(); };
$("next").onclick=()=>{ monday=addDays(monday,7); render(); };
$("today").onclick=()=>{ goToday(); render(); };
addEventListener("resize",()=>{ clearTimeout(window._r); window._r=setTimeout(render,120); });
$("klasse").addEventListener("change",()=>{ setKlasse($("klasse").value); });
addEventListener("hashchange",()=>{ const h=decodeURIComponent(location.hash.slice(1)); if(h&&h!==KLASSE&&KLASSEN.some(k=>k.name===h)) setKlasse(h); });

async function getJSON(url){ const r=await fetch(url,{cache:"no-cache"}); if(!r.ok) throw new Error(r.status); return r.json(); }

function applyEvents(){ EVENTS = ALL_EVENTS.filter(e=>e.klasse===KLASSE).map((e,i)=>Object.assign({},e,{id:e.id||(e.klasse+"-"+e.datum+"-"+i),art:normKind(e)})); }

async function loadKlasse(){
  TT=null; render();
  try{ TT = await getJSON("data/stundenplan/"+encodeURIComponent(KLASSE)+".json"); $("status").hidden=true; }
  catch(e){ TT=null; $("status").hidden=false; $("status").textContent="Für "+KLASSE+" liegen noch keine Stundenplandaten vor. Sie werden beim nächsten stündlichen Abgleich geladen."; }
  applyEvents(); render();
}
function setKlasse(k){
  KLASSE=k; store("klasse",k); $("klasse").value=k;
  const info=KLASSEN.find(x=>x.name===k); $("kv").textContent=info?info.kv:"";
  document.title="Klassenplan "+k;
  if(location.hash.slice(1)!==k) history.replaceState(null,"","#"+k);
  loadKlasse();
}

async function refresh(){
  try{ STAND = await getJSON("data/stand.json"); }catch(e){}
  try{ ALL_EVENTS = await getJSON("data/termine.json"); applyEvents(); }catch(e){}
  try{ if(KLASSE){ TT = await getJSON("data/stundenplan/"+encodeURIComponent(KLASSE)+".json"); } }catch(e){}
  render();
}

(async()=>{
  try{ [CFG, KLASSEN] = await Promise.all([getJSON("config.json"), getJSON("data/klassen.json")]); }
  catch(e){ $("status").textContent="Die App-Daten konnten nicht geladen werden. Bitte Internetverbindung prüfen."; return; }
  try{ ALL_EVENTS = await getJSON("data/termine.json"); }catch(e){ ALL_EVENTS=[]; }
  try{ STAND = await getJSON("data/stand.json"); }catch(e){}
  $("klasse").innerHTML = KLASSEN.map(k=>`<option value="${esc(k.name)}">${esc(k.name)}</option>`).join("");
  if(CFG.eintragenLink){ $("eintragen").href=CFG.eintragenLink; $("eintragen").hidden=false; }
  const fromHash=decodeURIComponent(location.hash.slice(1));
  const pick=[fromHash, store("klasse"), CFG.standardKlasse].find(k=>k&&KLASSEN.some(x=>x.name===k)) || (KLASSEN[0]&&KLASSEN[0].name);
  setKlasse(pick);
  setInterval(()=>{ if(document.visibilityState==="visible") refresh(); }, 10*60*1000);
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refresh(); });
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
