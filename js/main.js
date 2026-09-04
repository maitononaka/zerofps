import { bindUI, state, go } from './ui.js';

let game = null;
let gamePromise = null;

// Bind the menu FIRST. This keeps the deploy/loadout/settings buttons usable
// even when the optional WebGL/Three.js game module fails to initialize.
async function getGame(){
  if(game) return game;
  if(!gamePromise){
    gamePromise = import('./game.js').then(({ ZeroDivisionGame })=>{
      game = new ZeroDivisionGame();
      return game;
    }).catch(err=>{
      console.error('ZERO DIVISION game module failed to initialize:', err);
      gamePromise = null;
      showInitError(err);
      throw err;
    });
  }
  return gamePromise;
}

function showInitError(err){
  const existing=document.getElementById('init-error');
  if(existing) return;
  const el=document.createElement('div');
  el.id='init-error';
  el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(720px,90vw);padding:12px 16px;background:rgba(80,12,12,.94);border:1px solid #d66;color:#fff;font:12px/1.5 ui-monospace,monospace;pointer-events:auto;';
  el.textContent='ゲーム本体の初期化に失敗しました。Consoleを確認してください。';
  document.body.appendChild(el);
}

bindUI(async ()=>{
  const g=await getGame();
  await g.start(state.map,state.bots);
});

// Preload the game after the menu is already interactive.
// This is intentionally non-blocking.
getGame().catch(()=>{});
