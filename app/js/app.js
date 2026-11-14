(function(){
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const store = {get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};

// ---------- i18n ----------
const I18N = {
 th:{appName:'แปลภาษา Real Time',tagline:'เสียง • ข้อความ • กล้อง',vSingle:'แปลเสียง',vConvo:'โหมดสนทนา',youSaid:'คุณพูดว่า',tapMic:'แตะไมค์แล้วเริ่มพูด…',translation:'คำแปล',autoSpeak:'อ่านออกเสียงคำแปลอัตโนมัติ',tapToStart:'แตะเพื่อเริ่ม',listening:'กำลังฟัง… พูดได้เลย',tapMicSpeak:'แตะไมค์เพื่อพูด',srUnsupported:'เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง แนะนำ Chrome / Edge / Android',typeHere:'พิมพ์หรือวางข้อความที่นี่…',history:'ประวัติ',clearAll:'ล้างทั้งหมด',camHint:'เปิดกล้อง หรืออัปโหลดรูปเพื่อแปลข้อความในภาพ',openCam:'เปิดกล้อง',closeCam:'ปิดกล้อง',upload:'อัปโหลดรูป',detectedText:'ข้อความที่พบ',tabVoice:'เสียง',tabText:'ข้อความ',tabCamera:'กล้อง',copied:'คัดลอกแล้ว',saved:'บันทึกแล้ว',noHistory:'ยังไม่มีประวัติ',detected:'ตรวจพบ',error:'แปลไม่สำเร็จ ลองอีกครั้ง',camError:'เปิดกล้องไม่ได้',ocrLoading:'กำลังโหลดโมเดล OCR…',ocrRun:'กำลังอ่านข้อความ…',noText:'ไม่พบข้อความในภาพ',startCamFirst:'เปิดกล้องก่อน หรืออัปโหลดรูป',micDenied:'ไม่ได้รับอนุญาตใช้ไมค์'},
 en:{appName:'Real Time Translator',tagline:'Voice • Text • Camera',vSingle:'Voice',vConvo:'Conversation',youSaid:'You said',tapMic:'Tap the mic and start speaking…',translation:'Translation',autoSpeak:'Speak translation automatically',tapToStart:'Tap to start',listening:'Listening… go ahead',tapMicSpeak:'Tap mic to speak',srUnsupported:'Speech recognition not supported here. Use Chrome / Edge / Android',typeHere:'Type or paste text…',history:'History',clearAll:'Clear all',camHint:'Open the camera or upload an image to translate text in it',openCam:'Open camera',closeCam:'Close camera',upload:'Upload',detectedText:'Detected text',tabVoice:'Voice',tabText:'Text',tabCamera:'Camera',copied:'Copied',saved:'Saved',noHistory:'No history yet',detected:'Detected',error:'Translation failed, try again',camError:'Cannot open camera',ocrLoading:'Loading OCR model…',ocrRun:'Reading text…',noText:'No text found',startCamFirst:'Open camera or upload first',micDenied:'Microphone permission denied'}
};
let ui = store.get('ui', (navigator.language||'th').startsWith('th') ? 'th' : 'th');
const t = k => (I18N[ui]||I18N.th)[k] || k;
function applyI18n(){
  document.documentElement.lang = ui;
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  $$('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
  $('#uiLangBtn').textContent = ui === 'th' ? 'EN' : 'ไทย';
  fillSelects(); renderHistory(); $('#camStart').textContent = stream ? t('closeCam') : t('openCam');
}
$('#uiLangBtn').onclick = () => { ui = ui === 'th' ? 'en' : 'th'; store.set('ui', ui); applyI18n(); };

function toast(msg){ const e=$('#toast'); e.textContent=msg; e.classList.add('show'); clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('show'),1600); }
async function copy(text){ if(!text||text==='—')return; try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()} toast(t('copied')); }

// ---------- language selects ----------
const SEL = { vSrc:['th',false], vTgt:['en',true], tSrc:['auto',false], tTgt:['en',true], cSrc:['en',false], cTgt:['th',true], cLangA:['th',true], cLangB:['en',true] };
function fillSelects(){
  for (const id in SEL){
    const el = $('#'+id); const noAuto = SEL[id][1] || id==='vSrc' || id==='cSrc';
    const val = el.value || store.get('sel_'+id, SEL[id][0]);
    el.innerHTML = LANGS.filter(l => !(noAuto && l.code==='auto')).map(l => `<option value="${l.code}">${l[ui]}</option>`).join('');
    el.value = val; if (!el.value) el.value = SEL[id][0];
    el.onchange = () => { store.set('sel_'+id, el.value); el.dispatchEvent(new Event('langchange')); };
  }
}
function swapSel(a, b){
  const A=$('#'+a), B=$('#'+b); let av=A.value; if(av==='auto') av=lastDetected||'en';
  const bv=B.value; A.value=bv; B.value=av; store.set('sel_'+a,A.value); store.set('sel_'+b,B.value);
}

// ---------- tabs ----------
$$('.tab-btn').forEach((b,i) => b.onclick = () => {
  $$('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));
  $$('.tab').forEach(x=>x.classList.toggle('active',x.id==='tab-'+b.dataset.tab));
  $('.tab-indicator').style.transform = `translateX(${i*100}%)`;
  if (b.dataset.tab!=='voice') stopAllRec();
  if (b.dataset.tab!=='camera') stopCam();
  store.set('tab', b.dataset.tab);
});

// ---------- speech synthesis ----------
let voices = []; const loadVoices=()=>voices=speechSynthesis?speechSynthesis.getVoices():[];
if ('speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, code, onend){
  if (!('speechSynthesis' in window) || !text || text==='—') { onend&&onend(); return; }
  speechSynthesis.cancel();
  const L = langByCode(code); const loc = (L&&L.sr)||code;
  const u = new SpeechSynthesisUtterance(text); u.lang = loc; u.rate = 1;
  const v = voices.find(v=>v.lang.replace('_','-')===loc) || voices.find(v=>v.lang.toLowerCase().startsWith(code.split('-')[0]));
  if (v) u.voice = v; if (onend){ u.onend=onend; u.onerror=onend; }
  speechSynthesis.speak(u);
}

// ---------- speech recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) $('#srWarn').classList.remove('hidden');
let activeRec = null;
function stopAllRec(){ if(activeRec){ activeRec.stopFlag=true; try{activeRec.rec.stop()}catch{} activeRec.btn.classList.remove('listening'); activeRec=null; } }
function startRec({lang, btn, onText, onFinal, onState}){
  if (!SR){ toast(t('srUnsupported')); return; }
  if (activeRec && activeRec.btn===btn){ stopAllRec(); onState&&onState(false); return; }
  stopAllRec();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const rec = new SR(); rec.lang = (langByCode(lang)||{}).sr || lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives=1;
  const ctx = {rec, btn, stopFlag:false}; activeRec = ctx; let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i]; if (r.isFinal){ finalText += r[0].transcript + ' '; onFinal&&onFinal(r[0].transcript.trim(), finalText.trim()); } else interim += r[0].transcript;
    }
    onText(finalText.trim(), interim.trim());
  };
  rec.onerror = e => { if (e.error==='not-allowed'||e.error==='service-not-allowed'){ toast(t('micDenied')); ctx.stopFlag=true; } };
  rec.onend = () => { if (!ctx.stopFlag && activeRec===ctx){ try{rec.start()}catch{} } else { btn.classList.remove('listening'); onState&&onState(false); } };
  try { rec.start(); btn.classList.add('listening'); onState&&onState(true); } catch(e){ console.warn(e); }
}

