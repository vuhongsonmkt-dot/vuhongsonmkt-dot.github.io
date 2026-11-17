import {pipeline, env} from './vendor/transformers.min.js';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/onnx/', import.meta.url).href;
let loaded = null, loadedTask = '';
const tell = (type, extra = {}) => self.postMessage({type,...extra});
async function getPipeline(task, model) {
  if (loaded && loadedTask !== task) { await loaded.dispose(); loaded = null; loadedTask = ''; }
  if (!loaded) {
    loaded = await pipeline(task, model, {quantized:true,progress_callback: p => {
      if (p.status === 'progress') tell('download',{file:p.file,progress:p.progress,loaded:p.loaded,total:p.total});
      else if (p.status === 'initiate') tell('status',{text:'Đang tải mô hình: ' + p.file});
    }});
    loadedTask = task;
  }
  return loaded;
}
self.onmessage = async ({data}) => {
  try {
    if (data.task === 'asr') {
      const p = await getPipeline('automatic-speech-recognition','Xenova/whisper-tiny');
      tell('status',{text:'Whisper đang nghe và nhận diện…'});
      const result = await p(data.audio,{language: data.language === 'zh' ? 'chinese' : data.language === 'vi' ? 'vietnamese' : 'english', task:'transcribe',return_timestamps:true,chunk_length_s:30,stride_length_s:5});
      tell('result',{result});
    } else if (data.task === 'translate') {
      const p = await getPipeline('translation','Xenova/nllb-200-distilled-600M');
      for (let i = 0; i < data.cues.length; i++) {
        const c = data.cues[i];
        tell('status',{text:`Đang dịch câu ${i + 1}/${data.cues.length}…`});
        const result = await p(c.source,{src_lang: data.language === 'zh' ? 'zho_Hans' : 'eng_Latn',tgt_lang:'vie_Latn',max_new_tokens:256});
        tell('translation',{id:c.id,text:result[0].translation_text,done:i + 1,total:data.cues.length});
      }
      tell('result',{result:true});
    } else if (data.task === 'tts') {
      const p = await getPipeline('text-to-speech','Xenova/mms-tts-vie');
      for (let i = 0; i < data.cues.length; i++) {
        const c = data.cues[i];
        tell('status',{text:`Đang tạo giọng Việt ${i + 1}/${data.cues.length}…`});
        const result = await p(c.vi);
        self.postMessage({type:'speech',id:c.id,audio:result.audio,rate:result.sampling_rate,done:i + 1,total:data.cues.length},[result.audio.buffer]);
      }
      tell('result',{result:true});
    }
  } catch (e) { tell('error',{message: e.message || String(e)}); }
};
