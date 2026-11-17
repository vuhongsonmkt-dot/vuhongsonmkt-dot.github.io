import {timecode,seconds,validateCues,parseSubtitles,mergeVietnamese,cueText,toSrt,toVtt,toCsv,toAss,flags,shiftCues} from './lib/subtitles.js';
import {wavBytes,decodePcm16} from './lib/audio.js';

const $ = id => document.getElementById(id);
const MAX_MEDIA = 200 * 1024 * 1024, MAX_DURATION = 20 * 60;
const settingsIds = ['language','subtitleMode','subtitlePosition','fontSize','fontColor','exportSize','burnSubtitles','originalVolume'];
let cues = [], media = null, mediaURL = '', duration = 0, voice = null, voiceURL = '', outputURL = '';
let worker = null, workerReject = null, ff = null, ffLoaded = false, job = null, selected = '', saveTimer, toastTimer;
let sourceTarget = 'source', restoring = false, lastFrame = '';
const logLines = [];
function log(message) {
  const line = `${new Date().toLocaleTimeString('vi-VN')}  ${message}`;
  logLines.push(line); if (logLines.length > 300) logLines.shift();
  $('logs').textContent = logLines.join('\n');
}
function toast(message, error = false) {
  $('toast').textContent = message; $('toast').classList.toggle('error',error); $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, error ? 14000 : 6000);
  if (error) log(message);
}
function bind(id, fn, event = 'click') {
  $(id).addEventListener(event, async e => {try {await fn(e);} catch (err) {toast(err.message || String(err),true);}});
}
function settings() {
  return Object.fromEntries(settingsIds.map(id => [id,$(id).type === 'checkbox' ? $(id).checked : $(id).value]));
}
function style() { return {mode:$('subtitleMode').value,size:Math.min(80,Math.max(16,Number($('fontSize').value) || 38)),color:$('fontColor').value,position:$('subtitlePosition').value}; }
function snapshot() { return {format:'sudan-pages',version:1,cues,settings:settings(),mediaName:media?.name || '',savedAt:new Date().toISOString()}; }
function db() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open('sudan-pages',1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function storeProject() {
  clearTimeout(saveTimer);
  try {
    const database = await db(), data = snapshot();
    await new Promise((resolve,reject) => {const tx=database.transaction('projects','readwrite');tx.objectStore('projects').put(data,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    database.close(); $('saveStatus').textContent = 'Đã lưu trên thiết bị';
  } catch { $('saveStatus').textContent = 'Không tự lưu được · Hãy tải dự án JSON'; }
}
function saveSoon() { if (restoring) return; $('saveStatus').textContent='Đang lưu…';clearTimeout(saveTimer);saveTimer=setTimeout(storeProject,350); }
function applySettings(data = {}) {
  for (const id of settingsIds) if (Object.hasOwn(data,id)) {
    if ($(id).type === 'checkbox') $(id).checked=Boolean(data[id]);
    else if ($(id).tagName === 'SELECT') {if ([...$(id).options].some(o=>o.value===String(data[id]))) $(id).value=data[id];}
    else if (id === 'fontColor') { if (/^#[0-9a-f]{6}$/i.test(data[id])) $(id).value=data[id]; }
    else $(id).value=String(Math.min(Number($(id).max),Math.max(Number($(id).min),Number(data[id]) || Number($(id).min))));
  }
  $('volumeLabel').value=$('originalVolume').value+'%';
}
async function restoreProject() {
  try {
    const database=await db();
    const data=await new Promise((resolve,reject)=>{const r=database.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    database.close();
    if (data?.format === 'sudan-pages') {
      restoring=true;cues=validateCues(data.cues);applySettings(data.settings);renderCues();restoring=false;
      if (cues.length) toast('Đã khôi phục phụ đề. Chọn lại video để tiếp tục.');
    }
  } catch { $('saveStatus').textContent='Tự lưu không khả dụng · Hãy tải JSON'; }
}
function download(data,name,type='text/plain;charset=utf-8') {
  const blob=data instanceof Blob ? data : new Blob([data],{type});
  const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function nameBase() {return (media?.name || 'sudan').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._ -]/gu,'_');}
function invalidateOutput() {
  if(outputURL) URL.revokeObjectURL(outputURL);outputURL='';$('renderResult').hidden=true;$('outputVideo').removeAttribute('src');$('outputVideo').load();
}
function voiceSignature() {return JSON.stringify(cues.map(c=>[c.id,c.start,c.end,c.vi]));}
function clearVoice() {
  if(voiceURL) URL.revokeObjectURL(voiceURL);voiceURL='';voice=null;
  $('voiceAudio').removeAttribute('src');$('voiceAudio').load();$('voiceResult').hidden=true;invalidateOutput();
}
function invalidateVoice() {
  if(voice?.generated && voice.signature!==voiceSignature()) {clearVoice();log('Đã bỏ giọng cũ vì nội dung hoặc mốc thời gian thay đổi. Tạo lại giọng sau khi sửa.');}
  invalidateOutput();
}
function setVoice(blob,label,generated=false) {
  clearVoice();voice={blob,label,generated,signature:voiceSignature()};voiceURL=URL.createObjectURL(blob);$('voiceAudio').src=voiceURL;$('voiceLabel').textContent=label;$('voiceResult').hidden=false;
}
function changed() {invalidateVoice();saveSoon();renderTimeline();updateSummary();drawSubtitle();}
function updateSummary() {
  const count=cues.filter((c,i)=>flags(c,cues[i-1],$('language').value).length).length;
  $('cueCount').textContent=`${cues.length} câu`;$('reviewCount').textContent=cues.length?`${count} câu cần kiểm tra · Chỉ là gợi ý`:'Chưa có phụ đề';
}
function el(tag,cls,text) {const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function renderCues() {
  const list=$('cueList'), query=$('search').value.toLocaleLowerCase(), filtered=$('onlyFlags').checked;
  list.replaceChildren();
  if(!cues.length) {
    const empty=el('div','empty-cues');empty.append(el('span','','≡'),el('h3','','Lời thoại bắt đầu ở đây'),el('p','','Nhập phụ đề có sẵn hoặc dùng AI để nhận diện.'));
    const demo=el('button','quiet accent','Thử dữ liệu mẫu →');demo.id='loadDemo';demo.addEventListener('click',loadDemo);empty.append(demo);list.append(empty);
  } else {
    const fragment=document.createDocumentFragment();let count=0;
    for(let i=0;i<cues.length;i++) {
      const c=cues[i], checks=flags(c,cues[i-1],$('language').value);
      if(query && !(c.source+' '+c.vi).toLocaleLowerCase().includes(query)) continue;
      if(filtered&&!checks.length)continue;
      count++;
      if(count>120)continue;
      const card=el('article','cue'+(selected===c.id?' selected':''));card.dataset.id=c.id;
      const head=el('div','cue-head');head.append(el('span','cue-number',String(i+1).padStart(2,'0')));
      const seek=el('button','cue-time','▶');seek.title='Phát từ câu này';seek.setAttribute('aria-label',`Phát câu ${i+1}`);
      seek.onclick=()=>seekTo(c.start,c.id);head.append(seek);
      for(const [key,label] of [['start','Bắt đầu'],['end','Kết thúc']]) {
        if(key==='end')head.append(el('span','muted','→'));
        const input=el('input');input.value=timecode(c[key]);input.setAttribute('aria-label',`${label} câu ${i+1}`);input.title='HH:MM:SS,mmm hoặc số giây';
        input.onchange=()=>{
          const n=seconds(input.value);
          if(!Number.isFinite(n)||n<0||n>86400||(key==='start'?n>=c.end:n<=c.start)) {toast('Thời gian không hợp lệ: kết thúc phải sau bắt đầu.',true);input.value=timecode(c[key]);return;}
          c[key]=n;cues.sort((a,b)=>a.start-b.start);changed();renderCues();
        };head.append(input);
      }
      const del=el('button','quiet delete-cue','×');del.setAttribute('aria-label',`Xóa câu ${i+1}`);del.onclick=()=>{cues=cues.filter(v=>v.id!==c.id);changed();renderCues();};head.append(del);card.append(head);
      const flagEl=el('div','cue-flags'+(checks.length?'':' ok'),checks.join(' · ')||'Không thấy dấu hiệu bất thường');
      for(const [key,label] of [['source','NGUYÊN VĂN'],['vi','TIẾNG VIỆT']]) {
        const wrap=el('label','',label), text=el('textarea');text.rows=2;text.value=c[key];text.maxLength=4000;text.setAttribute('aria-label',`${label} câu ${i+1}`);
        text.oninput=()=>{c[key]=text.value;changed();const j=cues.indexOf(c), fs=flags(c,cues[j-1],$('language').value);flagEl.textContent=fs.join(' · ')||'Không thấy dấu hiệu bất thường';flagEl.classList.toggle('ok',!fs.length);};
        wrap.append(text);card.append(wrap);
      }
      card.append(flagEl);fragment.append(card);
    }
    if(!count)fragment.append(el('p','muted','Không có câu khớp bộ lọc.'));
    if(count>120)fragment.append(el('p','hint',`Đang hiển thị 120/${count} câu. Tìm kiếm để chỉnh các câu khác hoặc xuất toàn bộ dự án.`));
    list.append(fragment);
  }
  updateSummary();renderTimeline();drawSubtitle();
}
function renderTimeline() {
  const box=$('timeline');box.replaceChildren();
  if(!cues.length) {box.append(el('span','muted','Phụ đề sẽ xuất hiện tại đây'));return;}
  const total=duration||Math.max(...cues.map(c=>c.end),1);
  for(const c of cues.slice(0,1500)) {
    if(c.start>=total)continue;
    const b=el('button',selected===c.id?'active':'',c.vi||c.source);b.style.left=(c.start/total*100)+'%';b.style.width=(Math.min(c.end,total)-c.start)/total*100+'%';b.title=`${timecode(c.start)} · ${c.vi||c.source}`;b.setAttribute('aria-label',b.title);b.onclick=()=>seekTo(c.start,c.id);box.append(b);
  }
}
function seekTo(time,id) {
  selected=id;
  if(media) {$('video').currentTime=Math.min(time,Math.max(0,duration-.01));$('video').play().catch(()=>{});}
  else toast('Chọn video để nghe lại câu này.');
  document.querySelectorAll('.cue').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));renderTimeline();
}
function drawSubtitle() {
  const v=$('video'), s=style(), active=cues.filter(c=>v.currentTime>=c.start&&v.currentTime<c.end);
  const text=s.mode==='none'?'':active.map(c=>cueText(c,s.mode)).filter(Boolean).join('\n');
  if(text!==lastFrame){$('subtitleOverlay').textContent=text;lastFrame=text;}
  const overlay=$('subtitleOverlay');overlay.style.color=s.color;overlay.style.fontSize=((v.clientHeight||250)/720*s.size)+'px';overlay.style.top=s.position==='top'?'7%':'auto';overlay.style.bottom=s.position==='top'?'auto':'14%';
  $('playhead').textContent=timecode(v.currentTime);
}
function needCues() {if(!cues.length)throw Error('Hãy nhập phụ đề hoặc nhận diện lời thoại trước.');}
function newId() {return 'c'+crypto.randomUUID();}
async function loadMedia(file) {
  if(!file)return;
  if(file.size>MAX_MEDIA)throw Error('Bản trình duyệt giới hạn mỗi video 200 MB. Hãy cắt clip ngắn hơn trước khi chọn.');
  if(!/^video\//.test(file.type)&&! /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name))throw Error('Hãy chọn file video.');
  if(mediaURL)URL.revokeObjectURL(mediaURL);clearVoice();
  media=file;mediaURL=URL.createObjectURL(file);duration=0;$('video').src=mediaURL;$('video').hidden=false;$('emptyMedia').hidden=true;$('mediaName').textContent=file.name;
  $('dropZone').removeAttribute('role');$('dropZone').tabIndex=-1;
  $('mediaInfo').textContent=`${(file.size/1024/1024).toFixed(1)} MB · Đang đọc video…`;
  log('Đã mở '+file.name);saveSoon();
}
function loadDemo() {
  if(job)return;
  if(cues.length&&!confirm('Thay phụ đề hiện tại bằng 3 câu mẫu?'))return;
  cues=validateCues([{start:0,end:3,source:'Hello, welcome to SuDan Studio.',vi:'Xin chào, chào mừng đến với SuDan Studio.'},{start:3.5,end:7,source:'Edit your subtitles right in the browser.',vi:'Chỉnh sửa phụ đề ngay trong trình duyệt.'},{start:7.5,end:11,source:'Tell your story in Vietnamese.',vi:''}]);
  $('language').value='en';changed();renderCues();toast('Đây là dữ liệu mẫu. Chọn video của bạn để xem phụ đề.');
}
function setBusy(value) {
  document.body.classList.toggle('busy',value);
  document.querySelectorAll('main button, main input, main select, main textarea, .header-actions button').forEach(n=>n.disabled=value);
  $('dropZone').style.pointerEvents=value?'none':'';
}
function progress(message,percent) {
  $('jobMessage').textContent=message;
  if(Number.isFinite(percent))$('jobProgress').value=Math.min(99,Math.max(0,percent));else $('jobProgress').removeAttribute('value');
}
async function run(title,fn) {
  if(job)throw Error('Đợi tác vụ hiện tại hoặc bấm Dừng.');
  job={cancelled:false};const current=job;setBusy(true);$('jobBox').hidden=false;$('jobTitle').textContent=title;progress('Đang chuẩn bị…');log(title);
  try {await fn(current);if(current.cancelled)throw Error('Đã dừng tác vụ.');log('Hoàn thành: '+title);toast('Hoàn thành: '+title);}
  catch(err){if(current.cancelled){log('Đã dừng: '+title);toast('Đã dừng. Các câu đã dịch được giữ lại.');}else toast(err.message||String(err),true);}
  finally {job=null;setBusy(false);$('jobBox').hidden=true;renderCues();await storeProject();}
}
function assertRunning(current) {if(current?.cancelled)throw Error('Đã dừng tác vụ.');}
async function getFF() {
  if(ff&&ffLoaded)return ff;
  progress('Đang nạp bộ xử lý video (~31 MB)…');
  const {FFmpeg}=await import('./vendor/ffmpeg/index.js');
  if(job?.cancelled)throw Error('Đã dừng tác vụ.');
  ff=new FFmpeg();
  ff.on('log',({message})=>log(message));
  const base=new URL('./vendor/ffmpeg/',import.meta.url);
  const manifest=await fetch(new URL('wasm-parts.json',base));
  if(!manifest.ok)throw Error('Thiếu thư viện FFmpeg. Hãy tải đầy đủ thư mục vendor lên GitHub.');
  const parts=await manifest.json(), buffers=[];
  for(let i=0;i<parts.length;i++) {
    if(job?.cancelled)throw Error('Đã dừng tác vụ.');
    progress(`Đang nạp bộ xử lý video ${i+1}/${parts.length}…`);
    const response=await fetch(new URL(parts[i],base));if(!response.ok)throw Error('Không tải được thành phần FFmpeg: '+parts[i]);
    buffers.push(await response.arrayBuffer());
  }
  const wasmURL=URL.createObjectURL(new Blob(buffers,{type:'application/wasm'}));
  try{await ff.load({coreURL:new URL('ffmpeg-core.js',base).href,wasmURL});ffLoaded=true;}
  finally{URL.revokeObjectURL(wasmURL);}
  return ff;
}
async function exec(args) {
  const code=await ff.exec(args);if(code!==0)throw Error('Không xử lý được media. Xem Nhật ký xử lý để biết lỗi codec hoặc bộ nhớ.');
}
async function cleanFS() {
  if(!ffLoaded||!ff)return;
  try {for(const e of await ff.listDir('/'))if(!e.isDir)await ff.deleteFile(e.name);}catch{}
}
async function extractAudio(current) {
  if(!media)throw Error('Chọn video trước khi nhận diện.');
  if(!duration)throw Error('Video chưa đọc được thời lượng. Hãy dùng MP4 H.264/AAC hoặc WebM tương thích trình duyệt.');
  if(duration>MAX_DURATION)throw Error('AI trong bản web giới hạn video 20 phút. Hãy cắt clip ngắn hơn.');
  await getFF();assertRunning(current);progress('Đang tách âm thanh 16 kHz cho Whisper…');
  try {
    await ff.writeFile('source.media',new Uint8Array(await media.arrayBuffer()));
    await exec(['-i','source.media','-vn','-map','0:a:0','-ac','1','-ar','16000','-f','s16le','speech.pcm']);
    assertRunning(current);return decodePcm16(await ff.readFile('speech.pcm'));
  } finally {await cleanFS();}
}
function ai(task,payload,onUpdate,transfer=[]) {
  if(!worker)worker=new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
  return new Promise((resolve,reject)=>{
    workerReject=reject;
    worker.onmessage=({data})=>{
      if(data.type==='error'){workerReject=null;worker.terminate();worker=null;reject(Error('AI: '+data.message));}
      else if(data.type==='result'){workerReject=null;resolve(data.result);}
      else if(data.type==='download')progress(`Tải ${data.file}: ${Number(data.progress||0).toFixed(0)}% (${(data.loaded/1024/1024).toFixed(1)} MB)`,data.progress);
      else if(data.type==='status')progress(data.text);
      else {onUpdate?.(data);if(data.total)progress(`Đã xong ${data.done}/${data.total} câu`,data.done/data.total*100);}
    };
    worker.onerror=e=>{workerReject=null;worker?.terminate();worker=null;reject(Error('Không chạy được mô hình AI: '+(e.message||'hết RAM hoặc không tải được mô hình. Thử clip ngắn hơn.')));};
    worker.postMessage({task,...payload},transfer);
  });
}
async function transcribe() {
  if(!media)throw Error('Chọn video trước.');
  if(cues.length&&!confirm('Nhận diện lại sẽ thay toàn bộ phụ đề hiện tại. Tiếp tục?'))return;
  await run('Nhận diện lời thoại bằng Whisper',async current=>{
    const audio=await extractAudio(current);assertRunning(current);
    progress('Đang chuẩn bị Whisper Tiny. Lần đầu cần tải mô hình…');
    const result=await ai('asr',{audio,language:$('language').value},null,[audio.buffer]);assertRunning(current);
    const chunks=(result.chunks||[]).filter(c=>c.text.trim());
    const input=chunks.map((c,i)=>{
      const start=c.timestamp?.[0]??0,end=c.timestamp?.[1]??chunks[i+1]?.timestamp?.[0]??duration;
      return {start:Math.max(0,start),end:Math.min(duration,Math.max(start+.01,end)),source:c.text.trim(),vi:$('language').value==='vi'?c.text.trim():''};
    }).filter(c=>c.end>c.start);
    if(!input.length)throw Error('Không nhận diện được lời thoại. Thử nhập SRT hoặc clip có tiếng nói rõ hơn.');
    cues=validateCues(input);changed();log(`Whisper: ${cues.length} câu. Cần nghe lại để kiểm tra độ chính xác.`);
  });
}
async function translate() {
  needCues();if($('language').value==='vi')throw Error('Nguồn đã là tiếng Việt. Nhập hoặc sửa trực tiếp cột Tiếng Việt.');
  const todo=cues.filter(c=>c.source.trim()&&!c.vi.trim());
  if(!todo.length)throw Error('Không có câu gốc thiếu bản Việt. Để dịch lại, xóa nội dung bản Việt cần thay.');
  if(!confirm('Dịch tại thiết bị cần tải mô hình NLLB khoảng 900 MB lần đầu, có thể cần vài GB RAM và chạy chậm. Chỉ dịch các câu chưa có bản Việt. Tiếp tục?'))return;
  await run('Dịch lời thoại sang tiếng Việt',async current=>{
    await ai('translate',{cues:todo.map(c=>({id:c.id,source:c.source})),language:$('language').value},data=>{
      if(data.type==='translation'){const c=cues.find(c=>c.id===data.id);if(c){c.vi=data.text;changed();}}
    });assertRunning(current);
  });
}
async function alignVoice(pieces,current) {
  const total=duration||Math.max(...cues.map(c=>c.end));
  if(total>MAX_DURATION)throw Error('Giọng WAV trong bản web giới hạn dự án 20 phút.');
  const rate=16000,mixed=new Float32Array(Math.ceil(total*rate));let cut=0;
  await getFF();
  try {
    for(let i=0;i<pieces.length;i++) {
      assertRunning(current);const {id,audio,rate:sampleRate}=pieces[i], c=cues.find(c=>c.id===id);if(!c)continue;
      const slot=c.end-c.start, natural=audio.length/sampleRate, tempo=Math.max(1,Math.min(2,natural/slot));
      if(natural/slot>2)cut++;
      progress(`Đang căn giọng theo mốc thời gian ${i+1}/${pieces.length}…`,i/pieces.length*100);
      await ff.writeFile('cue.wav',wavBytes(audio,sampleRate));
      await exec(['-i','cue.wav','-af',`atempo=${tempo.toFixed(5)},apad,atrim=duration=${slot.toFixed(3)}`,'-ar',String(rate),'-ac','1','-f','s16le','-y','cue.pcm']);
      const pcm=decodePcm16(await ff.readFile('cue.pcm')), offset=Math.round(c.start*rate);
      for(let n=0;n<pcm.length&&offset+n<mixed.length;n++) {
        const fade=Math.min(1,n/(rate*.008),(pcm.length-1-n)/(rate*.008));mixed[offset+n]+=pcm[n]*Math.max(0,fade);
      }
    }
    for(let i=0;i<mixed.length;i++)mixed[i]=Math.max(-1,Math.min(1,mixed[i]));
    if(cut){log(`${cut} câu dài quá 2× khung thời gian, đã bị cắt. Hãy rút gọn bản Việt rồi tạo lại giọng.`);toast(`${cut} câu quá dài và bị cắt. Xem nhật ký, nghe lại WAV.`,true);}
    return new Blob([wavBytes(mixed,rate)],{type:'audio/wav'});
  } finally {await cleanFS();}
}
async function generateVoice() {
  needCues();const todo=cues.filter(c=>c.vi.trim());
  if(!todo.length)throw Error('Chưa có bản Việt để tạo giọng.');
  if(todo.some(c=>c.vi.length>500))throw Error('Mỗi câu tạo giọng tối đa 500 ký tự. Hãy chia nhỏ câu dài trước.');
  if(cues.some(c=>!c.vi.trim())&&!confirm('Một số câu chưa có bản Việt và sẽ không có giọng đọc. Tiếp tục?'))return;
  if((duration||Math.max(...cues.map(c=>c.end)))>MAX_DURATION)throw Error('Tạo giọng tối đa 20 phút mỗi dự án.');
  if(voice&&!confirm('Thay bản lồng tiếng hiện tại?'))return;
  await run('Tạo lồng tiếng Việt',async current=>{
    const pieces=[];
    await ai('tts',{cues:todo.map(c=>({id:c.id,vi:c.vi}))},data=>{if(data.type==='speech')pieces.push(data);});assertRunning(current);
    const blob=await alignVoice(pieces,current);assertRunning(current);setVoice(blob,'MMS · Giọng Việt đã căn thời gian',true);
  });
}
async function renderVideo() {
  if(!media||!duration)throw Error('Chọn video đọc được thời lượng trước.');
  if(duration>MAX_DURATION)throw Error('Xuất video trong bản web giới hạn 20 phút. Hãy dùng clip ngắn hơn.');
  const s=style(),subtitles=s.mode!=='none'&&cues.length>0;
  if(subtitles&&s.mode==='vi'&&cues.some(c=>!c.vi.trim())&&!confirm('Có câu chưa có bản Việt, các câu đó sẽ không hiện phụ đề. Tiếp tục?'))return;
  await run('Xuất video MP4',async current=>{
    await getFF();assertRunning(current);progress('Đang chuẩn bị video và phụ đề…');
    let hasSourceAudio=false,listen;
    try {
      await ff.writeFile('input.media',new Uint8Array(await media.arrayBuffer()));
      if(voice)await ff.writeFile('voice.audio',new Uint8Array(await voice.blob.arrayBuffer()));
      if(subtitles){await ff.writeFile('subtitles.ass',new TextEncoder().encode(toAss(cues,s)));await ff.writeFile('subtitles.srt',new TextEncoder().encode(toSrt(cues,s.mode)));}
      const burn=subtitles&&$('burnSubtitles').checked,soft=subtitles&&!burn;
      if(burn){const font=await fetch(new URL('./assets/DejaVuSans.ttf',import.meta.url));if(!font.ok)throw Error('Không tải được font tiếng Việt.');await ff.writeFile('DejaVuSans.ttf',new Uint8Array(await font.arrayBuffer()));}
      if(voice) {
        const listener=({message})=>{if(/Stream #0:.*Audio:/.test(message))hasSourceAudio=true;};ff.on('log',listener);
        try {await ff.exec(['-i','input.media','-map','0:a:0','-t','0.01','-f','null','-']);}finally{ff.off('log',listener);}
      }
      const args=['-i','input.media'];if(voice)args.push('-i','voice.audio');if(soft)args.push('-i','subtitles.srt');
      const volume=Number($('originalVolume').value)/100;
      if(voice&&hasSourceAudio&&volume>0) {
        args.push('-filter_complex',`[0:a:0]volume=${volume}[original];[1:a:0]apad[dub];[original][dub]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[mix]`,'-map','0:v:0','-map','[mix]');
      } else {args.push('-map','0:v:0','-map',voice?'1:a:0':'0:a:0?');if(voice)args.push('-af','apad');}
      if(soft)args.push('-map',voice?'2:0':'1:0','-c:s','mov_text','-metadata:s:s:0',s.mode==='source'?'language=und':'language=vie');
      const filters=[];const size=$('exportSize').value;
      if(size!=='original') filters.push(`scale=w='min(iw,${Number(size)*16/9})':h='min(ih,${size})':force_original_aspect_ratio=decrease:force_divisible_by=2`);
      else filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
      if(burn)filters.push('ass=subtitles.ass:fontsdir=.');
      args.push('-vf',filters.join(','),'-c:v','libx264','-preset','ultrafast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-t',duration.toFixed(3),'-threads','1','-movflags','+faststart','-y','output.mp4');
      progress('Đang mã hóa MP4. Giữ tab mở…',0);
      listen=({progress:p,time})=>{const percent=time>0?time/1000000/duration*100:p*100;progress(`Đang mã hóa MP4 · ${Math.min(99,Math.max(0,percent)).toFixed(0)}%`,percent);};ff.on('progress',listen);
      await exec(args);assertRunning(current);
      const bytes=await ff.readFile('output.mp4');invalidateOutput();outputURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
      $('outputVideo').src=outputURL;$('downloadVideo').href=outputURL;$('downloadVideo').download=nameBase()+'-sudan.mp4';$('renderResult').hidden=false;
      log(`MP4 xuất xong: ${(bytes.length/1024/1024).toFixed(1)} MB`);
    } finally {if(listen&&ff)ff.off('progress',listen);await cleanFS();}
  });
}
function exportSub(format) {
  needCues();const s=style();if(s.mode==='none')throw Error('Chọn nội dung phụ đề trong mục Xuất file trước.');
  const text=format==='srt'?toSrt(cues,s.mode):format==='vtt'?toVtt(cues,s.mode):toAss(cues,s);
  download(text,`${nameBase()}-${s.mode}.${format}`,format==='vtt'?'text/vtt;charset=utf-8':'text/plain;charset=utf-8');
}

// Navigation and file inputs use only relative URLs, including project Pages subpaths.
for(const b of document.querySelectorAll('.tab')) b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-selected',String(t===b));});
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==b.dataset.panel);drawSubtitle();
});
bind('chooseVideo',e=>{e.stopPropagation();$('videoFile').click();});bind('replaceVideo',()=>$('videoFile').click());
$('dropZone').addEventListener('click',e=>{if(!media&&e.target.id!=='chooseVideo')$('videoFile').click();});
$('dropZone').addEventListener('keydown',e=>{if(!media&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('videoFile').click();}});
$('dropZone').addEventListener('dragover',e=>{e.preventDefault();if(!job)$('dropZone').classList.add('dragging');});
$('dropZone').addEventListener('dragleave',()=>$('dropZone').classList.remove('dragging'));
$('dropZone').addEventListener('drop',async e=>{e.preventDefault();$('dropZone').classList.remove('dragging');if(job)return;try{await loadMedia(e.dataTransfer.files[0]);}catch(err){toast(err.message,true);}});
bind('videoFile',async e=>{const f=e.target.files[0];e.target.value='';await loadMedia(f);},'change');
$('video').addEventListener('loadedmetadata',()=>{
  duration=Number.isFinite($('video').duration)?$('video').duration:0;
  $('mediaInfo').textContent=`${(media.size/1024/1024).toFixed(1)} MB · ${$('video').videoWidth} × ${$('video').videoHeight} · ${timecode(duration)}`;
  if(duration>MAX_DURATION)toast('Clip dài hơn 20 phút: vẫn xem và sửa phụ đề được, cần cắt ngắn trước khi dùng AI hoặc xuất video.');
  renderTimeline();drawSubtitle();
});
$('video').addEventListener('error',()=>toast('Trình duyệt không phát được video này. Hãy đổi sang MP4 H.264/AAC hoặc WebM.',true));
$('video').addEventListener('timeupdate',drawSubtitle);$('video').addEventListener('seeked',drawSubtitle);new ResizeObserver(drawSubtitle).observe($('video'));
bind('importSource',()=>{sourceTarget='source';$('subtitleFile').click();});bind('importVi',()=>{sourceTarget='vi';$('subtitleFile').click();});
bind('subtitleFile',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024)throw Error('File phụ đề tối đa 5 MB.');
  const imported=parseSubtitles(await file.text(),sourceTarget);
  if(sourceTarget==='source') {if(cues.length&&!confirm('Thay toàn bộ phụ đề hiện tại?'))return;cues=imported;}
  else cues=mergeVietnamese(cues,imported);
  changed();renderCues();toast(`Đã nhập ${imported.length} câu từ ${file.name}`);
},'change');
bind('saveProject',()=>download(JSON.stringify(snapshot(),null,2),nameBase()+'.sudan.json','application/json'));
bind('openProject',()=>$('projectFile').click());
bind('projectFile',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>10*1024*1024)throw Error('Dự án JSON tối đa 10 MB.');
  let data;try{data=JSON.parse(await file.text());}catch{throw Error('File JSON không hợp lệ.');}
  if(data.format!=='sudan-pages'||data.version!==1)throw Error('Chỉ hỗ trợ dự án JSON của SuDan Pages v6.');
  const incoming=validateCues(data.cues);if(cues.length&&!confirm('Thay dự án đang mở?'))return;
  cues=incoming;applySettings(data.settings);clearVoice();changed();renderCues();toast('Đã mở dự án. Chọn video tương ứng nếu cần.');
},'change');
bind('search',renderCues,'input');bind('onlyFlags',renderCues,'change');
bind('addCue',()=>{const start=$('video').currentTime||0;cues.push({id:newId(),start,end:duration?Math.max(start+.05,Math.min(duration,start+3)):start+3,source:'',vi:''});cues.sort((a,b)=>a.start-b.start);changed();renderCues();});
bind('shiftBtn',()=>{needCues();cues=shiftCues(cues,Number($('shiftValue').value));changed();renderCues();});
bind('replaceBtn',()=>{needCues();const find=$('findValue').value;if(!find)throw Error('Nhập nội dung cần tìm.');let n=0;for(const c of cues)if(c.vi.includes(find)){c.vi=c.vi.split(find).join($('replaceValue').value);n++;}changed();renderCues();toast(`Đã thay nội dung trong ${n} câu.`);});
bind('clearCues',()=>{if(!cues.length||!confirm('Xóa toàn bộ phụ đề? Hãy lưu JSON nếu cần giữ bản cũ.'))return;cues=[];changed();renderCues();});
bind('resetProject',()=>{if(!confirm('Tạo dự án mới? Hãy tải JSON để giữ phụ đề hiện tại.'))return;cues=[];clearVoice();if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL='';media=null;duration=0;$('video').removeAttribute('src');$('video').load();$('video').hidden=true;$('emptyMedia').hidden=false;$('mediaName').textContent='Chưa chọn video';$('mediaInfo').textContent='Video được giữ trên máy, không tải lên GitHub';$('dropZone').setAttribute('role','button');$('dropZone').tabIndex=0;changed();renderCues();});
for(const id of settingsIds)bind(id,()=>{if(id==='originalVolume')$('volumeLabel').value=$('originalVolume').value+'%';invalidateOutput();saveSoon();drawSubtitle();if(id==='language')renderCues();},'input');
bind('transcribe',transcribe);bind('translate',translate);bind('generateVoice',generateVoice);bind('renderVideo',renderVideo);
bind('importAudio',()=>$('audioFile').click());
bind('audioFile',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>100*1024*1024)throw Error('Âm thanh lồng tiếng tối đa 100 MB.');if(voice&&!confirm('Thay bản lồng tiếng hiện tại?'))return;setVoice(file,file.name);toast('Đã nhập bản lồng tiếng. Bấm phát để nghe thử trước khi xuất.');},'change');
bind('removeVoice',clearVoice);bind('downloadVoice',()=>{if(voice)download(voice.blob,voice.generated?nameBase()+'-long-tieng.wav':voice.label);});
$('voiceAudio').addEventListener('error',()=>toast('Không đọc được bản thu này. Hãy dùng WAV hoặc MP3.',true));
bind('cancelJob',()=>{if(!job)return;job.cancelled=true;workerReject?.(Error('Đã dừng'));workerReject=null;worker?.terminate();worker=null;if(ff){try{ff.terminate();}catch{}ff=null;ffLoaded=false;}});
bind('exportSrt',()=>exportSub('srt'));bind('exportVtt',()=>exportSub('vtt'));bind('exportAss',()=>exportSub('ass'));bind('exportCsv',()=>{needCues();download(toCsv(cues,$('language').value),nameBase()+'-kiem-dich.csv','text/csv;charset=utf-8');});
bind('helpBtn',()=>$('helpDialog').showModal());bind('logsBtn',()=>$('logsDialog').showModal());document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function loadBrowserVoices() {
  const voices=window.speechSynthesis?.getVoices()||[];$('browserVoice').replaceChildren();
  for(const [i,v]of voices.entries()){const option=el('option','',`${v.name} (${v.lang})`);option.value=i;if(v.lang.startsWith('vi'))option.selected=true;$('browserVoice').append(option);}
  if(!voices.length)$('browserVoice').append(el('option','','Chưa có giọng trên trình duyệt này'));
}
bind('speak',()=>{if(!window.speechSynthesis)throw Error('Trình duyệt không hỗ trợ nghe thử.');const voices=speechSynthesis.getVoices(),voice=voices[Number($('browserVoice').value)];if(!voice)throw Error('Không có giọng để nghe thử.');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance($('speechText').value);u.voice=voice;u.lang=voice.lang;speechSynthesis.speak(u);});
bind('stopSpeech',()=>window.speechSynthesis?.cancel());if(window.speechSynthesis)speechSynthesis.addEventListener('voiceschanged',loadBrowserVoices);loadBrowserVoices();
window.addEventListener('beforeunload',e=>{if(job){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{window.speechSynthesis?.cancel();});
log('SuDan Pages 6.0 · Không dùng Python hay máy chủ API.');
renderCues();await restoreProject();