// ---------- VOICE single ----------
let lastDetected = null;
let vCtl = null;
async function liveTranslate(text, sl, tl, outEl){
  if (vCtl) vCtl.abort(); vCtl = new AbortController(); const sig=vCtl.signal;
  try { const r = await Translator.translate(text, sl, tl, sig); if(!sig.aborted) outEl.textContent = r.text || '—'; return r; }
  catch(e){ if (e.name!=='AbortError'){ console.warn(e); } }
}
let vDebounce;
$('#vMic').onclick = () => {
  startRec({lang: $('#vSrc').value, btn: $('#vMic'),
    onState: on => $('#vStatus').textContent = on ? t('listening') : t('tapToStart'),
    onText: (fin, interim) => {
      $('#vOrig').classList.remove('muted');
      $('#vOrig').innerHTML = escapeHtml(fin) + (interim ? ' <span class="interim">'+escapeHtml(interim)+'</span>' : '');
      clearTimeout(vDebounce); const all=(fin+' '+interim).trim();
      vDebounce = setTimeout(()=> liveTranslate(all, $('#vSrc').value, $('#vTgt').value, $('#vTrans')), interim?250:0);
    },
    onFinal: async (seg) => {
      if (!$('#vAutoSpeak').checked) return;
      const r = await Translator.translate(seg, $('#vSrc').value, $('#vTgt').value).catch(()=>null);
      if (r && r.text){ // pause rec while speaking to avoid echo
        speak(r.text, $('#vTgt').value);
      }
      addHistory($('#vOrig').textContent, $('#vTrans').textContent, $('#vSrc').value, $('#vTgt').value, true);
    }
  });
};
$('#vSwap').onclick = () => { stopAllRec(); swapSel('vSrc','vTgt'); const o=$('#vOrig').textContent, tr=$('#vTrans').textContent; if(tr&&tr!=='—'){ $('#vOrig').textContent=tr; $('#vTrans').textContent=o; } };
$('#vSpeak').onclick = () => speak($('#vTrans').textContent, $('#vTgt').value);
$('#vCopy').onclick = () => copy($('#vTrans').textContent);
$$('.seg-btn').forEach(b => b.onclick = () => {
  $$('.seg-btn').forEach(x=>x.classList.toggle('active',x===b)); stopAllRec();
  $('#voiceSingle').classList.toggle('hidden', b.dataset.vmode!=='single');
  $('#voiceConvo').classList.toggle('hidden', b.dataset.vmode!=='convo');
});

