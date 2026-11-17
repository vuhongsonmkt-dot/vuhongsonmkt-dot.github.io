export function timecode(value, separator = ',') {
  const ms = Math.max(0, Math.round((Number(value) || 0) * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
}
export function seconds(text) {
  if (typeof text === 'number') return text;
  const s = String(text).trim();
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  const m = s.match(/^(?:(\d+):)?([0-5]?\d):([0-5]\d)[,.](\d{1,3})$/);
  if (!m) return NaN;
  return ((Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4].padEnd(3, '0'))) / 1000;
}
function plain(text) {
  return String(text).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
export function validateCues(cues) {
  if (!Array.isArray(cues) || cues.length > 10000) throw Error('Dự án chỉ hỗ trợ tối đa 10.000 câu.');
  return cues.map((c, i) => {
    const start = Number(c.start), end = Number(c.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 86400) throw Error(`Câu ${i + 1}: thời gian không hợp lệ.`);
    const source = String(c.source ?? c.zh ?? c.text ?? '').slice(0, 4000);
    const vi = String(c.vi ?? '').slice(0, 4000);
    return {id: `c${i + 1}`, start, end, source, vi};
  }).sort((a, b) => a.start - b.start);
}
export function parseSubtitles(input, target = 'source') {
  const lines = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{1,3})/);
    if (!m) continue;
    const texts = [];
    while (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes('-->')) texts.push(lines[++i]);
    cues.push({start: seconds(m[1]), end: seconds(m[2]), source: '', vi: '', [target]: plain(texts.join('\n')).trim()});
  }
  if (!cues.length) throw Error('Không tìm thấy phụ đề SRT/VTT hợp lệ.');
  return validateCues(cues);
}
export function mergeVietnamese(cues, imported) {
  if (!cues.length) return imported;
  const used = new Set();
  const merged = cues.map(c => {
    const matches = imported.map((v, index) => ({v, index, delta: Math.abs(c.start - v.start) + Math.abs(c.end - v.end)})).filter(x => !used.has(x.index) && Math.abs(c.start - x.v.start) <= 0.3 && Math.abs(c.end - x.v.end) <= 0.3).sort((a,b) => a.delta - b.delta);
    if (matches.length) { used.add(matches[0].index); return {...c, vi: matches[0].v.vi}; }
    return {...c};
  });
  if (used.size !== imported.length) throw Error('Mốc thời gian của bản Việt không khớp bản gốc (sai lệch tối đa 0,3 giây). Hãy nhập bản Việt vào dự án trống hoặc chỉnh lại thời gian.');
  return merged;
}
export function cueText(cue, mode = 'vi') {
  return mode === 'bilingual' ? [cue.vi, cue.source].filter(Boolean).join('\n') : mode === 'source' ? cue.source : cue.vi;
}
export function toSrt(cues, mode = 'vi') {
  return cues.map((c, i) => `${i + 1}\n${timecode(c.start)} --> ${timecode(c.end)}\n${cueText(c, mode) || ' '}\n`).join('\n');
}
export function toVtt(cues, mode = 'vi') { return 'WEBVTT\n\n' + toSrt(cues, mode).replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); }
export function flags(c, previous, language = 'zh') {
  const checks = [], src = c.source.trim(), vi = c.vi.trim();
  if (!vi) checks.push('Thiếu bản dịch');
  if (vi && language === 'zh' && /[\u3400-\u9fff]/.test(vi)) checks.push('Còn chữ Trung');
  if (vi && src && src.toLocaleLowerCase() === vi.toLocaleLowerCase()) checks.push('Trùng nguyên văn');
  if (src.length >= 12 && vi.length && vi.length <= 2) checks.push('Bản dịch quá ngắn');
  if (src.length >= 8 && vi.length > Math.max(120, src.length * 7)) checks.push('Bản dịch quá dài');
  if (vi.length / (c.end - c.start) > 25) checks.push('Khó đọc kịp');
  if (previous && c.start < previous.end - 0.01) checks.push('Chồng thời gian');
  return checks;
}
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function toCsv(cues, language) {
  return '\uFEFF' + [['STT','Bắt đầu','Kết thúc','Nguyên văn','Tiếng Việt','Cần kiểm tra'], ...cues.map((c,i) => [i + 1,c.start,c.end,c.source,c.vi,flags(c,cues[i-1],language).join('; ')])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function shiftCues(cues, delta) {
  if (!Number.isFinite(delta) || cues.some(c => c.start + delta < 0 || c.end + delta > 86400)) throw Error('Độ lệch khiến phụ đề nằm ngoài khoảng 0–24 giờ.');
  return cues.map(c => ({...c,start: c.start + delta,end: c.end + delta}));
}
function assTime(n) { return timecode(n,'.').replace(/^0/, '').slice(0,-1); }
function assText(text) { return text.replace(/\\/g,'＼').replace(/{/g,'｛').replace(/}/g,'｝').replace(/\r?\n/g,'\\N'); }
export function toAss(cues, {mode='vi',size=38,color='#ffffff',position='bottom'} = {}) {
  const rgb = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : 'ffffff';
  const bgr = rgb.slice(4,6) + rgb.slice(2,4) + rgb.slice(0,2);
  const align = position === 'top' ? 8 : 2;
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,${Math.min(80,Math.max(16,size))},&H00${bgr},&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,${align},40,40,42,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` + cues.map(c => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${assText(cueText(c,mode))}`).join('\n');
}
