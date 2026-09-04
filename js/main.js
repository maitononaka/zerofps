import { bindUI, state } from './ui.js';
import { ZeroDivisionGame } from './game.js';
const game=new ZeroDivisionGame();
bindUI(()=>game.start(state.map,state.bots));