// ---------- VOICE conversation ----------
function convoSide(me, other){
  const myLang = () => $('#cLang'+me).value, otherLang = () => $('#cLang'+other).value;
  let ctl;
  $('#cMic'+me).onclick = () => startRec({lang: myLang(), btn: $('#cMic'+me),
    onText: async (fin, interim) => {
      const all = (fin+' '+interim).trim(); if (!all) return;
      $('#cText'+me).innerHTML = '<div>'+escapeHtml(all)+'</div>';
      clearTimeout(ctl); ctl = setTimeout(async () => {
        const r = await Translator.translate(all, myLang(), otherLang()).catch(()=>null);
        if (r) $('#cText'+other).innerHTML = '<div>'+escapeHtml(r.text)+'</div><div class="orig">'+escapeHtml(all)+'</div>';
      }, interim?250:0);
    },
    onFinal: async (seg, full) => {
      const r = await Translator.translate(full, myLang(), otherLang()).catch(()=>null);
      if (r){ $('#cText'+other).innerHTML = '<div>'+escapeHtml(r.text)+'</div><div class="orig">'+escapeHtml(full)+'</div>';
        const s = await Translator.translate(seg, myLang(), otherLang()).catch(()=>null); if (s) speak(s.text, otherLang()); }
    }
  });
}
convoSide('A','B'); convoSide('B','A');
$('#cSwap').onclick = () => { stopAllRec(); swapSel('cLangA','cLangB'); };

