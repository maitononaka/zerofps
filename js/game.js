import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const state = window.ZERO_DIVISION_STATE; const go = window.ZERO_DIVISION_GO || ((id)=>{document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));document.getElementById(id)?.classList.add('active');});

const V3 = new THREE.Vector3();
const V3B = new THREE.Vector3();
const UP = new THREE.Vector3(0,1,0);
const TMP_M = new THREE.Matrix4();

const WEAPONS = {
  primary: {
    'M4A1': {mag:30, rate:.105, damage:34, reload:1.35, color:0x171b1c},
    'AKM': {mag:30, rate:.13, damage:40, reload:1.55, color:0x241e18},
    'SMG45': {mag:32, rate:.085, damage:27, reload:1.15, color:0x1a2023}
  },
  secondary: {
    'P320': {mag:17, rate:.19, damage:30, reload:1.1, color:0x202527},
    'G18': {mag:20, rate:.105, damage:24, reload:1.25, color:0x202427}
  },
  melee: {'タクティカルナイフ':{}, 'バタフライナイフ':{}, '拳':{}}
};

export class ZeroDivisionGame{
  constructor(){
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.05,700);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.pixelRatio));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.15;
    this.renderer.shadowMap.enabled=state.settings.shadows;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.id='world-canvas';
    this.renderer.domElement.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:0;display:none;pointer-events:none';
    document.getElementById('app').prepend(this.renderer.domElement);

    this.controls=new SimplePointerLock(this.camera,document.body);
    this.yaw=0;this.pitch=0;
    this.playerPos=new THREE.Vector3(0,0,8);
    this.velocity=new THREE.Vector3();
    this.keys={};
    this.canJump=false;
    this.dash=false;this.crouch=false;this.slideTimer=0;this.slideVelocity=new THREE.Vector3();this.lean=0;this.ads=false;this.eyeY=1.72;this.visualBob=0;
    this.running=false;this.paused=false;this.debug=false;
    this.health=100;this.stamina=100;
    this.firing=false;this.fireCooldown=0;this.weaponKick=0;
    this.currentWeaponType='primary';
    this.magAmmo={primary:30,secondary:17,melee:0};
    this.reserveAmmo={primary:120,secondary:68,melee:0};
    this.reloading=false;this.reloadTimer=0;this.inspectTimer=0;this.inspecting=false;
    this.enemies=[];this.colliders=[];this.breakableGlass=[];this.bulletHoles=[];
    this.mapGroup=null;this.handGroup=null;this.weaponGroup=null;this.weaponSight=null;this.muzzleFlash=null;this.weaponModel=null;this.weaponModelReady=false;this.weaponLoadPromise=null;this.weaponSocketData=null;
    this.lastFrameTime=performance.now();this.currentFPS=60;
    this.ping=24;this.packetLoss=0;this.audioCtx=null;
    this.terrainMesh=null;
    this.previewScene=null;this.previewCamera=null;this.previewRenderer=null;this.previewGroup=null;

    this.initLoadingPreview();
    this.weaponLoadPromise=this.preloadM4A1();
    this.bind();
    this.animate();
  }

  bind(){
    addEventListener('resize',()=>{
      this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.pixelRatio));
    });
    addEventListener('keydown',e=>this.onKey(e,true));
    addEventListener('keyup',e=>this.onKey(e,false));
    addEventListener('mousedown',e=>this.onMouseDown(e));
    addEventListener('mouseup',e=>this.onMouseUp(e));
    addEventListener('contextmenu',e=>{if(this.running)e.preventDefault();});
    this.controls.addEventListener('lock',()=>{
      this.paused=false;
      document.getElementById('pause-card')?.classList.add('hidden');
      document.getElementById('hint').style.display='none';
    });
    this.controls.addEventListener('unlock',()=>{
      if(this.running && !this.paused){
        this.paused=true;this.firing=false;
        document.getElementById('pause-card')?.classList.remove('hidden');
      }
    });
    document.getElementById('exit-to-menu').onclick=()=>this.stop();
    document.getElementById('pause-card').addEventListener('click',e=>{
      if(e.target.closest('#exit-to-menu'))return;
      if(this.running&&this.paused)this.controls.lock();
    });
    addEventListener('mousedown',e=>{
      if(this.running&&!this.controls.isLocked&&this.paused&&e.target.closest('#pause-card')===null)this.controls.lock();
    });
  }

  onMouseDown(e){
    if(!this.running||this.paused)return;
    if(e.button===2){
      if(this.controls.isLocked){this.ads=true;this.updateHUD();}
      return;
    }
    if(e.button!==0||!this.controls.isLocked)return;
    this.firing=true;
    this.fire();
  }
  onMouseUp(e){
    if(e.button===0)this.firing=false;
    if(e.button===2){this.ads=false;this.updateHUD();}
  }

  onKey(e,down){
    this.keys[e.code]=down;
    if((e.code==='ControlLeft'||e.code==='ControlRight')&&state.settings.dashMode==='toggle'&&down&&!e.repeat)this.dash=!this.dash;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight')){
      if(down&&!e.repeat){
        if(this.dash&&this.isMoving()&&!this.isSliding()) this.startSlide();
        else if(state.settings.crouchMode==='toggle') this.crouch=!this.crouch;
        else if(state.settings.crouchMode==='hold'&&!this.isSliding()) this.crouch=true;
      }else if(!down&&state.settings.crouchMode==='hold'&&!this.isSliding()){
        this.crouch=false;
      }
    }
    if(e.code==='Space'&&down&&!e.repeat&&this.canJump){
      if(this.isSliding()){
        this.slideJump();
      }else if(!this.crouch){
        this.velocity.y=9.2;this.canJump=false;
      }
    }
    if(e.code==='Digit1'&&down&&!e.repeat){this.currentWeaponType='primary';this.finishWeaponSwitch();}
    if(e.code==='Digit2'&&down&&!e.repeat){this.currentWeaponType='secondary';this.finishWeaponSwitch();}
    if(e.code==='Digit3'&&down&&!e.repeat){this.currentWeaponType='melee';this.finishWeaponSwitch();}
    if(e.code==='Digit4'&&down&&!e.repeat)this.useMedkit();
    if(e.code==='KeyR'&&down&&!e.repeat)this.startReload();
    if(e.code==='KeyH'&&down&&!e.repeat)this.startInspect();
    if(e.code==='Digit0'&&down&&!e.repeat)this.toggleDebug();
    if(e.code==='KeyG'&&down&&!e.repeat&&this.running&&this.controls.isLocked)this.breakNearestGlass();
  }

  finishWeaponSwitch(){
    this.reloading=false;this.inspecting=false;this.firing=false;this.updateWeaponModel();this.updateHUD();
  }
  startSlide(){
    if(this.isSliding())return;
    const horizontal=new THREE.Vector3(this.velocity.x,0,this.velocity.z);
    if(horizontal.lengthSq()<1){
      const yaw=this.controls.yaw;
      horizontal.set(Math.sin(yaw),0,-Math.cos(yaw));
    }else horizontal.normalize();
    this.slideVelocity.copy(horizontal).multiplyScalar(Math.max(7.5,Math.min(12.5,Math.hypot(this.velocity.x,this.velocity.z)+2.2)));
    this.slideTimer=.82;
    this.crouch=false;
    this.dash=false;
    this.keys.ShiftLeft=false;this.keys.ShiftRight=false;
  }
  slideJump(){
    const carry=Math.min(12.5,Math.max(8.0,this.slideVelocity.length()*1.04));
    const dir=this.slideVelocity.clone().setY(0).normalize();
    this.velocity.x=dir.x*carry;this.velocity.z=dir.z*carry;this.velocity.y=8.6;
    this.slideTimer=0;this.crouch=false;this.canJump=false;
  }
  isSliding(){return this.slideTimer>0;}
  isMoving(){return !!(this.keys.KeyW||this.keys.KeyA||this.keys.KeyS||this.keys.KeyD);}

  toggleDebug(){this.debug=!this.debug;document.getElementById('debug-panel').classList.toggle('hidden',!this.debug);}

  mapLabel(map){return map==='city'?'市街地 / ブロック7':map==='mountain'?'山岳 / 森林リッジ':'室内 / 施設03'}
  missionData(map){
    return {
      city:{title:'市街地 / ブロック7',code:'CITY // BLOCK 7',brief:'都市区画を横断し、建物・路地・遮蔽物を活用してフィールドを確認する。',tips:['交差点を確認','遮蔽物を活用','建物間を移動']},
      mountain:{title:'山岳 / 森林リッジ',code:'MOUNTAIN // FOREST RIDGE',brief:'深い針葉樹林と急斜面が続く森林山岳地帯。標高差を利用して周囲を観測する。',tips:['斜面で速度低下','木々を遮蔽に利用','尾根から観測']},
      interior:{title:'室内 / 施設03',code:'INTERIOR // FACILITY 03',brief:'複数区画を持つ施設内部。廊下・階段・窓によって視界が頻繁に変化する。',tips:['角を小さく確認','階段の高低差に注意','ガラスを活用']}
    }[map];
  }

  initLoadingPreview(){
    const el=document.getElementById('loading-preview');if(!el)return;
    this.previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.previewRenderer.setSize(el.clientWidth||560,el.clientHeight||360,false);
    this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;
    el.appendChild(this.previewRenderer.domElement);
    this.previewScene=new THREE.Scene();
    this.previewCamera=new THREE.PerspectiveCamera(42,(el.clientWidth||560)/(el.clientHeight||360),.1,100);
    this.previewCamera.position.set(11,10,14);
    this.previewScene.add(new THREE.HemisphereLight(0xe8f7ff,0x26332d,2.5));
    const sun=new THREE.DirectionalLight(0xfff2c7,3.2);sun.position.set(8,15,6);this.previewScene.add(sun);
  }
  buildPreview(map){
    if(!this.previewScene)return;
    if(this.previewGroup){this.previewGroup.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.()});this.previewScene.remove(this.previewGroup);}
    const g=new THREE.Group();this.previewGroup=g;this.previewScene.add(g);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(32,.4,24),new THREE.MeshStandardMaterial({color:0x34413f,roughness:1}));floor.position.y=-.2;g.add(floor);
    const block=(x,z,sx,sy,sz,c=0x556064)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color:c,roughness:.82}));o.position.set(x,sy/2,z);g.add(o)};
    if(map==='city'){
      for(let i=0;i<10;i++){const x=(i%5)*7-14,z=Math.floor(i/5)*8-8;block(x,z,5,4+(i%3)*2,5,i%2?0x4c575d:0x394449)}
    }else if(map==='mountain'){
      for(let i=0;i<13;i++){const x=(i%5)*7-14,z=Math.floor(i/5)*8-9,h=2+(i%4);const o=new THREE.Mesh(new THREE.ConeGeometry(3+h*.3,h,7),new THREE.MeshStandardMaterial({color:0x66705f,roughness:1}));o.position.set(x,h/2-.1,z);g.add(o)}
      for(let i=0;i<8;i++){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,1.8,6),new THREE.MeshStandardMaterial({color:0x514437}));const x=(i*7%28)-14,z=(i*11%20)-10;trunk.position.set(x,.9,z);g.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.1,3.2,7),new THREE.MeshStandardMaterial({color:0x2f6538,roughness:1}));crown.position.set(x,2.5,z);g.add(crown)}
    }else{for(let i=0;i<5;i++){block(-12+i*6,0,5,4,.55,0x444d52);block(-12+i*6,8,5,4,.55,0x444d52)}}
  }
  updateLoadingInfo(map){
    const data=this.missionData(map),$=id=>document.getElementById(id);
    $('loading-title').textContent=data.title;$('loading-code').textContent=data.code;$('loading-brief').textContent=data.brief;
    $('loading-tip-1').textContent=data.tips[0];$('loading-tip-2').textContent=data.tips[1];$('loading-tip-3').textContent=data.tips[2];
    $('load-rec-armor').textContent=state.armor;$('load-rec-helmet').textContent=state.helmet;$('load-rec-tool').textContent=state.primary;$('load-rec-support').textContent=state.secondary;$('load-bots').textContent=String(state.bots).padStart(2,'0');
    this.buildPreview(map);
  }

  async start(map,bots){
    state.map=map;state.bots=bots;
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    document.getElementById('loading-screen').classList.add('active');
    this.updateLoadingInfo(map);
    this.renderer.domElement.style.display='none';this.running=false;
    const fill=document.getElementById('loading-fill'),pct=document.getElementById('loading-percent'),status=document.getElementById('loading-status');
    pct.textContent='0%';fill.style.width='0%';
    const steps=[['設定を確認しています…',10],['ライティングを準備しています…',24],['地形を生成しています…',48],['森林・建物を配置しています…',68],['人型ユニットを配置しています…',84],['フィールド同期を確認しています…',96],['完了',100]];
    for(const [msg,target] of steps){status.textContent=msg;await this.loadingTo(target,fill,pct)}
    await this.preloadM4A1();
    this.buildScene();
    await new Promise(r=>setTimeout(r,160));
    document.getElementById('loading-screen').classList.remove('active');document.getElementById('game-ui').classList.remove('hidden');
    this.renderer.domElement.style.display='block';this.running=true;this.paused=false;this.health=100;this.stamina=100;this.magAmmo.primary=WEAPONS.primary[state.primary]?.mag||30;this.magAmmo.secondary=WEAPONS.secondary[state.secondary]?.mag||17;
    this.reserveAmmo.primary=(this.magAmmo.primary||30)*4;this.reserveAmmo.secondary=(this.magAmmo.secondary||17)*4;
    this.ping=20+Math.round(Math.random()*15);this.packetLoss=0;this.currentWeaponType='primary';this.updateWeaponModel();this.updateHUD();
    document.getElementById('enemy-counter').textContent=String(bots);this.controls.lock();
  }
  loadingTo(target,fill,pct){return new Promise(resolve=>{const tick=()=>{const cur=Number(pct.textContent.replace('%',''))||0;const next=Math.min(target,cur+2);pct.textContent=`${next}%`;fill.style.width=`${next}%`;if(next>=target)resolve();else requestAnimationFrame(tick)};tick()})}

  stop(){
    this.running=false;this.paused=false;this.controls.unlock();this.renderer.domElement.style.display='none';
    document.getElementById('game-ui').classList.add('hidden');document.getElementById('loading-screen').classList.remove('active');document.getElementById('debug-panel').classList.add('hidden');
    go('deploy-screen');
    if(this.mapGroup){this.mapGroup.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()});this.scene.remove(this.mapGroup)}
    if(this.handGroup)this.camera.remove(this.handGroup);if(this.weaponGroup)this.camera.remove(this.weaponGroup);
    this.handGroup=this.weaponGroup=null;this.mapGroup=null;this.colliders=[];this.enemies=[];this.breakableGlass=[];this.bulletHoles=[];this.terrainMesh=null;
  }

  buildScene(){
    for(const child of [...this.scene.children])if(child!==this.camera)this.scene.remove(child);
    this.scene.add(this.camera);
    this.scene.background=new THREE.Color(state.map==='mountain'?0x87adbb:0x78a3b5);
    this.scene.fog=new THREE.Fog(state.map==='mountain'?0x87adbb:0x78a3b5,120,state.map==='mountain'?430:360);
    this.mapGroup=new THREE.Group();this.scene.add(this.mapGroup);this.colliders=[];this.enemies=[];this.breakableGlass=[];this.bulletHoles=[];

    const hemi=new THREE.HemisphereLight(0xf2fbff,0x4b5848,3.0);this.mapGroup.add(hemi);
    const sun=new THREE.DirectionalLight(0xfff1c7,4.8);sun.position.set(-75,110,35);sun.castShadow=state.settings.shadows;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-140;sun.shadow.camera.right=140;sun.shadow.camera.top=140;sun.shadow.camera.bottom=-140;sun.shadow.bias=-0.0005;this.mapGroup.add(sun);
    this.addSky();
    if(state.map==='mountain'){this.buildMountainTerrain();this.addGrassClusters(true);this.buildMountain();}
    else {this.addGround();this.addGrassClusters(false);state.map==='city'?this.buildCity():this.buildInterior();}
    this.addDistantSilhouette();
    this.spawnHumans(state.bots);
    this.addWeapon();this.addHands();this.updateWeaponModel();
    const spawns={city:[0,8],mountain:[0,4],interior:[0,8]};const s=spawns[state.map]||spawns.city;this.playerPos.set(s[0],this.groundHeightAt(s[0],s[1]),s[1]);this.velocity.set(0,0,0);this.slideVelocity.set(0,0,0);this.canJump=true;
    this.eyeY=this.playerPos.y+1.72;
    this.camera.rotation.order='YXZ';this.camera.rotation.set(0,0,0);this.ads=false;this.updateCameraTransform(0);
    this.updateWeaponModel();
  }

  addSky(){
    if(!state.settings.sky)return;
    const sky=new THREE.Mesh(new THREE.SphereGeometry(330,32,20),new THREE.MeshBasicMaterial({color:state.map==='mountain'?0x8eb8c8:0x7da8bb,side:THREE.BackSide,fog:false}));sky.frustumCulled=false;this.mapGroup.add(sky);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(6,24,24),new THREE.MeshBasicMaterial({color:0xfff0ae}));sun.position.set(-105,105,-140);sun.frustumCulled=false;this.mapGroup.add(sun);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(16,20,20),new THREE.MeshBasicMaterial({color:0xffe8a1,transparent:true,opacity:.12,depthWrite:false}));glow.position.copy(sun.position);glow.frustumCulled=false;this.mapGroup.add(glow);
  }

  groundHeightAt(x,z){return state.map==='mountain'?this.terrainHeight(x,z):0;}
  terrainHeight(x,z){
    const ridge=Math.sin(x*.055)*4.5+Math.cos(z*.052)*3.8+Math.sin((x+z)*.028)*5.2;
    const valley=-(Math.cos(x*.11)+Math.sin(z*.09))*1.1;
    const fall=Math.min(1,Math.hypot(x,z)/95);
    return Math.max(-1.5,(ridge+valley)*fall);
  }
  buildMountainTerrain(){
    const size=260,seg=64,geo=new THREE.PlaneGeometry(size,size,seg,seg);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,this.terrainHeight(x,z));}pos.needsUpdate=true;geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:0x6d8c50,roughness:1,metalness:0});this.terrainMesh=new THREE.Mesh(geo,mat);this.terrainMesh.receiveShadow=true;this.mapGroup.add(this.terrainMesh);
  }
  addGround(){
    const fallback=new THREE.Mesh(new THREE.PlaneGeometry(420,420),new THREE.MeshLambertMaterial({color:0x6c8f55}));fallback.rotation.x=-Math.PI/2;fallback.receiveShadow=true;this.mapGroup.add(fallback);
    new THREE.TextureLoader().load('./assets/grass.svg',texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(72,72);texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());texture.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshLambertMaterial({map:texture,color:0xb6cf8d});const ground=new THREE.Mesh(new THREE.PlaneGeometry(410,410),mat);ground.rotation.x=-Math.PI/2;ground.position.y=.01;ground.receiveShadow=true;this.mapGroup.add(ground);},undefined,()=>{});
  }
  addGrassClusters(mountain){
    const blade=new THREE.PlaneGeometry(.16,.9,1,2);blade.translate(0,.45,0);const mat=new THREE.MeshStandardMaterial({color:0x4f7d3d,side:THREE.DoubleSide,roughness:1,transparent:true,opacity:.88});
    for(let patch=0;patch<(mountain?5:3);patch++){
      const count=mountain?350:260,inst=new THREE.InstancedMesh(blade,mat,count),dummy=new THREE.Object3D();let n=0;
      for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,r=mountain?8+Math.random()*120:12+Math.random()*115;const x=Math.cos(a)*r+(Math.random()-.5)*6,z=Math.sin(a)*r+(Math.random()-.5)*6;if(Math.hypot(x,z)<8&&!mountain)continue;dummy.position.set(x,this.groundHeightAt(x,z)+.02,z);dummy.scale.setScalar(.4+Math.random()*1.15);dummy.rotation.set(0,Math.random()*Math.PI,0);dummy.updateMatrix();inst.setMatrixAt(n++,dummy.matrix)}inst.count=n;inst.instanceMatrix.needsUpdate=true;this.mapGroup.add(inst);
    }
  }

  box(x,y,z,sx,sy,sz,c=0x515a61,opts={}){const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color:c,roughness:.78,metalness:.04}));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;o.name=opts.name||'structure';this.mapGroup.add(o);if(opts.collider!==false)this.colliders.push({minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2,type:'box',object:o});return o}
  tree(x,z,s=1){const y=this.groundHeightAt(x,z),g=new THREE.Group();g.position.set(x,y,z);const bark=new THREE.MeshStandardMaterial({color:0x4e3a28,roughness:1});const green=new THREE.MeshStandardMaterial({color:0x1f5a32,roughness:1});const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18*s,.30*s,2.6*s,8),bark);trunk.position.y=1.3*s;trunk.castShadow=true;g.add(trunk);for(let i=0;i<4;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry((1.2-i*.16)*s,(2.4-i*.27)*s,9),green);crown.position.y=(2.2+i*.7)*s;crown.rotation.y=i*.8;crown.castShadow=true;g.add(crown)}this.mapGroup.add(g);this.colliders.push({minX:x-.42*s,maxX:x+.42*s,minZ:z-.42*s,maxZ:z+.42*s,type:'box'});return g}
  rock(x,z,s=1,c=0x667068){const y=this.groundHeightAt(x,z);const o=new THREE.Mesh(new THREE.DodecahedronGeometry(1.1*s,1),new THREE.MeshStandardMaterial({color:c,roughness:1}));o.position.set(x,y+.8*s,z);o.scale.set(1.4,.75,1);o.rotation.set(Math.random(),Math.random()*Math.PI,Math.random());o.castShadow=true;o.receiveShadow=true;this.mapGroup.add(o);this.colliders.push({minX:x-1.25*s,maxX:x+1.25*s,minZ:z-1*s,maxZ:z+1*s,type:'box'});return o}
  stairs(x,z,w=5,steps=8,rise=.4,depth=.55,dir=0,c=0x4b5558){const g=new THREE.Group();g.position.set(x,this.groundHeightAt(x,z),z);g.rotation.y=dir;for(let i=0;i<steps;i++){const h=(i+1)*rise,o=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth*(i+1)),new THREE.MeshStandardMaterial({color:c,roughness:.86}));o.position.set(0,h/2,(i*depth)/2);o.castShadow=true;o.receiveShadow=true;g.add(o)}this.mapGroup.add(g);this.colliders.push({minX:x-w/2-.1,maxX:x+w/2+.1,minZ:z-depth/2-.2,maxZ:z+steps*depth+.2,type:'box'});return g}
  door(x,y,z,w=2.2,h=2.8,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;const fm=new THREE.MeshStandardMaterial({color:0x283034,roughness:.7,metalness:.25}),pm=new THREE.MeshStandardMaterial({color:0x4c5659,roughness:.72});const top=new THREE.Mesh(new THREE.BoxGeometry(w+.35,.16,.22),fm);top.position.y=h;g.add(top);const l=new THREE.Mesh(new THREE.BoxGeometry(.16,h,.22),fm);l.position.set(-w/2,h/2,0);g.add(l);const r=l.clone();r.position.x=w/2;g.add(r);const p=new THREE.Mesh(new THREE.BoxGeometry(w-.12,h-.18,.12),pm);p.position.y=h/2;p.castShadow=true;g.add(p);this.mapGroup.add(g);this.colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-.13,maxZ:z+.13,type:'box'});return g}
  windowGlass(x,y,z,w=3,h=2.2,rot=0){const m=new THREE.MeshPhysicalMaterial({color:0x9bd6e3,transparent:true,opacity:.28,roughness:.04,metalness:.05,transmission:.14,side:THREE.DoubleSide});const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),m);g.position.set(x,y,z);g.rotation.y=rot;g.userData.breakable=true;this.mapGroup.add(g);this.breakableGlass.push(g);return g}

  buildCity(){
    for(let x=-60;x<=60;x+=20)this.box(x,.06,0,4,.12,132,0x293238,{collider:false});for(let z=-60;z<=60;z+=20)this.box(0,.065,z,132,.13,4,0x293238,{collider:false});
    const blocks=[[-45,-42,10,8,16],[0,-44,12,12,21],[42,-42,12,14,14],[-44,0,16,12,12],[42,1,14,18,18],[-42,42,13,10,17],[2,40,17,13,20],[44,43,12,11,13]];
    blocks.forEach((b,i)=>{const[x,z,w,d,h]=b;this.box(x,h/2,z,w,h,d,i%2?0x4d575c:0x414b50);this.box(x+(i%2?2:-2),h+.7,z-.8,2,.9,2,0x323b3e)});
    for(let i=0;i<18;i++){const x=((i*23)%100)-50,z=((i*41)%100)-50;if(Math.abs(x)<12&&Math.abs(z)<12)continue;this.box(x,.65,z,3.8,1.3,1.0,i%2?0x3c474b:0x58615f)}
    this.door(-45,0,-33,2.2,3.2);this.door(42,0,-34,2.5,3.2);this.windowGlass(-41,4,-50,3,2.2);this.windowGlass(-49,4,-50,3,2.2);this.windowGlass(39,4,-49,3,2.2);this.windowGlass(47,4,-49,3,2.2);
    [[-57,-12,.9],[-12,-48,1.05],[13,-55,.82],[54,-14,.95],[-57,19,.8],[20,58,1.05],[57,31,.95],[-4,56,.8]].forEach(v=>this.tree(...v));[[-28,-25,.9],[-13,25,.75],[27,-12,1.05],[28,28,.72]].forEach(v=>this.rock(...v));this.stairs(24,7,6,8,.36,.62,Math.PI/2);
  }

  buildMountain(){
    for(let i=0;i<46;i++){const x=(i*31%190)-95,z=(i*47%210)-105;if(Math.hypot(x,z)<14)continue;this.tree(x,z,.72+((i*7)%7)*.08)}
    for(let i=0;i<30;i++){const x=(i*23%190)-95,z=(i*37%210)-105;if(Math.hypot(x,z)<12)continue;this.rock(x,z,.6+((i*5)%7)*.12,0x626b63)}
    this.box(0,this.groundHeightAt(0,-14)+2,-14,10,4,7,0x424c4c);this.box(0,this.groundHeightAt(0,-14)+4.25,-14,10,.5,7,0x2f383a);this.windowGlass(-2.6,2.2+this.groundHeightAt(0,-14),-17.55,2.8,1.9);this.windowGlass(2.6,2.2+this.groundHeightAt(0,-14),-17.55,2.8,1.9);this.door(0,this.groundHeightAt(0,-14),-17.55,2.2,3);this.stairs(0,-22,5,8,.35,.6,0);
  }

  buildInterior(){
    const walls=0x454e52,accent=0x555f63;this.box(0,.18,0,54,.36,54,0x252c2f,{collider:false});this.box(0,3,-27,54,6,.7,walls);this.box(0,3,27,54,6,.7,walls);this.box(-27,3,0,.7,6,54,walls);this.box(27,3,0,.7,6,54,walls);
    [[-13,-13],[13,-13],[-13,13],[13,13]].forEach(([x,z])=>{this.box(x,3,z-7,20,6,.55,walls);this.box(x,3,z+7,20,6,.55,walls);this.box(x-10,3,z,.55,6,14,walls);this.box(x+10,3,z,.55,6,14,walls)});
    this.box(0,3,0,10,.45,14,accent,{collider:false});this.stairs(0,-3,4,9,.38,.58,Math.PI/2,accent);this.stairs(0,10,4,9,.38,.58,-Math.PI/2,accent);
    this.door(-13,0,-20,2.4,3.1);this.door(13,0,-20,2.4,3.1);this.door(-13,0,20,2.4,3.1,Math.PI);this.door(13,0,20,2.4,3.1,Math.PI);
    [-13,0,13].forEach(x=>this.windowGlass(x,3,-26.62,4.6,2.5));[-13,0,13].forEach(x=>this.windowGlass(x,4.2,26.62,4.2,1.9,Math.PI));
    for(let i=0;i<28;i++){const x=(i%7)*6-18,z=Math.floor(i/7)*6-18;this.box(x,.7,z,1.8,1.4,1.8,i%3===0?0x56504a:0x3b4548)}
    for(let x=-18;x<=18;x+=12)for(let z=-18;z<=18;z+=12){const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.5),new THREE.MeshBasicMaterial({color:0xe1f2eb}));lamp.position.set(x,5.7,z);this.mapGroup.add(lamp)}
  }
  addDistantSilhouette(){const mat=new THREE.MeshStandardMaterial({color:state.map==='mountain'?0x526958:0x5d746f,roughness:1});for(let i=0;i<18;i++){const h=8+((i*17)%11)*2,o=new THREE.Mesh(new THREE.BoxGeometry(8,h,6),mat);o.position.set((i-9)*18,h/2-.1,-105-(i%3)*12);o.castShadow=false;this.mapGroup.add(o)}}

  spawnHumans(n){
    for(let i=0;i<n;i++){
      const g=new THREE.Group();const baseX=(i*29%105)-52,baseZ=(i*47%105)-52;const y=this.groundHeightAt(baseX,baseZ);
      const suit=new THREE.MeshStandardMaterial({color:i%2?0x42514b:0x363e43,roughness:.9});const vest=new THREE.MeshStandardMaterial({color:0x1f272b,roughness:.85});const skin=new THREE.MeshStandardMaterial({color:0x9d806c,roughness:.9});
      const pelvis=new THREE.Mesh(new THREE.BoxGeometry(.55,.32,.32),vest);pelvis.position.y=.95;g.add(pelvis);
      const torso=new THREE.Mesh(new THREE.BoxGeometry(.82,1.08,.42),suit);torso.position.y=1.55;torso.castShadow=true;g.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),skin);head.position.y=2.35;head.userData.hitPart='head';g.add(head);
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(.27,12,8,0,Math.PI*2,0,Math.PI*.62),vest);helmet.position.y=2.45;g.add(helmet);
      const makeLimb=(x,y,z,sx,sy,sz,mat,rot=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.rotation.z=rot;g.add(m);return m};
      makeLimb(-.56,1.52,0,.22,.95,.22,suit,.08);makeLimb(.56,1.52,0,.22,.95,.22,suit,-.08);makeLimb(-.22,.42,0,.27,1.0,.27,suit,.03);makeLimb(.22,.42,0,.27,1.0,.27,suit,-.03);
      g.traverse(o=>{if(o.isMesh)o.userData.enemyId=i;if(o.isMesh&&!o.userData.hitPart)o.userData.hitPart='body'});
      g.position.set(baseX,y,baseZ);this.mapGroup.add(g);this.enemies.push({group:g,origin:new THREE.Vector3(baseX,y,baseZ),phase:i*.8,hp:100,alive:true,respawn:0});
    }
  }

  breakNearestGlass(){
    const ray=new THREE.Raycaster(this.camera.position,this.getAimDirection(),.1,5);const hits=ray.intersectObjects(this.breakableGlass,false);if(!hits.length)return;const best=hits[0].object;this.breakableGlass=this.breakableGlass.filter(o=>o!==best);best.visible=false;
    const ring=new THREE.Mesh(new THREE.RingGeometry(.15,.24,10),new THREE.MeshBasicMaterial({color:0xd9ff5f,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.position.copy(hits[0].point);ring.lookAt(this.camera.position);this.mapGroup.add(ring);setTimeout(()=>{this.mapGroup.remove(ring);ring.geometry.dispose();ring.material.dispose()},400);
  }

  getAimDirection(){const d=new THREE.Vector3(0,0,-1);d.applyQuaternion(this.camera.quaternion).normalize();return d}

  async preloadM4A1(){
    try{
      const loader=new GLTFLoader();
      const [gltf,sockets]=await Promise.all([
        new Promise((resolve,reject)=>loader.load('./assets/m4a1.glb',resolve,undefined,reject)),
        fetch('./assets/m4a1_sockets.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
      ]);
      const root=gltf.scene;
      root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;if(o.material){o.material.transparent=false;}}});
      // Normalize the imported model into the Zero Division view-model convention.
      // The source model is long on local X; rotate it so the barrel points toward -Z.
      const box=new THREE.Box3().setFromObject(root);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const maxLen=Math.max(size.x,size.y,size.z);
      const scale=1.55/Math.max(maxLen,0.001);
      root.position.sub(center);
      root.rotation.y=Math.PI/2;
      root.scale.setScalar(scale);
      root.position.set(0,0,0);
      this.weaponModel=root;
      this.weaponSocketData=sockets;
      this.weaponModelReady=true;
      return root;
    }catch(err){
      console.warn('M4A1 GLB load failed; using fallback view-model.',err);
      this.weaponModel=null;this.weaponModelReady=false;return null;
    }
  }

  addHands(){
    this.handGroup=new THREE.Group();
    this.handGroup.name='optimized-hands';
    const sleeve=new THREE.MeshStandardMaterial({color:0x252d31,roughness:.95,metalness:0});
    const glove=new THREE.MeshStandardMaterial({color:0x11171a,roughness:.88,metalness:.02});
    const makeArm=(a,b,r=.07)=>{
      const dir=new THREE.Vector3().subVectors(b,a),len=dir.length();
      const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.02,len-r*2),5,8),sleeve);
      m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
      return m;
    };
    const makeHand=(p,scale=1)=>{
      const g=new THREE.Group();g.position.copy(p);
      const palm=new THREE.Mesh(new THREE.SphereGeometry(.095,10,8),glove);palm.scale.set(1.0,.72,1.2);g.add(palm);
      const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.028,.11,5,7),glove);thumb.position.set(-.07,-.01,-.015);thumb.rotation.z=-.65;g.add(thumb);
      g.scale.setScalar(scale);return g;
    };
    // Hands are authored in the weapon's local space so they stay attached through ADS/lean/recoil.
    this.handPoints={
      right:{hand:new THREE.Vector3(.14,-.30,.22),elbow:new THREE.Vector3(.18,-.20,.52),shoulder:new THREE.Vector3(.18,-.10,.72)},
      left:{hand:new THREE.Vector3(-.02,-.19,-.34),elbow:new THREE.Vector3(-.10,-.10,-.02),shoulder:new THREE.Vector3(-.17,-.08,.45)}
    };
    for(const side of ['left','right']){
      const p=this.handPoints[side];
      this.handGroup.add(makeArm(p.shoulder,p.elbow,side==='right'?.075:.072));
      this.handGroup.add(makeArm(p.elbow,p.hand,side==='right'?.066:.062));
      this.handGroup.add(makeHand(p.hand,1.05));
    }
    this.weaponGroup?.add(this.handGroup);
    this.handGroup.visible=state.settings.hands;
  }

  addWeapon(){
    this.weaponGroup=new THREE.Group();
    this.weaponGroup.name='viewmodel-weapon';
    this.camera.add(this.weaponGroup);
    this.updateWeaponModel();
  }
  updateWeaponModel(){
    if(!this.weaponGroup)return;
    for(const c of [...this.weaponGroup.children]){
      if(c!==this.weaponModel && c!==this.handGroup){
        this.weaponGroup.remove(c);
        this.disposeObject3D(c);
      }
    }
    if(this.weaponModel)this.clearWeaponAttachments(this.weaponModel);
    this.weaponSight=null;this.muzzleFlash=null;
    if(this.currentWeaponType==='melee'){
      const m=new THREE.MeshStandardMaterial({color:0x24292c,roughness:.5,metalness:.5});
      const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.48,.06),m);blade.position.set(.12,-.30,-.72);blade.rotation.z=-.18;this.weaponGroup.add(blade);
      return;
    }
    if(this.weaponModelReady&&this.weaponModel&&this.currentWeaponType==='primary'&&state.primary==='M4A1'){
      if(this.weaponModel.parent!==this.weaponGroup)this.weaponGroup.add(this.weaponModel);
      this.weaponModel.visible=true;
      this.weaponModel.rotation.set(0,0,0);
      this.weaponModel.position.set(0,-.11,-1.05);
      if(!this.weaponModel.userData.baseScale)this.weaponModel.userData.baseScale=this.weaponModel.scale.x;
      this.weaponModel.scale.setScalar(this.weaponModel.userData.baseScale);

      // Attachment sockets are normalized to the imported model's local space.
      const optics=this.buildSight(state.sight);optics.position.copy(this.getWeaponSocket('optic'));this.weaponModel.add(optics);this.weaponSight=optics;
      const muzzle=this.buildMuzzle(state.muzzle);muzzle.position.copy(this.getWeaponSocket('muzzle'));this.weaponModel.add(muzzle);
      this.muzzleFlash=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),new THREE.MeshBasicMaterial({color:0xffe7a0,transparent:true,opacity:0,depthWrite:false}));
      const mfPos=this.getWeaponSocket('muzzle').clone().add(new THREE.Vector3(0,0,-.10));this.muzzleFlash.position.copy(mfPos);this.weaponModel.add(this.muzzleFlash);
      return;
    }
    // Lightweight procedural fallback for the other weapons.
    const name=this.currentWeaponType==='primary'?state.primary:state.secondary;
    const data=(this.currentWeaponType==='primary'?WEAPONS.primary:WEAPONS.secondary)[name]||WEAPONS.primary.M4A1;
    const dark=new THREE.MeshStandardMaterial({color:data.color,roughness:.55,metalness:.28});const matte=new THREE.MeshStandardMaterial({color:0x343b3e,roughness:.85});
    const receiver=new THREE.Mesh(new THREE.BoxGeometry(.37,.26,1.03),dark);receiver.position.set(.12,-.37,-.86);this.weaponGroup.add(receiver);
    const handguard=new THREE.Mesh(new THREE.BoxGeometry(.31,.20,.78),matte);handguard.position.set(.12,-.32,-1.65);this.weaponGroup.add(handguard);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.042,.055,.72,14),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(.12,-.33,-2.08);this.weaponGroup.add(barrel);
    const muzzle=this.buildMuzzle(state.muzzle);muzzle.position.set(.12,-.33,-2.44);this.weaponGroup.add(muzzle);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.17,.47,.19),dark);grip.rotation.x=-.18;grip.position.set(.20,-.59,-.61);this.weaponGroup.add(grip);
    const stock=this.buildStock(state.stock);stock.position.set(.12,-.38,-.12);this.weaponGroup.add(stock);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.18,.035,.62),matte);rail.position.set(.12,-.17,-1.06);this.weaponGroup.add(rail);
    const sight=this.buildSight(state.sight);sight.position.set(.12,-.095,-1.13);this.weaponGroup.add(sight);this.weaponSight=sight;
    this.muzzleFlash=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:0,depthWrite:false}));this.muzzleFlash.position.set(.12,-.33,-2.58);this.weaponGroup.add(this.muzzleFlash);
    this.weaponGroup.position.set(.02,.015,0);
  }
  disposeObject3D(root){
    root.traverse?.(o=>{
      if(o.geometry) o.geometry.dispose?.();
      if(o.material){
        if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  clearWeaponAttachments(root){
    for(const child of [...root.children]){
      if(child.userData?.zdAttachment){
        root.remove(child);
        this.disposeObject3D(child);
      }
    }
  }
  buildSight(type='標準サイト'){
    const g=new THREE.Group();
    g.userData.zdAttachment=true;
    const dark=new THREE.MeshStandardMaterial({color:0x15191b,roughness:.42,metalness:.6});
    const glass=new THREE.MeshBasicMaterial({color:0x8cc7ff,transparent:true,opacity:.5,roughness:0,depthWrite:false});
    if(type==='ドットサイト'){
      const base=new THREE.Mesh(new THREE.BoxGeometry(.13,.035,.19),dark);
      base.position.y=0; g.add(base);
      const hood=new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.12),dark);
      hood.position.y=.065; g.add(hood);
      const lens=new THREE.Mesh(new THREE.PlaneGeometry(.065,.052),glass);
      lens.position.set(0,.065,-.062); g.add(lens);
      const dot=new THREE.Mesh(new THREE.SphereGeometry(.008,8,6),new THREE.MeshBasicMaterial({color:0xff3344}));
      dot.position.set(0,.065,-.068); g.add(dot);
    } else if(type==='ホロ'){
      const base=new THREE.Mesh(new THREE.BoxGeometry(.15,.04,.21),dark);g.add(base);
      const frame=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.12),dark);frame.position.y=.07;g.add(frame);
      const lens=new THREE.Mesh(new THREE.PlaneGeometry(.095,.065),glass);lens.position.set(0,.07,-.062);g.add(lens);
    } else {
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.115,.03,.18),dark);g.add(rail);
      const front=new THREE.Mesh(new THREE.BoxGeometry(.025,.11,.025),dark);front.position.set(0,.065,-.055);g.add(front);
      const rear=new THREE.Mesh(new THREE.BoxGeometry(.025,.09,.025),dark);rear.position.set(0,.055,.055);g.add(rear);
    }
    return g;
  }
  buildMuzzle(type='標準'){
    const g=new THREE.Group();
    g.userData.zdAttachment=true;
    const dark=new THREE.MeshStandardMaterial({color:0x161a1d,roughness:.5,metalness:.65});
    let body;
    if(type==='コンペンセータ'){
      body=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.16,12),dark);
      body.rotation.x=Math.PI/2; g.add(body);
      for(let i=-1;i<=1;i++){
        const port=new THREE.Mesh(new THREE.BoxGeometry(.075,.016,.025),new THREE.MeshStandardMaterial({color:0x090b0c,roughness:1}));
        port.position.set(0,.035,i*.045); g.add(port);
      }
    } else if(type==='静音モジュール'){
      body=new THREE.Mesh(new THREE.CylinderGeometry(.075,.07,.28,14),dark);
      body.rotation.x=Math.PI/2; g.add(body);
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.025,14),dark);ring.rotation.x=Math.PI/2;ring.position.z=-.10;g.add(ring);
    } else {
      body=new THREE.Mesh(new THREE.CylinderGeometry(.05,.055,.11,12),dark);
      body.rotation.x=Math.PI/2; g.add(body);
    }
    return g;
  }
  buildStock(type='標準'){
    const g=new THREE.Group();
    g.userData.zdAttachment=true;
    const dark=new THREE.MeshStandardMaterial({color:0x1a2022,roughness:.62,metalness:.32});
    if(type==='軽量'){
      const tube=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.42),dark);tube.position.z=.16;g.add(tube);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(.16,.19,.08),dark);pad.position.set(0,-.02,.38);g.add(pad);
    } else if(type==='安定'){
      const body=new THREE.Mesh(new THREE.BoxGeometry(.17,.24,.38),dark);body.position.z=.16;g.add(body);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(.19,.24,.08),dark);pad.position.set(0,-.01,.37);g.add(pad);
    } else {
      const tube=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.34),dark);tube.position.z=.14;g.add(tube);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(.17,.20,.075),dark);pad.position.set(0,-.01,.34);g.add(pad);
    }
    return g;
  }
  getWeaponSocket(name){
    const s=this.weaponSocketData?.sockets?.[name];
    if(!s)return new THREE.Vector3();
    return new THREE.Vector3(...s.position);
  }

  fire(){
    if(!this.running||this.paused||this.reloading||this.inspecting)return;
    if(this.currentWeaponType==='melee'){if(this.fireCooldown>0)return;this.fireCooldown=.45;this.weaponKick=.12;this.playShotSound('melee');return;}
    const mag=this.magAmmo[this.currentWeaponType]||0;if(mag<=0){this.startReload();return;}if(this.fireCooldown>0)return;
    const name=this.currentWeaponType==='primary'?state.primary:state.secondary,data=(this.currentWeaponType==='primary'?WEAPONS.primary:WEAPONS.secondary)[name];
    this.fireCooldown=data.rate;this.magAmmo[this.currentWeaponType]--;this.weaponKick=.065;this.playShotSound('shot');
    if(this.muzzleFlash){this.muzzleFlash.material.opacity=.96;this.muzzleFlash.scale.setScalar(1.6);setTimeout(()=>{if(this.muzzleFlash){this.muzzleFlash.material.opacity=0;this.muzzleFlash.scale.setScalar(1)}},45)}
    const origin=this.camera.position.clone();const dir=this.getAimDirection();const tracerEnd=origin.clone().addScaledVector(dir,75);const ray=new THREE.Raycaster(origin,dir,.1,75);
    const targets=[];this.mapGroup.traverse(o=>{if(o.isMesh&&o.userData.enemyId!==undefined&&o.parent?.visible!==false)targets.push(o)});const hits=ray.intersectObjects(targets,false);let hitPoint=tracerEnd;let hitNormal=null;
    if(hits.length){hitPoint=hits[0].point;hitNormal=hits[0].face?.normal||null;const enemy=this.enemies[hits[0].object.userData.enemyId];if(enemy&&enemy.alive){const dmg=hits[0].object.userData.hitPart==='head'?Math.max(70,data.damage+25):data.damage;enemy.hp=Math.max(0,enemy.hp-dmg);if(enemy.hp<=0){enemy.alive=false;enemy.respawn=3.5;enemy.group.visible=false;}}}
    if(hits.length===0){const worldHits=ray.intersectObjects(this.colliders.map(c=>c.object).filter(Boolean),false);if(worldHits.length){hitPoint=worldHits[0].point;hitNormal=worldHits[0].face?.normal||null;this.createBulletHole(hitPoint,hitNormal)}}
    this.createTracer(origin,hitPoint);
    this.updateHUD();
  }
  createTracer(a,b){const g=new THREE.BufferGeometry().setFromPoints([a,b]);const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffeeb0,transparent:true,opacity:.8,depthWrite:false}));this.scene.add(line);setTimeout(()=>{this.scene.remove(line);g.dispose();line.material.dispose()},65)}
  createBulletHole(point,normal){const mat=new THREE.MeshBasicMaterial({color:0x161a1a,transparent:true,opacity:.86,depthWrite:false,side:THREE.DoubleSide});const hole=new THREE.Mesh(new THREE.CircleGeometry(.055,10),mat);hole.position.copy(point);if(normal)hole.lookAt(point.clone().add(normal));this.scene.add(hole);const obj={mesh:hole,ttl:15};this.bulletHoles.push(obj);}

  startReload(){
    if(this.currentWeaponType==='melee'||this.reloading||this.magAmmo[this.currentWeaponType]>=this.getCurrentMagSize()||this.reserveAmmo[this.currentWeaponType]<=0)return;
    this.reloading=true;this.firing=false;this.reloadTimer=(this.currentWeaponType==='primary'?WEAPONS.primary[state.primary]:WEAPONS.secondary[state.secondary]).reload;
  }
  startInspect(){if(!this.running||this.reloading||this.inspecting||this.currentWeaponType==='melee')return;this.inspecting=true;this.inspectTimer=1.8;this.firing=false;document.getElementById('game-ui').classList.add('hud-hidden');}
  useMedkit(){if(this.health>=100)return;this.health=Math.min(100,this.health+35);this.updateHUD();}
  getCurrentMagSize(){if(this.currentWeaponType==='melee')return 0;const data=(this.currentWeaponType==='primary'?WEAPONS.primary:WEAPONS.secondary)[this.currentWeaponType==='primary'?state.primary:state.secondary];return data?.mag||30}
  playShotSound(kind){try{this.audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(this.audioCtx.state==='suspended')this.audioCtx.resume();const t=this.audioCtx.currentTime,o=this.audioCtx.createOscillator(),g=this.audioCtx.createGain();o.type=kind==='melee'?'triangle':'square';o.frequency.setValueAtTime(kind==='melee'?90:150,t);o.frequency.exponentialRampToValueAtTime(kind==='melee'?55:70,t+.09);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(kind==='melee'?.05:.16,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g).connect(this.audioCtx.destination);o.start(t);o.stop(t+.13)}catch{}}

  update(dt){
    if(!this.running||this.paused)return;
    if(state.settings.dashMode==='hold')this.dash=!!(this.keys.ControlLeft||this.keys.ControlRight);
    if(state.settings.crouchMode==='hold'&&!this.isSliding())this.crouch=!!(this.keys.ShiftLeft||this.keys.ShiftRight);

    const movingInput=this.isMoving();
    if(!this.isSliding()&&!movingInput)this.dash=false;
    if(this.dash&&!movingInput)this.dash=false;

    if(this.isSliding()){
      this.slideTimer=Math.max(0,this.slideTimer-dt);
      const speed=this.slideVelocity.length();
      const friction=9.2;
      const newSpeed=Math.max(0,speed-friction*dt);
      if(speed>0.001)this.slideVelocity.multiplyScalar(newSpeed/speed);
      if(newSpeed<1.25||this.slideTimer<=0){
        this.slideTimer=0;this.slideVelocity.set(0,0,0);this.crouch=false;
      }
      this.velocity.x=this.slideVelocity.x;this.velocity.z=this.slideVelocity.z;
    }else{
      if(this.dash&&!this.crouch)this.stamina=Math.max(0,this.stamina-dt*23);
      else this.stamina=Math.min(100,this.stamina+dt*14);
      if(this.stamina<6)this.dash=false;
      const speed=this.crouch?2.35:(this.dash?8.4:4.6);
      let f=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0),r=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0);
      const len=Math.hypot(f,r);if(len>0){f/=len;r/=len;}
      const yaw=this.controls.yaw;
      const forward=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw));
      const side=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
      const wish=forward.multiplyScalar(f).add(side.multiplyScalar(r));
      if(len>0)wish.multiplyScalar(speed);
      const accel=len>0?(this.crouch?15:18):24;
      this.velocity.x=THREE.MathUtils.damp(this.velocity.x,len>0?wish.x:0,accel,dt);
      this.velocity.z=THREE.MathUtils.damp(this.velocity.z,len>0?wish.z:0,accel,dt);
    }

    const nx=this.playerPos.x+this.velocity.x*dt,nz=this.playerPos.z+this.velocity.z*dt;
    let blocked=false;
    for(const c of this.colliders){
      if(nx>c.minX-.42&&nx<c.maxX+.42&&nz>c.minZ-.42&&nz<c.maxZ+.42){blocked=true;break;}
    }
    if(!blocked){this.playerPos.x=nx;this.playerPos.z=nz;}else if(this.isSliding()){this.slideVelocity.multiplyScalar(.5);this.velocity.x=this.slideVelocity.x;this.velocity.z=this.slideVelocity.z;}else{this.velocity.x*=.35;this.velocity.z*=.35;}

    const ground=this.groundHeightAt(this.playerPos.x,this.playerPos.z);
    const stance=this.isSliding()?1.00:(this.crouch?1.08:1.72);
    const targetGround=ground+stance;
    this.velocity.y-=20.5*dt;
    let nextY=this.eyeY+this.velocity.y*dt;
    if(nextY<=targetGround){nextY=targetGround;this.velocity.y=0;this.canJump=true;}else this.canJump=false;
    this.eyeY=nextY;
    this.updateCameraTransform(dt);

    if(this.firing&&(this.currentWeaponType==='primary'||this.currentWeaponType==='secondary'))this.fire();
    if(this.fireCooldown>0)this.fireCooldown=Math.max(0,this.fireCooldown-dt);
    if(this.reloading){this.reloadTimer-=dt;if(this.reloadTimer<=0){const need=this.getCurrentMagSize()-this.magAmmo[this.currentWeaponType],take=Math.min(need,this.reserveAmmo[this.currentWeaponType]);this.magAmmo[this.currentWeaponType]+=take;this.reserveAmmo[this.currentWeaponType]-=take;this.reloading=false;}}
    if(this.inspecting){this.inspectTimer-=dt;if(this.inspectTimer<=0){this.inspecting=false;document.getElementById('game-ui').classList.remove('hud-hidden');}}
    this.updateWeaponAnimation(dt,movingInput);
    this.updateEnemies(dt);
    this.updateEffects(dt);
    this.ping=Math.round(18+Math.sin(performance.now()*.0007)*5+Math.random()*5);this.packetLoss=Math.random()<.028?Number((Math.random()*.7).toFixed(1)):0;
    this.updateHUD();this.updateDebug();
  }
  updateCameraTransform(dt){
    const t=performance.now()*.001;
    const moving=(Math.hypot(this.velocity.x,this.velocity.z)>0.15);
    const walkFreq=this.dash?14:(this.crouch?9:11);
    const bobAmp=this.isSliding()?.008:(this.crouch?.012:.022);
    this.visualBob=moving?Math.sin(t*walkFreq)*bobAmp:THREE.MathUtils.damp(this.visualBob,0,12,dt);
    const shakeAmp=this.dash?state.settings.shake*.018:0;
    const shake=Math.sin(t*26)*shakeAmp;
    const leanTarget=this.keys.KeyQ?-1:(this.keys.KeyE?1:0);
    this.lean=THREE.MathUtils.damp(this.lean,leanTarget,14,dt);
    const yaw=this.controls.yaw;
    const right=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
    const leanAmount=this.lean*.48;
    this.camera.position.x=this.playerPos.x+right.x*leanAmount;
    this.camera.position.z=this.playerPos.z+right.z*leanAmount;
    this.camera.position.y=this.eyeY+this.visualBob+shake;
    const rollTarget=-this.lean*.15;
    this.camera.rotation.z=THREE.MathUtils.damp(this.camera.rotation.z,rollTarget,18,dt);
    const targetFov=this.ads?48:78;
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,targetFov,12,dt);
    this.camera.updateProjectionMatrix();
  }
  updateWeaponAnimation(dt,moving){
    if(!this.weaponGroup)return;
    const t=performance.now()*.001;
    const bob=moving?Math.sin(t*(this.dash?14:10))*(this.dash?.035:.018):0;
    const adsLerp=this.ads?1:0;
    let x=THREE.MathUtils.lerp(.04,-.055,adsLerp)+this.lean*.30;
    let y=THREE.MathUtils.lerp(.01,.035,adsLerp)+bob*.55;
    let z=THREE.MathUtils.lerp(0,-.12,adsLerp);
    let rx=this.weaponKick;
    if(this.isSliding())y-=.12;
    if(this.reloading){const p=1-Math.max(0,this.reloadTimer)/((this.currentWeaponType==='primary'?WEAPONS.primary[state.primary]:WEAPONS.secondary[state.secondary]).reload);const wave=Math.sin(Math.min(1,p)*Math.PI);x-=wave*.10;y-=wave*.14;rx=.28+wave*.10;}
    if(this.inspecting){const p=1-Math.max(0,this.inspectTimer)/1.8;const wave=Math.sin(Math.min(1,p)*Math.PI);x+=.20*wave;y+=.10*wave;rx=.18*wave;this.weaponGroup.rotation.y=.32*wave;}else this.weaponGroup.rotation.y=0;
    this.weaponGroup.position.set(x,y,z);
    this.weaponGroup.rotation.x=rx;
    this.weaponGroup.rotation.z=-this.lean*.30;
    this.weaponKick=THREE.MathUtils.damp(this.weaponKick,0,18,dt);
    if(this.handGroup){
      this.handGroup.visible=state.settings.hands;
      this.handGroup.rotation.z=0;
      this.handGroup.rotation.x=0;
      this.handGroup.position.set(0,0,0);
    }
  }
  updateEnemies(dt){
    const now=performance.now()*.00055;this.enemies.forEach((e,i)=>{if(!e.alive){e.respawn-=dt;if(e.respawn<=0){e.alive=true;e.hp=100;e.group.visible=true;e.group.position.copy(e.origin)}return}const x=e.origin.x+Math.sin(now+e.phase)*2.2,z=e.origin.z+Math.cos(now*.92+e.phase)*2.2;e.group.position.x=x;e.group.position.z=z;e.group.position.y=this.groundHeightAt(x,z);e.group.rotation.y=Math.sin(now+e.phase)*.3});
  }
  updateEffects(dt){for(let i=this.bulletHoles.length-1;i>=0;i--){const h=this.bulletHoles[i];h.ttl-=dt;if(h.ttl<=0){this.scene.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();this.bulletHoles.splice(i,1)}}}

  updateHUD(){
    const stance=this.isSliding()?'スライド':(this.crouch?'しゃがみ':'立ち');document.getElementById('stance').textContent=stance;document.getElementById('drive').textContent=this.dash?'ダッシュ':this.isMoving()?'歩行':'停止';document.getElementById('hud-state').textContent=this.reloading?'リロード中':this.inspecting?'点検中':this.ads?'ADS':this.isSliding()?'スライド':this.dash?'高速移動':'準備完了';document.getElementById('enemy-counter').textContent=String(this.enemies.filter(e=>e.alive).length);
    const weaponName=this.currentWeaponType==='primary'?state.primary:this.currentWeaponType==='secondary'?state.secondary:state.melee;document.getElementById('weapon-hud').textContent=weaponName;document.getElementById('ammo-value').textContent=this.currentWeaponType==='melee'?'—':`${this.magAmmo[this.currentWeaponType]} / ${this.reserveAmmo[this.currentWeaponType]}`;document.getElementById('fire-mode').textContent=this.currentWeaponType==='melee'?'近接':this.currentWeaponType==='primary'?'連射':'半自動';
    const hp=document.getElementById('hp-fill');if(hp)hp.style.width=`${this.health}%`;const hv=document.getElementById('hp-value');if(hv)hv.textContent=Math.round(this.health);const sv=document.getElementById('stamina-fill');if(sv)sv.style.width=`${this.stamina}%`;const st=document.getElementById('stamina-value');if(st)st.textContent=Math.round(this.stamina);document.getElementById('ping').textContent=`${this.ping} ms`;document.getElementById('packet-loss').textContent=`${this.packetLoss.toFixed(1)} %`;
  }
  getPressedKeys(){
    const map={KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',Space:'SPACE',ShiftLeft:'SHIFT',ShiftRight:'SHIFT',ControlLeft:'CTRL',ControlRight:'CTRL',KeyQ:'Q',KeyE:'E',KeyR:'R',KeyH:'H',Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Digit0:'0'};
    return [...new Set(Object.entries(this.keys).filter(([,down])=>down).map(([code])=>map[code]||code.replace(/^Key/,'')))].join(' + ');
  }
  updateDebug(){const p=this.playerPos,s=this.velocity.length();const txt=[`ZERO DIVISION // DEBUG`,`FPS: ${Math.round(this.currentFPS||0)}`,`POS: ${p.x.toFixed(2)} / ${this.camera.position.y.toFixed(2)} / ${p.z.toFixed(2)}`,`VEL: ${s.toFixed(2)} m/s`,`MAP: ${state.map}`,`ENEMIES: ${this.enemies.filter(e=>e.alive).length}/${this.enemies.length}`,`WEAPON: ${this.currentWeaponType}`,`AMMO: ${this.currentWeaponType==='melee'?'—':`${this.magAmmo[this.currentWeaponType]} / ${this.reserveAmmo[this.currentWeaponType]}`}`,`PING: ${this.ping} ms`,`PACKET LOSS: ${this.packetLoss.toFixed(1)} %`,`DRAW CALLS: ${this.renderer.info.render.calls}`,`TRIANGLES: ${this.renderer.info.render.triangles}`,`PIXEL RATIO: ${this.renderer.getPixelRatio().toFixed(2)}`,`DASH: ${this.dash}  CROUCH: ${this.crouch}  SLIDE: ${this.isSliding()}  ADS: ${this.ads}  LEAN: ${this.lean.toFixed(2)}`,`PRESSED: ${this.getPressedKeys()||'—'}`];document.getElementById('debug-lines').textContent=txt.join('\n')}

  render(){
    this.renderer.render(this.scene,this.camera);
    if(this.previewRenderer&&this.previewScene&&document.getElementById('loading-screen')?.classList.contains('active')){const t=performance.now()*.00022;this.previewCamera.position.x=Math.cos(t)*17;this.previewCamera.position.z=Math.sin(t)*17;this.previewCamera.position.y=10.5;this.previewCamera.lookAt(0,1.5,0);this.previewRenderer.render(this.previewScene,this.previewCamera)}
  }
  animate(){requestAnimationFrame(()=>this.animate());const now=performance.now(),dt=Math.min(.05,Math.max(.001,(now-this.lastFrameTime)/1000));this.lastFrameTime=now;this.update(dt);this.render();this.currentFPS=Math.round(1/dt);const el=document.getElementById('fps');if(el)el.textContent=`${this.currentFPS} FPS`}
}

