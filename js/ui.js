export const state = {
  screen: 'deploy-screen', map:'city', bots:6,
  armor:'Light', helmet:'Recon', primary:'Scanner', secondary:'Beacon', utility:'Med Kit',
  settings:{dashMode:'toggle',crouchMode:'toggle',hands:true,sensitivity:1,shake:.35,pixelRatio:1.5,shadows:true,sky:true}
};

export const DATA={
 armor:[['Light','Fast / low profile'],['Plate','Balanced / protected'],['Heavy','Slow / robust']],
 helmet:[['Recon','Low profile'],['Tactical','Wide visor'],['Heavy','Extra bulk']],
 primary:[['Scanner','Range 60m'],['Tablet','Map overlay'],['Camera','Optical probe']],
 secondary:[['Beacon','Tag locations'],['Radio','Ping network'],['Sensor','Motion read']],
 utility:[['Med Kit','Recovery sim'],['Toolkit','Repair sim'],['Battery','Power cell']],
};

const $=id=>document.getElementById(id);
function renderChoices(type, elId){
  const el=$(elId); el.innerHTML='';
  for(const [name,desc] of DATA[type]){
    const b=document.createElement('button'); b.className='choice'; b.dataset.value=name; b.innerHTML=`<b>${name}</b><small>${desc}</small>`;
    if(state[type]===name)b.classList.add('selected');
    b.onclick=()=>{state[type]=name;renderChoices(type,elId);updatePreview();}; el.appendChild(b);
  }
}
export function updatePreview(){
  const p=$('operator-preview'); if(!p)return;
  p.innerHTML=`<div style="width:130px;height:310px;position:relative;filter:drop-shadow(0 14px 18px #000)">
    <div style="position:absolute;left:47px;top:12px;width:36px;height:36px;border-radius:50%;background:#c9b8a6;border:4px solid #222"></div>
    <div style="position:absolute;left:32px;top:55px;width:66px;height:90px;border-radius:18px 18px 13px 13px;background:${armorColor(state.armor)};border:4px solid #20262a"></div>
    <div style="position:absolute;left:19px;top:64px;width:20px;height:70px;border-radius:9px;background:#364249;transform:rotate(8deg)"></div>
    <div style="position:absolute;right:19px;top:64px;width:20px;height:70px;border-radius:9px;background:#364249;transform:rotate(-8deg)"></div>
    <div style="position:absolute;left:43px;top:141px;width:20px;height:100px;border-radius:10px;background:#263037;transform:rotate(6deg)"></div>
    <div style="position:absolute;left:67px;top:141px;width:20px;height:100px;border-radius:10px;background:#263037;transform:rotate(-6deg)"></div>
    <div style="position:absolute;left:39px;top:4px;width:52px;height:23px;border-radius:13px 13px 4px 4px;background:${helmetColor(state.helmet)};border:4px solid #1f2529"></div>
    </div>`;
}
function armorColor(v){return ({Light:'#4e6654',Plate:'#59626b',Heavy:'#353e44'})[v]||'#666'}
function helmetColor(v){return ({Recon:'#36443d',Tactical:'#44505c',Heavy:'#262d32'})[v]||'#444'}
export function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');state.screen=id;}
export function bindUI(onDeploy){
  $('open-loadout').onclick=()=>go('loadout-screen'); $('open-settings').onclick=()=>go('settings-screen');
  $('quick-deploy').onclick=()=>{go('staging-screen');};
  $('go-staging').onclick=()=>go('staging-screen'); $('deploy-btn').onclick=()=>onDeploy();
  document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>go(b.dataset.back));
  renderChoices('armor','armor-choices');renderChoices('helmet','helmet-choices');renderChoices('primary','primary-choices');renderChoices('secondary','secondary-choices');renderChoices('utility','utility-choices');updatePreview();
  $('bot-count').oninput=e=>{$('bot-count-value').textContent=e.target.value;$('staging-bots').textContent=e.target.value;state.bots=+e.target.value};
  document.querySelectorAll('.map-option').forEach(b=>b.onclick=()=>{document.querySelectorAll('.map-option').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.map=b.dataset.map;$('staging-map-name').textContent=b.querySelector('b').textContent;$('map-hud').textContent=b.querySelector('b').textContent});
  $('dash-mode').onchange=e=>state.settings.dashMode=e.target.value;
  $('crouch-mode').onchange=e=>state.settings.crouchMode=e.target.value;
  $('hands-toggle').onchange=e=>state.settings.hands=e.target.checked;
  $('sensitivity').oninput=e=>state.settings.sensitivity=+e.target.value;
  $('shake-size').oninput=e=>state.settings.shake=+e.target.value;
  $('pixel-ratio').onchange=e=>state.settings.pixelRatio=+e.target.value;
  $('shadows-toggle').onchange=e=>state.settings.shadows=e.target.checked;
  $('sky-toggle').onchange=e=>state.settings.sky=e.target.checked;
}
