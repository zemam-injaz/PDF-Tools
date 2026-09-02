import { tokenize, buildChunks } from './src/lib/reader/Tokenizer.ts';
import { chunkDwellMs, effectiveWPM } from './src/lib/reader/TimingEngine.ts';

const text = "خيار العيب وخيار التخبير بالثمن. ذهب الطالب إلى المدرسة في الصباح الباكر، ولكن لم يجد أحداً.";
const tokens = tokenize(text, 'ar');
const chunks = buildChunks(tokens, 1, 'ar');
const chunks2 = buildChunks(tokens, 2, 'ar');

console.log("CHUNKS (size 1):");
for (const c of chunks) {
  console.log(c.map(t => t.text).join(' '), "=> Dwell:", chunkDwellMs(c, 250));
}

console.log("\nCHUNKS (size 2):");
for (const c of chunks2) {
  console.log(c.map(t => t.text).join(' '), "=> Dwell:", chunkDwellMs(c, 250));
}
