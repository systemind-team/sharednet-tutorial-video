import {cueSheet, totalSeconds} from './Root';
console.log(JSON.stringify({zh: cueSheet('zh'), en: cueSheet('en'), total: totalSeconds()}));
