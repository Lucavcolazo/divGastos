import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';

import './styles/base.css';
import './styles/hero.css';
import './styles/summary.css';
import './styles/desk.css';
import './styles/printer.css';
import './styles/calculator.css';
import './styles/toast.css';

import { $ } from './lib/dom.js';
import { initHero } from './features/hero.js';
import { initSummary } from './features/summary.js';
import { initCalculator } from './features/calculator.js';
import { initPrinter } from './features/printer.js';
import { initKeyboard } from './features/keyboard.js';

initHero();
initSummary();
initCalculator();
initPrinter();
initKeyboard();

// three.js va en un chunk aparte: la calculadora anda al instante y el fondo llega después
import('./features/background.js').then(m => m.initBackground($('bg')));
