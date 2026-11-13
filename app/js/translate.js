// Translation: Google (gtx, no key) primary -> MyMemory fallback
(function(){
  const cache = new Map();
  // Script-based language guess (used when source is auto and Google is unavailable)
  function guessLang(text){
    const t = text || '';
    const tests = [
      [/[\u0E00-\u0E7F]/,'th'],[/[\u0E80-\u0EFF]/,'lo'],[/[\u1780-\u17FF]/,'km'],[/[\u1000-\u109F]/,'my'],
      [/[\u3040-\u30FF]/,'ja'],[/[\uAC00-\uD7AF\u1100-\u11FF]/,'ko'],[/[\u4E00-\u9FFF]/,'zh-CN'],
      [/[\u0600-\u06FF]/,'ar'],[/[\u0900-\u097F]/,'hi'],[/[\u0400-\u04FF]/,'ru'],
      [/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủũứừửữựỳỷỹỵ]/i,'vi'],
    ];
    for (const [re, c] of tests) if (re.test(t)) return c;
    return 'en';
  }
  async function google(text, sl, tl, signal){
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=' +
      encodeURIComponent(sl) + '&tl=' + encodeURIComponent(tl) + '&q=' + encodeURIComponent(text);
    const r = await fetch(url, {signal});
    if (!r.ok) throw new Error('google ' + r.status);
    const j = await r.json();
    const out = (j[0] || []).map(s => s[0]).filter(Boolean).join('');
    if (!out) throw new Error('google empty');
    return {text: out, detected: j[2] || sl, engine: 'Google'};
  }
  async function mymemory(text, sl, tl, signal){
    const src = sl === 'auto' ? guessLang(text) : sl;
    if (src === tl || src.split('-')[0] === tl.split('-')[0]) return {text, detected: src, engine: 'MyMemory'};
    // MyMemory limit ~500 bytes per request: chunk by sentences
    const parts = text.match(/[^.!?。！？\n]+[.!?。！？\n]*|\n/g) || [text];
    const chunks = []; let cur = '';
    for (const p of parts){ if ((cur + p).length > 220 && cur){ chunks.push(cur); cur = p; } else cur += p; }
    if (cur) chunks.push(cur);
    const res = [];
    for (const c of chunks){
      if (!c.trim()){ res.push(c); continue; }
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(c) + '&langpair=' + encodeURIComponent(src + '|' + tl);
      const r = await fetch(url, {signal});
      if (!r.ok) throw new Error('mymemory ' + r.status);
      const j = await r.json();
      if (j.responseStatus != 200 && !j.responseData) throw new Error('mymemory ' + j.responseDetails);
      res.push(j.responseData.translatedText);
    }
    return {text: res.join(' ').replace(/\s+\n/g,'\n'), detected: src, engine: 'MyMemory'};
  }
  let googleBlockedUntil = 0;
  async function translate(text, sl, tl, signal){
    text = (text || '').trim();
    if (!text) return {text: '', detected: sl};
    const key = sl + '|' + tl + '|' + text;
    if (cache.has(key)) return cache.get(key);
    let result;
    if (Date.now() > googleBlockedUntil){
      try { result = await google(text, sl, tl, signal); }
      catch (e){ if (e.name === 'AbortError') throw e; console.warn('Google failed, fallback', e.message); googleBlockedUntil = Date.now() + 60000; }
    }
    if (!result) result = await mymemory(text, sl, tl, signal);
    cache.set(key, result);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return result;
  }
  window.Translator = { translate, guessLang };
})();