// ---------- TEXT ----------
let tTimer, tCtl;
async function doText(){
  const text = $('#tInput').value; const out=$('#tOutput');
  if (!text.trim()){ out.innerHTML='<span class="muted">—</span>'; $('#tDetected').textContent=''; return; }
  if (tCtl) tCtl.abort(); tCtl = new AbortController(); const sig = tCtl.signal;
  $('#tLoading').classList.remove('hidden');
  try{
    const r = await Translator.translate(text, $('#tSrc').value, $('#tTgt').value, sig);
    if (sig.aborted) return;
    out.textContent = r.text;
    if ($('#tSrc').value==='auto' && r.detected){ lastDetected=r.detected; const L=langByCode(r.detected); $('#tDetected').textContent = t('detected')+': '+(L?L[ui]:r.detected); } else $('#tDetected').textContent='';
    clearTimeout(doText._h); doText._h = setTimeout(()=>addHistory(text, r.text, r.detected||$('#tSrc').value, $('#tTgt').value), 2500);
  } catch(e){ if (e.name!=='AbortError'){ out.innerHTML='<span class="muted">'+t('error')+'</span>'; console.warn(e);} }
  finally{ if(!sig.aborted) $('#tLoading').classList.add('hidden'); }
}
$('#tInput').addEventListener('input', () => { clearTimeout(tTimer); tTimer = setTimeout(doText, 400); autoGrow(); });
function autoGrow(){ const e=$('#tInput'); e.style.height='auto'; e.style.height=Math.min(e.scrollHeight,260)+'px'; }
['tSrc','tTgt'].forEach(id => $('#'+id).addEventListener('langchange', doText));
$('#tSwap').onclick = () => { swapSel('tSrc','tTgt'); const o=$('#tOutput').textContent; if (o && o!=='—'){ $('#tInput').value=o; } doText(); };
$('#tCopy').onclick = () => copy($('#tOutput').textContent);
$('#tSpeak').onclick = () => speak($('#tOutput').textContent, $('#tTgt').value);
$('#tSpeakSrc').onclick = () => speak($('#tInput').value, $('#tSrc').value==='auto' ? (lastDetected||Translator.guessLang($('#tInput').value)) : $('#tSrc').value);
$('#tClear').onclick = () => { $('#tInput').value=''; doText(); autoGrow(); $('#tInput').focus(); };
$('#tPaste').onclick = async () => { try{ $('#tInput').value = await navigator.clipboard.readText(); autoGrow(); doText(); }catch{ $('#tInput').focus(); } };
$('#tSave').onclick = () => { const o=$('#tOutput').textContent; if($('#tInput').value.trim()&&o&&o!=='—'){ addHistory($('#tInput').value,o,$('#tSrc').value,$('#tTgt').value,true); toast(t('saved')); } };

// ---------- history ----------
function addHistory(src, tgt, sl, tl, force){
  src=(src||'').trim(); tgt=(tgt||'').trim(); if(!src||!tgt||tgt==='—') return;
  let h = store.get('history', []);
  if (h[0] && (h[0].src===src || (!force && src.startsWith(h[0].src)))) h.shift();
  h.unshift({src, tgt, sl, tl, ts: Date.now()}); h = h.slice(0, 50); store.set('history', h); renderHistory();
}
function renderHistory(){
  const h = store.get('history', []); const ul=$('#history');
  if (!h.length){ ul.innerHTML = `<li class="empty">${t('noHistory')}</li>`; return; }
  ul.innerHTML = h.map((x,i)=>{ const a=langByCode(x.sl), b=langByCode(x.tl);
    return `<li data-i="${i}"><div class="h-src">${escapeHtml(x.src)}</div><div class="h-tgt">${escapeHtml(x.tgt)}</div><div class="h-meta">${a?a[ui]:x.sl||''} → ${b?b[ui]:x.tl||''} · ${new Date(x.ts).toLocaleString(ui==='th'?'th-TH':'en-US',{dateStyle:'short',timeStyle:'short'})}</div></li>`}).join('');
  ul.querySelectorAll('li[data-i]').forEach(li => li.onclick = () => { const x=h[li.dataset.i]; $('#tInput').value=x.src; $('#tTgt').value=x.tl; autoGrow(); doText(); window.scrollTo({top:0,behavior:'smooth'}); });
}
$('#hClear').onclick = () => { store.set('history', []); renderHistory(); };

