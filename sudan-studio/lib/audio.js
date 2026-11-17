export function wavBytes(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buffer);
  const text = (offset, s) => {for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));};
  text(0,'RIFF'); v.setUint32(4,36 + samples.length * 2,true); text(8,'WAVE'); text(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,sampleRate,true);
  v.setUint32(28,sampleRate * 2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); text(36,'data'); v.setUint32(40,samples.length * 2,true);
  for (let i = 0; i < samples.length; i++) { const n = Math.max(-1,Math.min(1,samples[i])); v.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767,true); }
  return new Uint8Array(buffer);
}
export function decodePcm16(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), out = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2,true) / 32768;
  return out;
}