class SimplePointerLock extends EventTarget{
  constructor(camera,domElement){super();this.camera=camera;this.domElement=domElement;this.isLocked=false;this.pointerSpeed=1;this.yaw=0;this.pitch=0;this._onMove=e=>this._move(e);this._onChange=()=>{const locked=document.pointerLockElement===this.domElement;if(locked!==this.isLocked){this.isLocked=locked;this.dispatchEvent(new Event(locked?'lock':'unlock'));}};document.addEventListener('pointerlockchange',this._onChange)}
  lock(){this.yaw=this.camera.rotation.y;this.pitch=this.camera.rotation.x;this.camera.rotation.order='YXZ';this.domElement.requestPointerLock?.();if(!this._listening){document.addEventListener('mousemove',this._onMove,false);this._listening=true}}
  unlock(){document.exitPointerLock?.();if(this._listening){document.removeEventListener('mousemove',this._onMove,false);this._listening=false}this.isLocked=false}
  _move(e){if(!this.isLocked)return;const k=.0022*this.pointerSpeed;this.yaw-=e.movementX*k;this.pitch-=e.movementY*k;const lim=Math.PI/2-.08;this.pitch=Math.max(-lim,Math.min(lim,this.pitch));this.camera.rotation.order='YXZ';this.camera.rotation.y=this.yaw;this.camera.rotation.x=this.pitch}
}