// ---------- CAMERA ----------
let stream = null;
async function startCam(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}, audio:false});
    const v=$('#camVideo'); v.srcObject=stream; v.classList.remove('hidden'); $('#camImg').classList.add('hidden'); $('#camPlaceholder').classList.add('hidden'); $('#camOverlay').classList.add('hidden');
    $('#camStart').textContent = t('closeCam');
  }catch(e){ console.warn(e); toast(t('camError')); }
}
function stopCam(){ if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } $('#camStart').textContent=t('openCam'); }
$('#camStart').onclick = () => stream ? (stopCam(), $('#camPlaceholder').classList.toggle('hidden', !$('#camImg').src)) : startCam();
$('#camCapture').onclick = () => {
  if (!stream){ toast(t('startCamFirst')); return; }
  const v=$('#camVideo'), c=$('#camCanvas'); c.width=v.videoWidth; c.height=v.videoHeight; c.getContext('2d').drawImage(v,0,0);
  const url = c.toDataURL('image/jpeg',0.92); stopCam(); showImg(url); runOCR(c);
};
$('#camFile').onchange = e => { const f=e.target.files[0]; if(!f) return; stopCam(); const url=URL.createObjectURL(f); showImg(url); const img=new Image(); img.onload=()=>runOCR(img); img.src=url; e.target.value=''; };
function showImg(url){ const im=$('#camImg'); im.src=url; im.classList.remove('hidden'); $('#camVideo').classList.add('hidden'); $('#camPlaceholder').classList.add('hidden'); }
let tessLoading = null;
function loadTesseract(){ if (window.Tesseract) return Promise.resolve(); if (tessLoading) return tessLoading;
  tessLoading = new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); return tessLoading; }
function setProgress(p, text){ const el=$('#ocrProgress'); el.classList.remove('hidden'); el.querySelector('.bar').style.width=Math.round(p*100)+'%'; el.querySelector('.ptext').textContent=text+(p?' '+Math.round(p*100)+'%':''); }
async function runOCR(source){
  const sl = $('#cSrc').value; const L = langByCode(sl);
  let langs = (L&&L.ocr) || 'eng'; if (langs!=='eng') langs += '+eng';
  $('#scanLine').classList.remove('hidden'); $('#camOverlay').classList.add('hidden'); setProgress(0, t('ocrLoading'));
  try{
    await loadTesseract();
    const r = await Tesseract.recognize(source, langs, { logger: m => { if (m.status==='recognizing text') setProgress(m.progress, t('ocrRun')); else if (m.progress!=null) setProgress(m.progress, t('ocrLoading')); } });
    let text = (r.data.text||'').trim();
    if (/^(tha|chi|jpn|kor|lao|khm|mya)/.test(langs)) text = text.replace(/(?<=[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]) (?=[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF])/g,'');
    $('#ocrText').textContent = text || t('noText'); $('#ocrText').classList.toggle('muted', !text);
    if (text){ const tr = await Translator.translate(text, sl, $('#cTgt').value);
      $('#ocrTrans').textContent = tr.text; const ov=$('#camOverlay'); ov.textContent=tr.text; ov.classList.remove('hidden');
      addHistory(text, tr.text, sl, $('#cTgt').value, true); }
    else $('#ocrTrans').textContent='—';
  }catch(e){ console.warn(e); toast(t('error')); }
  finally{ $('#scanLine').classList.add('hidden'); $('#ocrProgress').classList.add('hidden'); }
}
['cSrc','cTgt'].forEach(id=>$('#'+id).addEventListener('langchange', async ()=>{ const tx=$('#ocrText').textContent; if(tx&&tx!=='—'&&tx!==t('noText')){ const r=await Translator.translate(tx,$('#cSrc').value,$('#cTgt').value).catch(()=>null); if(r){$('#ocrTrans').textContent=r.text; $('#camOverlay').textContent=r.text;} } }));
$('#camSwap').onclick = () => swapSel('cSrc','cTgt');
$('#ocrCopy').onclick = () => copy($('#ocrText').textContent);
$('#ocrTCopy').onclick = () => copy($('#ocrTrans').textContent);
$('#ocrSpeak').onclick = () => speak($('#ocrTrans').textContent, $('#cTgt').value);

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- init ----------
applyI18n();
const startTab = new URLSearchParams(location.search).get('tab') || store.get('tab','voice');
const tb = $(`.tab-btn[data-tab="${startTab}"]`); if (tb) tb.click();
if ('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
window.__app = { doText };
})();
