// node stills.mjs [TutorialZH] <seconds...>  -> stills/s<sec>.jpg (half size)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
let args = process.argv.slice(2);
const id = /^Tutorial/.test(args[0]) ? args.shift() : 'TutorialZH';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id});
console.log('duration', (composition.durationInFrames / 30).toFixed(1), 's');
for (const s of args.map(Number)) {
  await renderStill({serveUrl, composition, frame: Math.round(s * 30), output: `stills/s${s}.jpg`, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.6});
  console.log('ok', s);
}
