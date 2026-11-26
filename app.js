'use strict';
const $=id=>document.getElementById(id), KEY='fuel_history_v2', LEGACY='fuel_history';
const android = globalThis.spritAndroid;
const storage = android ?? {
  read: key => localStorage.getItem(key),
  write: (key, value) => localStorage.setItem(key, value),
};
let entries=[], editing=null, blocked=false, saving=false;
const id=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>{let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const fmt=(n,d=2)=>n==null?'–':Number(n).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
function dateISO(s){s=String(s);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){let d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s?s:''}let m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);return m?dateISO(m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')):''}
function optional(v){return v==null||String(v).trim()===''?null:Number(String(v).replace(',','.'))}
function normalize(e){let x={id:String(e.id||id()),date:dateISO(e.date),km:optional(e.km),liters:optional(e.liters),price:optional(e.price),cost:optional(e.cost),full:['yes','no','unknown'].includes(e.full)?e.full:'unknown'};if(!x.date||!Number.isInteger(x.km)||x.km<0||x.km>9999999||!Number.isFinite(x.liters)||x.liters<=0||x.liters>300||[x.price,x.cost].some(v=>v!==null&&(!Number.isFinite(v)||v<0))||x.price>20||x.cost>6000)throw Error('Ungültiger Tankdatensatz');if(x.cost===null&&x.price!==null)x.cost=Math.round(x.price*x.liters*100)/100;if(x.price===null&&x.cost!==null)x.price=Math.round(x.cost/x.liters*1000)/1000;if(x.price>20||x.cost>6000)throw Error('Preis oder Kosten außerhalb des zulässigen Bereichs');return x}
function checked(arr){if(!Array.isArray(arr))throw Error('Keine Datensatzliste');const a=arr.map(normalize).sort((a,b)=>a.km-b.km||a.date.localeCompare(b.date));if(new Set(a.map(e=>e.id)).size!==a.length)throw Error('Doppelte IDs');if(a.some((e,i)=>i&&e.date<a[i-1].date))throw Error('Datum und Kilometerstand widersprechen sich');return a}
function calc(a){let anchor=null, liters=0, valid=true,totalL=0,totalKm=0;const values=new Map();for(const e of a){if(anchor){liters+=e.liters;if(e.full==='unknown')valid=false}if(e.full==='yes'){if(anchor&&valid&&e.km>anchor.km){let km=e.km-anchor.km;values.set(e.id,100*liters/km);totalL+=liters;totalKm+=km}anchor=e;liters=0;valid=true}}return {values,avg:totalKm?100*totalL/totalKm:null}}
async function persist(a) {
  if (blocked) throw Error('Speicher nicht verfügbar. Bitte zuerst Daten sichern.');
  if (saving) throw Error('Speichern läuft bereits.');
  const next = checked(a);
  saving = true;
  try {
    await storage.write(KEY, JSON.stringify(next));
    entries = next;
    render();
  } finally {
    saving = false;
  }
}
async function load() {
  try {
    const raw = await storage.read(KEY);
    entries = checked(JSON.parse(raw ?? await storage.read(LEGACY) ?? '[]'));
    if (raw === null) await storage.write(KEY, JSON.stringify(entries));
    $('storage').textContent = 'Lokaler Speicher verfügbar.';
  } catch (e) {
    blocked = true;
    $('storage').textContent = 'Speicherfehler: ' + e.message + '. Originaldaten werden nicht überschrieben.';
  }
}
function el(tag,text){let n=document.createElement(tag);n.textContent=text;return n}
function render(){const c=calc(entries),latest=[...entries].reverse().find(e=>c.values.has(e.id)),month=today().slice(0,7),monthly=entries.filter(e=>e.date.startsWith(month)),known=monthly.filter(e=>e.cost!==null),metrics=$('metrics');metrics.replaceChildren();for(const [k,v] of [['Letzter Verbrauch',fmt(latest?c.values.get(latest.id):null)+' L/100 km'],['Durchschnitt',fmt(c.avg)+' L/100 km'],['Tankvorgänge',String(entries.length)],['Kosten diesen Monat',known.length?fmt(known.reduce((s,e)=>s+e.cost,0))+' €':'–']]){let box=el('div',k);box.className='metric';box.append(el('strong',v));metrics.append(box)}$('monthly').textContent=monthly.length-known.length?'Monatskosten unvollständig: '+(monthly.length-known.length)+' Einträge ohne Preis.':'';let rows=$('rows');rows.replaceChildren();for(const e of [...entries].reverse()){let tr=document.createElement('tr');for(const v of [e.date.split('-').reverse().join('.'),fmt(e.km,0),fmt(e.liters,3),fmt(e.price,3),fmt(e.cost),({yes:'Voll',no:'Teil',unknown:'?'})[e.full],fmt(c.values.get(e.id))])tr.append(el('td',v));let td=document.createElement('td');for(const [t,f] of [['Bearbeiten',()=>edit(e)],['Löschen',async()=>{if(confirm('Diesen Tankvorgang löschen?'))try{await persist(entries.filter(x=>x.id!==e.id));if(editing===e.id)reset()}catch(err){alert(err.message)}}]]){let b=el('button',t);b.onclick=f;td.append(b)}tr.append(td);rows.append(tr)}draw(entries.filter(e=>c.values.has(e.id)).map(e=>c.values.get(e.id)))}
function draw(vals){let box=$('chart');box.replaceChildren(el('p','Verbrauchsentwicklung · letzte 20 gültige Messungen'));vals=vals.slice(-20);if(!vals.length){box.append(el('p','Noch keine bestätigte Volltankstrecke.'));return}let ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Verbrauch in Litern pro 100 km');let max=Math.max(...vals,1)*1.1;let pts=vals.map((v,i)=>[30+i*540/Math.max(1,vals.length-1),145-v/max*120]);let line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#82d9aa');line.setAttribute('stroke-width','3');svg.append(line);pts.forEach((p,i)=>{let circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p[0]);circle.setAttribute('cy',p[1]);circle.setAttribute('r','4');circle.setAttribute('fill','#82d9aa');let title=document.createElementNS(ns,'title');title.textContent=fmt(vals[i])+' L/100 km';circle.append(title);svg.append(circle)});box.append(svg)}
function reset(){editing=null;$('form').reset();$('date').value=today();$('heading').textContent='Tankvorgang erfassen';$('status').textContent=''}
function edit(e){editing=e.id;for(const k of ['date','km','liters','price','cost','full'])$(k).value=e[k]??'';$('heading').textContent='Tankvorgang bearbeiten';$('heading').scrollIntoView({behavior:'smooth'})}
$('cancel').onclick=reset;$('form').onsubmit=async e=>{e.preventDefault();await ready;try{let x=normalize({id:editing||id(),...Object.fromEntries(['date','km','liters','price','cost','full'].map(k=>[k,$(k).value]))});if(entries.some(y=>y.id!==x.id&&y.km===x.km&&y.date===x.date&&y.liters===x.liters)&&!confirm('Sehr ähnlicher Eintrag vorhanden. Trotzdem speichern?'))return;if(x.price!==null&&x.cost!==null&&Math.abs(x.price*x.liters-x.cost)>.1&&!confirm('Literpreis und Gesamtbetrag weichen voneinander ab. Trotzdem speichern?'))return;await persist([...entries.filter(y=>y.id!==x.id),x]);reset()}catch(err){alert(err.message)}};
async function recognize(file) {
  if (!globalThis.Tesseract) throw Error('OCR konnte nicht geladen werden');
  const logger = message => {
    if (message.status === 'recognizing text') {
      $('status').textContent = 'Texterkennung ' + Math.round(message.progress * 100) + ' %';
    }
  };
  let worker;
  let workerError;
  const failure = new Promise((_, reject) => { workerError = reject; });
  const opening = Tesseract.createWorker('deu', 1, { ...android?.ocr, logger, errorHandler: workerError });
  try {
    worker = await Promise.race([opening, failure]);
    return await Promise.race([worker.recognize(file), failure]);
  } finally {
    if (worker) await worker.terminate();
    else opening.then(lateWorker => lateWorker.terminate()).catch(() => {});
  }
}
let busy=false;
function decimal(s){return Number(s.replace(',','.'))}
async function scan(file,kind){if(!file||busy)return;busy=true;$('scanReceipt').disabled=$('scanTach').disabled=true;$('status').textContent='Bild wird analysiert…';try{const {data} = await recognize(file);let t=data.text, found=[];if(kind==='receipt'){let matches=[...t.matchAll(/\b(\d{1,3}[,.]\d{1,3})\s*(?:liter|ltr|l)\b(?!\s*\/)/gi)].map(m=>decimal(m[1])).filter(x=>x>0&&x<=300);if(matches.length){$('liters').value=matches[0];found.push('Liter')}let p=t.match(/(\d{1,2}[,.]\d{3})\s*(?:€|eur)\s*\/\s*l\b/i);if(p){$('price').value=decimal(p[1]);found.push('Literpreis')}let c=t.match(/(?:gesamt(?:betrag|summe)?|summe|total|betrag)\s*[:\s]*(?:EUR|€)?\s*(\d{1,4}[,.]\d{2})/i);if(c){$('cost').value=decimal(c[1]);found.push('Gesamtbetrag')}}else{let m=t.match(/\b(\d{1,3}(?:[.\s]\d{3}){1,2}|\d{1,7})\s*km\b/i);let candidates=[...t.matchAll(/\b\d{3,7}\b/g)].map(m=>Number(m[0]));let n=m?Number(m[1].replace(/[.\s]/g,'')):candidates.length===1?candidates[0]:null;if(n!==null){$('km').value=n;found.push('Kilometerstand')}}$('status').textContent=(found.length?'Vorschlag: '+found.join(', '):'Keine eindeutige Erkennung')+'. Bitte prüfen.\nErkannter Text:\n'+t.slice(0,1200)}catch(e){$('status').textContent='OCR-Fehler: '+e.message+' – manuell eingeben.'}finally{busy=false;$('scanReceipt').disabled=$('scanTach').disabled=false}}
let choosingPhoto = false;
for (const [button, input, kind] of [['scanReceipt', 'receipt', 'receipt'], ['scanTach', 'tach', 'tach']]) {
  $(button).onclick = async () => {
    if (!android) return $(input).click();
    if (choosingPhoto || busy) return;
    choosingPhoto = true;
    try {
      await scan(await android.photo(kind), kind);
    } catch (e) {
      if (!/cancel/i.test(e.message)) $('status').textContent = 'Bild konnte nicht geöffnet werden: ' + e.message;
    } finally {
      choosingPhoto = false;
    }
  };
  $(input).onchange = () => {
    scan($(input).files[0], kind);
    $(input).value = '';
  };
}
async function exportData(name, getData, type) {
  await ready;
  try {
    const data = getData();
    await (android ? android.exportFile(name, data) : download(name, data, type));
  } catch (e) {
    if (!/cancel/i.test(e.message)) alert('Export fehlgeschlagen: ' + e.message);
  }
}
function download(name,data,type){let url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('backup').onclick=()=>exportData('sprit-backup-'+today()+'.json',()=>JSON.stringify({version:2,entries},null,2),'application/json');
const cols=['id','date','km','liters','price','cost','full'];$('csv').onclick=()=>exportData('sprit-'+today()+'.csv',()=>'\ufeff'+cols.join(';')+'\r\n'+entries.map(e=>cols.map(k=>k==='id'?encodeURIComponent(e[k]):String(e[k]??'').replace('.',typeof e[k]==='number'?',':'.')).join(';')).join('\r\n'),'text/csv;charset=utf-8');
$('restore').onclick=()=>$('import').click();$('import').onchange=async()=>{try{let f=$('import').files[0];if(!f)return;let t=(await f.text()).replace(/^\ufeff/,'');let a;if(f.name.toLowerCase().endsWith('.csv')){let [h,...lines]=t.trim().split(/\r?\n/);let keys=h.split(';');if(!cols.every(k=>keys.includes(k)))throw Error('CSV muss das Exportformat des Trackers verwenden');a=lines.filter(Boolean).map(line=>{let cells=line.split(';');if(cells.length!==keys.length)throw Error('Ungültige CSV-Zeile');let obj=Object.fromEntries(keys.map((k,i)=>[k,cells[i]]));obj.id=decodeURIComponent(obj.id);return obj})}else{let j=JSON.parse(t);a=Array.isArray(j)?j:j.entries}let next=checked(a);await ready;if(confirm(next.length+' Datensätze importieren? Bestehende Historie wird ersetzt. Vorher Sicherung exportieren.')){await persist(next);reset()}}catch(e){alert('Import fehlgeschlagen: '+e.message)}finally{$('import').value=''}};
reset();
const ready = load().then(() => render());
if (android) {
  ready.then(() => android.onRestoredPhoto(scan)).catch(e => {
    $('status').textContent = 'Kamerawiederherstellung fehlgeschlagen: ' + e.message;
  });
} else if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
