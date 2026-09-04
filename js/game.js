import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { state, go } from '../ui.js';

export class ZeroDivisionGame{
  constructor(){
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.05,500);
    this.camera.position.set(0,1.72,6);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.domElement.style.position='fixed';
    this.renderer.domElement.style.left='0';
    this.renderer.domElement.style.top='0';
    this.renderer.domElement.style.width='100vw';
    this.renderer.domElement.style.height='100vh';
    this.renderer.domElement.style.zIndex='0';
    this.renderer.domElement.style.pointerEvents='none';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.pixelRatio));
    this.renderer.shadowMap.enabled=state.settings.shadows;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.05;
    document.body.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display='none';
    this.controls=new PointerLockControls(this.camera,document.body);
    this.controls.pointerSpeed=state.settings.sensitivity;
    this.controls.maxPolarAngle=Math.PI*.94; this.controls.minPolarAngle=Math.PI*.06;
    this.lastFrameTime=performance.now();
 this.keys={}; this.velocity=new THREE.Vector3(); this.canJump=false;
    this.dash=false; this.crouch=false; this.slide=0; this.lean=0;
    this.botMeshes=[]; this.colliders=[]; this.mapGroup=null; this.handGroup=null; this.weaponGroup=null; this.muzzleFlash=null;
    this.running=false; this.paused=false; this.debug=false; this.health=100; this.stamina=100;
    this.fireCooldown=0; this.weaponKick=0; this.selectedSlot=1;
    this.ping=23; this.packetLoss=0; this.audioCtx=null;
    this.previewScene=null; this.previewCamera=null; this.previewRenderer=null; this.previewGroup=null;
    this.initLoadingPreview();
    this.bind(); this.animate();
  }
  bind(){
    addEventListener('resize',()=>{
      this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.pixelRatio));
    });
    addEventListener('keydown',e=>this.onKey(e,true)); addEventListener('keyup',e=>this.onKey(e,false));
    addEventListener('mousedown',e=>this.onMouseDown(e)); addEventListener('mouseup',e=>this.onMouseUp(e));
    this.controls.addEventListener('lock',()=>{this.paused=false;document.getElementById('pause-card').classList.add('hidden');document.getElementById('hint').style.display='none'});
    this.controls.addEventListener('unlock',()=>{if(this.running&&!this.paused){this.paused=true;document.getElementById('pause-card').classList.remove('hidden')}});
    document.getElementById('exit-to-menu').onclick=()=>this.stop();
    addEventListener('mousedown',()=>{if(this.running&&!this.controls.isLocked&&!this.paused)this.controls.lock()});
  }
  onMouseDown(e){
    if(e.button===0 && this.running && this.controls.isLocked && !this.paused){this.fire();}
  }
  onMouseUp(e){ if(e.button===0)this.firing=false; }
  onKey(e,down){
    this.keys[e.code]=down;
    if((e.code==='ControlLeft'||e.code==='ControlRight')&&state.settings.dashMode==='toggle'&&down&&!e.repeat)this.dash=!this.dash;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&state.settings.crouchMode==='toggle'&&down&&!e.repeat)this.crouch=!this.crouch;
    if(e.code==='Space'&&down&&!e.repeat&&this.canJump&&!this.crouch){this.velocity.y=6.8;this.canJump=false;}
    if(e.code==='Digit0'&&down&&!e.repeat)this.toggleDebug();
    if(e.code==='KeyG'&&down&&!e.repeat&&this.running&&this.controls.isLocked)this.breakNearestGlass();
    if(/^Digit[1-9]$/.test(e.code)&&down&&!e.repeat){this.selectedSlot=Number(e.code.slice(-1));this.updateHotbar();}
    if(e.code==='Digit0'&&down&&!e.repeat){this.selectedSlot=10;this.updateHotbar();}
  }
  toggleDebug(){this.debug=!this.debug;document.getElementById('debug-panel').classList.toggle('hidden',!this.debug);}
  mapLabel(map){return map==='city'?'市街地 / ブロック7':map==='mountain'?'山岳 / リッジライン':'室内 / 施設03'}
  missionData(map){
    return {
      city:{title:'市街地 / ブロック7',code:'CITY // BLOCK 7',brief:'都市区画を横断し、指定エリアの状況を確認する。建物の密集と遮蔽物を利用して安全に観測する。',tips:['中距離を維持','遮蔽物を活用','交差点を優先確認']},
      mountain:{title:'山岳 / リッジライン',code:'MOUNTAIN // RIDGELINE',brief:'高低差の大きい山岳地帯を進み、尾根と斜面から周辺を観測する。足場の変化に注意。',tips:['斜面では低速移動','尾根から周辺確認','谷側の視界に注意']},
      interior:{title:'室内 / 施設03',code:'INTERIOR // FACILITY 03',brief:'複数区画を持つ施設内部を探索し、各フロアの状況を確認する。ガラスや狭い通路で視界が変化する。',tips:['角を小さく確認','長い廊下に注意','開口部を活用']}
    }[map];
  }
  initLoadingPreview(){
    const el=document.getElementById('loading-preview'); if(!el)return;
    this.previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); this.previewRenderer.setSize(el.clientWidth||560,el.clientHeight||360,false);
    this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;this.previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    el.appendChild(this.previewRenderer.domElement);this.previewScene=new THREE.Scene();
    this.previewCamera=new THREE.PerspectiveCamera(42,(el.clientWidth||560)/(el.clientHeight||360),.1,100);this.previewCamera.position.set(11,10,14);this.previewCamera.lookAt(0,0,0);
    this.previewScene.add(new THREE.HemisphereLight(0xddeeff,0x222a27,2.1)); const sun=new THREE.DirectionalLight(0xdff6e8,2.6);sun.position.set(8,15,6);this.previewScene.add(sun);
  }
  buildPreview(map){
    if(!this.previewScene)return;
    if(this.previewGroup){this.previewGroup.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()});this.previewScene.remove(this.previewGroup)}
    const g=new THREE.Group();this.previewGroup=g;this.previewScene.add(g);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(32,.4,24),new THREE.MeshStandardMaterial({color:0x263136,roughness:1}));floor.position.y=-.2;g.add(floor);
    const block=(x,z,sx,sy,sz,c=0x536067)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color:c,roughness:.82}));o.position.set(x,sy/2,z);g.add(o);return o};
    if(map==='city'){for(let i=0;i<12;i++){const x=(i%4)*8-12,z=Math.floor(i/4)*7-7;block(x,z,6,4+(i%3)*2,5,0x49545a)}for(let i=0;i<6;i++)block((i-2.5)*8,0,1.2,.35,22,0x252f34)}
    else if(map==='mountain'){const mat=new THREE.MeshStandardMaterial({color:0x687269,roughness:1});for(let i=0;i<16;i++){const x=(i%4)*8-12,z=Math.floor(i/4)*7-10,h=1.2+(i%5)*.9;const o=new THREE.Mesh(new THREE.ConeGeometry(3+h*.55,h,5),mat);o.position.set(x,h/2-.1,z);o.rotation.y=i*.6;g.add(o)}for(let i=0;i<5;i++)block((i-2)*7,0,2,.5,18,0x39423f)}
    else {for(let i=0;i<5;i++){block(-12+i*6,0,5,4,.55,0x444d52);block(-12+i*6,8,5,4,.55,0x444d52)}for(let z=-7;z<=7;z+=7){block(-14,0,.55,8,6,0x444d52);block(14,0,.55,8,6,0x444d52)}const glass=new THREE.MeshPhysicalMaterial({color:0x9fd6df,transparent:true,opacity:.24,roughness:.04});for(let i=0;i<3;i++){const w=new THREE.Mesh(new THREE.BoxGeometry(4,2.5,.08),glass);w.position.set(-9+i*9,2.2,-7.2);g.add(w)}}
    const marker=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.12,24),new THREE.MeshStandardMaterial({color:0xd9ff5f,emissive:0x40520f,emissiveIntensity:1.5}));marker.position.y=.08;g.add(marker);
  }
  updateLoadingInfo(map){
    const data=this.missionData(map), $=id=>document.getElementById(id);
    $('loading-title').textContent=data.title;$('loading-code').textContent=data.code;$('loading-brief').textContent=data.brief;
    $('loading-tip-1').textContent=data.tips[0];$('loading-tip-2').textContent=data.tips[1];$('loading-tip-3').textContent=data.tips[2];
    $('load-rec-armor').textContent=state.armor;$('load-rec-helmet').textContent=state.helmet;$('load-rec-tool').textContent=state.primary;$('load-rec-support').textContent=state.secondary;$('load-bots').textContent=String(state.bots).padStart(2,'0');
    this.buildPreview(map);
  }
  async start(map,bots){
    state.map=map;state.bots=bots;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));document.getElementById('loading-screen').classList.add('active');
    this.updateLoadingInfo(map);this.renderer.domElement.style.display='none';this.running=false;
    const fill=document.getElementById('loading-fill'),pct=document.getElementById('loading-percent'),status=document.getElementById('loading-status');pct.textContent='0%';fill.style.width='0%';
    const steps=[['設定を確認しています…',12],['ライティングを準備しています…',28],['地形を生成しています…',50],['オブジェクトを配置しています…',72],['偵察ドローンを起動しています…',90],['フィールド同期を確認しています…',97],['完了',100]];
    for(const [msg,target] of steps){status.textContent=msg;await this.loadingTo(target,fill,pct)}
    this.buildScene();await new Promise(r=>setTimeout(r,220));document.getElementById('loading-screen').classList.remove('active');document.getElementById('game-ui').classList.remove('hidden');
    this.renderer.domElement.style.display='block';this.running=true;this.paused=false;this.health=100;this.stamina=100;this.ping=20+Math.round(Math.random()*15);this.packetLoss=0;this.controls.lock();
    document.getElementById('drone-counter').textContent=String(bots);this.updateHotbar();this.updateHealth();
  }
  loadingTo(target,fill,pct){return new Promise(resolve=>{const tick=()=>{const cur=Number(pct.textContent.replace('%',''))||0,next=Math.min(target,cur+2);pct.textContent=`${next}%`;fill.style.width=`${next}%`;if(next>=target)resolve();else requestAnimationFrame(tick)};tick()})}
  stop(){
    this.running=false;this.paused=false;this.controls.unlock();this.renderer.domElement.style.display='none';document.getElementById('game-ui').classList.add('hidden');document.getElementById('loading-screen').classList.remove('active');document.getElementById('debug-panel').classList.add('hidden');go('deploy-screen');
    if(this.mapGroup){this.mapGroup.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()});this.scene.remove(this.mapGroup)}
    if(this.handGroup){this.camera.remove(this.handGroup);this.handGroup=null} if(this.weaponGroup){this.camera.remove(this.weaponGroup);this.weaponGroup=null}
    this.botMeshes=[];this.colliders=[];this.mapGroup=null;
  }
  buildScene(){
    // Rebuild the world from scratch. Keep the camera in the scene graph so
    // camera-mounted hands/tools are always rendered after scene.clear().
    if(this.mapGroup){
      this.mapGroup.traverse(o=>{
        o.geometry?.dispose?.();
        if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.());
        else o.material?.dispose?.();
      });
    }
    // Keep the camera object and rebuild only the world.  The camera must never be
    // accidentally detached from the scene during a respawn.
    for(const child of [...this.scene.children]){
      if(child!==this.camera) this.scene.remove(child);
    }
    this.scene.add(this.camera);
    // Bright fallback sky: even if a future asset fails to load, the player will
    // never be left looking into a black canvas.
    this.scene.background=new THREE.Color(0x78a9bf);
    this.scene.fog=new THREE.Fog(0x78a9bf,120,420);
    this.mapGroup=new THREE.Group();
    this.scene.add(this.mapGroup);
    this.colliders=[];this.botMeshes=[];this.breakableGlass=[];

    const hemi=new THREE.HemisphereLight(0xffffff,0x56634f,3.5);
    this.mapGroup.add(hemi);
    const sun=new THREE.DirectionalLight(0xfff1c4,5.5);
    sun.position.set(-70,95,35); sun.castShadow=state.settings.shadows;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-110;sun.shadow.camera.right=110;
    sun.shadow.camera.top=110;sun.shadow.camera.bottom=-110;
    sun.shadow.bias=-0.0005;
    this.mapGroup.add(sun);

    this.addSky();
    this.addGround();
    this.addGrassClusters();
    if(state.map==='city')this.buildCity();
    else if(state.map==='mountain')this.buildMountain();
    else this.buildInterior();
    this.addDistantSilhouette();

    this.spawnDrones(state.bots);
    this.addHands();this.addWeapon();
    // Guaranteed open spawn area. This prevents spawning inside a building/rock after restarting a map.
    const spawns={city:[0,1.72,8],mountain:[0,1.72,8],interior:[0,1.72,8]};
    const s=spawns[state.map]||spawns.city;
    this.camera.position.set(s[0],s[1],s[2]);
    this.camera.rotation.set(0,0,0);
    this.camera.lookAt(0,1.55,-24);
    // three.js r0.185 PointerLockControls controls the camera directly;
    // getObject() existed in older releases and is not part of the current API.
    this.velocity.set(0,0,0);this.canJump=true;
    this.updateHotbar();
  }

  addSky(){
    if(!state.settings.sky)return;
    const sky=new THREE.Mesh(
      new THREE.SphereGeometry(300,40,24),
      new THREE.MeshBasicMaterial({color:0x7fa9c0,side:THREE.BackSide,fog:false})
    );
    sky.frustumCulled=false;
    this.mapGroup.add(sky);
    const sunSphere=new THREE.Mesh(new THREE.SphereGeometry(5.5,24,24),new THREE.MeshBasicMaterial({color:0xffefb0}));
    sunSphere.position.set(-105,95,-135);sunSphere.frustumCulled=false;this.mapGroup.add(sunSphere);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(14,20,20),new THREE.MeshBasicMaterial({color:0xffe8a0,transparent:true,opacity:.13,depthWrite:false}));
    glow.position.copy(sunSphere.position);glow.frustumCulled=false;this.mapGroup.add(glow);
  }

  addGround(){
    // Unlit fallback first: terrain remains visible even when texture loading or
    // color management changes between browsers.
    const fallbackMat=new THREE.MeshBasicMaterial({color:0x6f955c});
    const fallback=new THREE.Mesh(new THREE.PlaneGeometry(420,420),fallbackMat);
    fallback.rotation.x=-Math.PI/2;fallback.receiveShadow=true;fallback.name='ground-fallback';
    this.mapGroup.add(fallback);

    const tex=new THREE.TextureLoader();
    tex.load('./assets/grass.svg',(texture)=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(64,64);
      texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
      texture.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.MeshLambertMaterial({map:texture,color:0xb0cf86});
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(380,380),mat);
      ground.rotation.x=-Math.PI/2;ground.position.y=0.01;ground.receiveShadow=true;ground.name='ground-textured';
      this.mapGroup.add(ground);
    },undefined,()=>{});
  }

  addGrassClusters(){
    // Lightweight instanced grass tufts. This gives the terrain depth without
    // creating tens of thousands of separate Mesh objects.
    const blade=new THREE.PlaneGeometry(.16,.85,1,2);
    blade.translate(0,.42,0);
    const mat=new THREE.MeshStandardMaterial({color:0x5f8b43,side:THREE.DoubleSide,roughness:1,transparent:true,opacity:.82});
    for(let patch=0;patch<3;patch++){
      const count=patch===0?520:260;
      const inst=new THREE.InstancedMesh(blade,mat,count);
      const dummy=new THREE.Object3D();
      let n=0;
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2,r=12+Math.random()*115;
        let x=Math.cos(a)*r+(Math.random()-.5)*7;
        let z=Math.sin(a)*r+(Math.random()-.5)*7;
        if(Math.hypot(x,z)<8 && state.map!=='mountain') continue;
        dummy.position.set(x,.02,z);
        dummy.scale.setScalar(.45+Math.random()*1.25);
        dummy.rotation.set(0,Math.random()*Math.PI,0);
        dummy.updateMatrix();inst.setMatrixAt(n++,dummy.matrix);
      }
      inst.count=n;inst.instanceMatrix.needsUpdate=true;inst.castShadow=false;inst.receiveShadow=true;
      this.mapGroup.add(inst);
    }
  }

  box(x,y,z,sx,sy,sz,c=0x515a61,opts={}){
    const m=new THREE.MeshLambertMaterial({color:c});
    const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);
    o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;o.name=opts.name||'structure';
    this.mapGroup.add(o);
    if(opts.collider!==false)this.colliders.push({minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2,type:'box',object:o});
    return o;
  }

  tree(x,z,s=1){
    const g=new THREE.Group();g.position.set(x,0,z);
    const bark=new THREE.MeshLambertMaterial({color:0x5a4632});
    const green=new THREE.MeshLambertMaterial({color:0x2b6937});
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.34*s,2.4*s,7),bark);trunk.position.y=1.2*s;trunk.castShadow=true;g.add(trunk);
    for(let i=0;i<3;i++){
      const crown=new THREE.Mesh(new THREE.ConeGeometry((1.15-i*.17)*s,(2.2-i*.25)*s,8),green);
      crown.position.y=(2.2+i*.72)*s;crown.castShadow=true;g.add(crown);
    }
    this.mapGroup.add(g);
    this.colliders.push({minX:x-.38*s,maxX:x+.38*s,minZ:z-.38*s,maxZ:z+.38*s,type:'box',object:g});
    return g;
  }

  rock(x,z,s=1,c=0x68716b){
    const m=new THREE.MeshLambertMaterial({color:c});
    const g=new THREE.DodecahedronGeometry(1.1*s,0);
    const o=new THREE.Mesh(g,m);o.position.set(x,.7*s,z);o.scale.set(1.4,0.72,1);o.rotation.y=Math.random()*Math.PI;o.castShadow=true;o.receiveShadow=true;
    this.mapGroup.add(o);
    this.colliders.push({minX:x-1.3*s,maxX:x+1.3*s,minZ:z-1*s,maxZ:z+1*s,type:'box',object:o});
    return o;
  }

  stairs(x,z,w=5,steps=8,rise=.4,depth=.55,dir=0,c=0x4b5558){
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=dir;
    for(let i=0;i<steps;i++){
      const h=(i+1)*rise;
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth*(i+1)),new THREE.MeshStandardMaterial({color:c,roughness:.86}));
      o.position.set(0,h/2,(i*depth)/2);o.castShadow=true;o.receiveShadow=true;g.add(o);
    }
    this.mapGroup.add(g);
    // Broad conservative collision volume keeps the player from walking through the staircase.
    const span=steps*depth;
    const corners=[
      new THREE.Vector3(-w/2,0,-depth/2),new THREE.Vector3(w/2,0,span),
    ];
    const cc=new THREE.Vector3(x,0,z); // axis-aligned approximation
    this.colliders.push({minX:cc.x-w/2-0.1,maxX:cc.x+w/2+0.1,minZ:cc.z-depth/2-.2,maxZ:cc.z+span+.2,type:'box'});
    return g;
  }

  door(x,y,z,w=2.2,h=2.8,rot=0){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;
    const frameMat=new THREE.MeshStandardMaterial({color:0x283034,roughness:.7,metalness:.25});
    const panelMat=new THREE.MeshStandardMaterial({color:0x4c5659,roughness:.72});
    const top=new THREE.Mesh(new THREE.BoxGeometry(w+.35,.16,.22),frameMat);top.position.y=h/2;g.add(top);
    const left=new THREE.Mesh(new THREE.BoxGeometry(.16,h,.22),frameMat);left.position.x=-w/2;left.position.y=h/2;g.add(left);
    const right=left.clone();right.position.x=w/2;g.add(right);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(w-.12,h-.18,.12),panelMat);panel.position.y=h/2;panel.castShadow=true;panel.receiveShadow=true;g.add(panel);
    this.mapGroup.add(g);
    this.colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-.13,maxZ:z+.13,type:'box',object:g,door:true});
    return g;
  }

  windowGlass(x,y,z,w=3,h=2.2,rot=0){
    const mat=new THREE.MeshPhysicalMaterial({color:0x9bd6e3,transparent:true,opacity:.30,roughness:.04,metalness:.05,transmission:.22,side:THREE.DoubleSide});
    const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),mat);g.position.set(x,y,z);g.rotation.y=rot;g.castShadow=false;g.receiveShadow=true;g.userData.breakable=true;g.name='breakable-glass';
    this.mapGroup.add(g);this.breakableGlass.push(g);return g;
  }

  buildCity(){
    // Main road grid
    for(let x=-60;x<=60;x+=20)this.box(x,.06,0,4,.12,132,0x293238,{collider:false});
    for(let z=-60;z<=60;z+=20)this.box(0,.065,z,132,.13,4,0x293238,{collider:false});
    // Blocks, courtyards and rooftops
    const blocks=[[-45,-42,10,8,16],[0,-44,12,12,21],[42,-42,12,14,14],[-44,0,16,12,12],[42,1,14,18,18],[-42,42,13,10,17],[2,40,17,13,20],[44,43,12,11,13]];
    blocks.forEach((b,i)=>{
      const [x,z,w,d,h]=b;this.box(x,h/2,z,w,h,d,i%2?0x4e565b:0x454e53);
      // roof units / vents
      this.box(x+(i%2?2:-2),h+.7,z-.8,2,.9,2,0x323b3e);
    });
    // Low cover and barriers in alleys
    for(let i=0;i<18;i++){
      const x=((i*23)%100)-50,z=((i*41)%100)-50;
      if(Math.abs(x)<12&&Math.abs(z)<12)continue;
      this.box(x,.65,z,3.8,1.3,1.0,i%2?0x3b474b:0x56605f);
    }
    // Doors, windows and glass fronts
    this.door(-45,0,-33,2.2,3.2,0);this.door(42,0,-34,2.5,3.2,0);
    this.windowGlass(-41,4,-50,3,2.2,0);this.windowGlass(-49,4,-50,3,2.2,0);
    this.windowGlass(39,4,-49,3,2.2,0);this.windowGlass(47,4,-49,3,2.2,0);
    // Trees in pockets
    [[-57,-12,.9],[-12,-48,1.05],[13,-55,.82],[54,-14,.95],[-57,19,.8],[20,58,1.05],[57,31,.95],[-4,56,.8]].forEach(v=>this.tree(...v));
    [[-28,-25,.9],[-13,25,.75],[27,-12,1.05],[28,28,.72]].forEach(v=>this.rock(...v));
    this.stairs(24,7,6,8,.36,.62,Math.PI/2);
  }

  buildMountain(){
    // Layered ridge terrain; flattened geometry is kept intentionally light for iPad A16.
    const ridgeMat=new THREE.MeshStandardMaterial({color:0x5e6e5a,roughness:1});
    for(let i=0;i<18;i++){
      const x=(i%6)*22-55,z=Math.floor(i/6)*30-45;
      const h=2.5+((i*9)%8)*1.6;
      const o=new THREE.Mesh(new THREE.ConeGeometry(11+h, h*2.2, 6),ridgeMat);
      o.position.set(x,h/2-.2,z);o.rotation.y=i*.47;o.scale.z=1.65;o.castShadow=true;o.receiveShadow=true;this.mapGroup.add(o);
    }
    // Rocky ledges / cover
    for(let i=0;i<22;i++){
      const x=(i*19%116)-58,z=(i*37%120)-60,s=.8+((i*11)%9)/10;
      this.rock(x,z,s,0x606a63);
    }
    for(let i=0;i<30;i++){
      const x=(i*31%120)-60,z=(i*17%120)-60,s=.72+((i*7)%6)/9;this.tree(x,z,s);
    }
    // Small observation shelter with stairs and glass
    this.box(0,2,-7,10,4,7,0x424c4c);
    this.box(0,4.25,-7,10,.5,7,0x2f383a);
    this.windowGlass(-2.6,2.2,-10.55,2.8,1.9,0);this.windowGlass(2.6,2.2,-10.55,2.8,1.9,0);
    this.door(0,0,-10.55,2.2,3.0,0);this.stairs(0,-15,5,7,.35,.6,0);
  }

  buildInterior(){
    // Warehouse-like facility: corridors, multiple rooms, a mezzanine, doors and glass.
    const walls=0x454e52,accent=0x555f63;
    this.box(0,.18,0,54,.36,54,0x252c2f,{collider:false});
    // Outer shell
    this.box(0,3,-27,54,6,.7,walls);this.box(0,3,27,54,6,.7,walls);
    this.box(-27,3,0,.7,6,54,walls);this.box(27,3,0,.7,6,54,walls);
    // Internal rooms / corridors with deliberate openings
    [[-13,-13], [13,-13],[-13,13],[13,13]].forEach(([x,z])=>{
      this.box(x,3,z-7,20,6,.55,walls);this.box(x,3,z+7,20,6,.55,walls);
      this.box(x-10,3,z,.55,6,14,walls);this.box(x+10,3,z,.55,6,14,walls);
    });
    // Central mezzanine and stair block
    this.box(0,3,0,10,.45,14,accent,{collider:false});
    this.stairs(0,-3,4,9,.38,.58,Math.PI/2,accent);
    this.stairs(0,10,4,9,.38,.58,-Math.PI/2,accent);
    // Doors
    this.door(-13,0,-20,2.4,3.1,0);this.door(13,0,-20,2.4,3.1,0);
    this.door(-13,0,20,2.4,3.1,Math.PI);this.door(13,0,20,2.4,3.1,Math.PI);
    // Large breakable observation windows
    [-13,0,13].forEach(x=>this.windowGlass(x,3,-26.62,4.6,2.5,0));
    [-13,0,13].forEach(x=>this.windowGlass(x,4.2,26.62,4.2,1.9,Math.PI));
    // Crates / cover
    for(let i=0;i<28;i++){
      const x=(i%7)*6-18,z=Math.floor(i/7)*6-18;
      this.box(x,.7,z,1.8,1.4,1.8,i%3===0?0x56504a:0x3b4548);
    }
    // Ceiling lamps (visual only)
    for(let x=-18;x<=18;x+=12)for(let z=-18;z<=18;z+=12){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.5),new THREE.MeshBasicMaterial({color:0xdfeeea}));lamp.position.set(x,5.7,z);this.mapGroup.add(lamp);
    }
  }

  addDistantSilhouette(){
    // Very low-cost far skyline / ridgeline to avoid an empty horizon.
    const mat=new THREE.MeshStandardMaterial({color:0x5d746f,roughness:1});
    const g=new THREE.Group();
    for(let i=0;i<18;i++){
      const h=8+((i*17)%11)*2;const o=new THREE.Mesh(new THREE.BoxGeometry(8,h,6),mat);
      o.position.set((i-9)*18,h/2-0.1,-105-(i%3)*12);o.castShadow=false;g.add(o);
    }
    this.mapGroup.add(g);
  }

  spawnDrones(n){
    for(let i=0;i<n;i++){
      const g=new THREE.Group();
      const core=new THREE.Mesh(new THREE.SphereGeometry(.38,12,12),new THREE.MeshStandardMaterial({color:0x9ee7dc,emissive:0x184c45,emissiveIntensity:2}));g.add(core);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.06,8,20),new THREE.MeshStandardMaterial({color:0xd9ff5f,emissive:0x3c510f,emissiveIntensity:1.5}));ring.rotation.x=Math.PI/2;g.add(ring);
      g.position.set((i*13%50)-25,1.4+(i%3)*.5,(i*31%50)-25);this.mapGroup.add(g);this.botMeshes.push({mesh:g,origin:g.position.clone(),phase:i*1.7});
    }
  }

  breakNearestGlass(){
    if(!this.breakableGlass?.length)return;
    let best=null,bestD=3.2;
    const forward=new THREE.Vector3();this.camera.getWorldDirection(forward);
    const ray=new THREE.Raycaster(this.camera.position,forward,0.1,4.0);
    const hits=ray.intersectObjects(this.breakableGlass,false);
    if(hits.length) best=hits[0].object;
    if(best){
      this.breakableGlass=this.breakableGlass.filter(o=>o!==best);
      best.userData.broken=true;
      best.visible=false;
      best.geometry?.dispose?.();best.material?.dispose?.();
      // brief non-graphic sparkle feedback
      const ping=new THREE.Mesh(new THREE.RingGeometry(.15,.24,10),new THREE.MeshBasicMaterial({color:0xd9ff5f,transparent:true,opacity:.8,side:THREE.DoubleSide}));
      ping.position.copy(best.position);this.mapGroup.add(ping);let life=0;const tick=()=>{life+=.04;ping.scale.setScalar(1+life*3);ping.material.opacity=.8-life*1.6;if(life<.5)requestAnimationFrame(tick);else{this.mapGroup.remove(ping);ping.geometry.dispose();ping.material.dispose();}};tick();
    }
  }

  addHands(){
    this.handGroup=new THREE.Group();const skin=new THREE.MeshStandardMaterial({color:0xb58f79,roughness:.75});const glove=new THREE.MeshStandardMaterial({color:0x1e262b,roughness:.92});
    const arm1=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,.72,10),glove);arm1.rotation.z=-.30;arm1.position.set(-.32,-.30,-.48);this.handGroup.add(arm1);
    const arm2=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,.72,10),glove);arm2.rotation.z=.30;arm2.position.set(.32,-.30,-.48);this.handGroup.add(arm2);
    const hand1=new THREE.Mesh(new THREE.SphereGeometry(.14,10,10),skin);hand1.position.set(-.23,-.47,-.63);this.handGroup.add(hand1);const hand2=hand1.clone();hand2.position.x=.23;this.handGroup.add(hand2);
    this.camera.add(this.handGroup);this.scene.add(this.camera);this.handGroup.visible=state.settings.hands;
  }
  addWeapon(){
    this.weaponGroup=new THREE.Group();
    const dark=new THREE.MeshStandardMaterial({color:0x121619,roughness:.58,metalness:.25});
    const matte=new THREE.MeshStandardMaterial({color:0x2b3236,roughness:.82});
    const glass=new THREE.MeshStandardMaterial({color:0x61767d,roughness:.25,metalness:.1,transparent:true,opacity:.9});
    const receiver=new THREE.Mesh(new THREE.BoxGeometry(.34,.24,1.12),dark);receiver.position.set(.10,-.35,-.76);this.weaponGroup.add(receiver);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.75,12),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(.10,-.34,-1.65);this.weaponGroup.add(barrel);
    const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.14,12),matte);muzzle.rotation.x=Math.PI/2;muzzle.position.set(.10,-.34,-2.03);this.weaponGroup.add(muzzle);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.16,.45,.18),dark);grip.rotation.x=-.18;grip.position.set(.18,-.57,-.52);this.weaponGroup.add(grip);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.21,.20,.48),matte);stock.position.set(.10,-.37,-.02);this.weaponGroup.add(stock);
    const opticBase=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,.30),matte);opticBase.position.set(.10,-.18,-.74);this.weaponGroup.add(opticBase);
    const optic=new THREE.Mesh(new THREE.BoxGeometry(.11,.12,.22),glass);optic.position.set(.10,-.11,-.82);this.weaponGroup.add(optic);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.17,.035,.75),matte);rail.position.set(.10,-.20,-.82);this.weaponGroup.add(rail);
    this.muzzleFlash=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,8),new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:0,depthWrite:false}));this.muzzleFlash.rotation.x=-Math.PI/2;this.muzzleFlash.position.set(.10,-.34,-2.20);this.weaponGroup.add(this.muzzleFlash);
    this.weaponGroup.position.set(.04,.02,.00);this.weaponGroup.rotation.set(0,0,0);this.camera.add(this.weaponGroup);
  }
  fire(){
    if(this.fireCooldown>0)return; this.fireCooldown=.13; this.weaponKick=.06;
    this.playShotSound();
    if(this.muzzleFlash){this.muzzleFlash.material.opacity=.95;setTimeout(()=>{if(this.muzzleFlash)this.muzzleFlash.material.opacity=0},45)}
  }
  playShotSound(){
    try{
      this.audioCtx??=new (window.AudioContext||window.webkitAudioContext)();
      if(this.audioCtx.state==='suspended')this.audioCtx.resume();
      const t=this.audioCtx.currentTime;const osc=this.audioCtx.createOscillator();const gain=this.audioCtx.createGain();
      osc.type='square';osc.frequency.setValueAtTime(150,t);osc.frequency.exponentialRampToValueAtTime(70,t+.09);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.18,t+.005);gain.gain.exponentialRampToValueAtTime(.001,t+.12);osc.connect(gain).connect(this.audioCtx.destination);osc.start(t);osc.stop(t+.13);
    }catch{}
  }
  update(dt){
    if(!this.running||this.paused)return;
    this.controls.pointerSpeed=state.settings.sensitivity;
    if(state.settings.dashMode==='hold')this.dash=!!(this.keys.ControlLeft||this.keys.ControlRight);
    if(state.settings.crouchMode==='hold')this.crouch=!!(this.keys.ShiftLeft||this.keys.ShiftRight);
    const forward=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0),right=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0);const moving=forward!==0||right!==0;
    if(this.dash&&moving&&!this.crouch)this.stamina=Math.max(0,this.stamina-dt*21);else this.stamina=Math.min(100,this.stamina+dt*13);if(this.stamina<5)this.dash=false;
    let speed=this.dash?8.2:4.1;if(this.crouch)speed*=.53;if(this.dash&&this.crouch){this.slide=Math.min(1,this.slide+dt*4);speed=9.2}else this.slide=Math.max(0,this.slide-dt*4);
    const len=Math.hypot(forward,right)||1,f=forward/len,r=right/len;this.controls.getDirection(_dir);_dir.y=0;_dir.normalize();const side=new THREE.Vector3().crossVectors(_dir,this.camera.up).normalize();const wish=_dir.multiplyScalar(f).add(side.multiplyScalar(r)).multiplyScalar(speed);
    this.velocity.x=THREE.MathUtils.damp(this.velocity.x,wish.x,14,dt);this.velocity.z=THREE.MathUtils.damp(this.velocity.z,wish.z,14,dt);this.velocity.y-=18*dt;
    const pos=this.camera.position,nx=pos.x+this.velocity.x*dt,nz=pos.z+this.velocity.z*dt;let blocked=false;for(const c of this.colliders)if(c.type==='box'&&nx>c.minX-.35&&nx<c.maxX+.35&&nz>c.minZ-.35&&nz<c.maxZ+.35){blocked=true;break}if(!blocked){pos.x=nx;pos.z=nz}
    if(pos.y+this.velocity.y*dt<=(this.crouch?1.02:1.72)){pos.y=this.crouch?1.02:1.72;this.velocity.y=0;this.canJump=true}else pos.y+=this.velocity.y*dt;
    this.lean=THREE.MathUtils.lerp(this.lean,(this.keys.KeyQ?-0.16:0)+(this.keys.KeyE?0.16:0),Math.min(1,dt*12));
    const bob=moving?Math.sin(performance.now()*.008*(this.dash?1.7:1))*.018:0;const shake=this.dash?Math.sin(performance.now()*.035)*state.settings.shake*.008:0;
    this.camera.rotation.z=this.lean;this.camera.position.y+=((this.crouch?1.02:1.72)+bob+shake-this.camera.position.y)*Math.min(1,dt*12);
    if(this.weaponGroup){this.weaponGroup.visible=true;this.weaponGroup.position.x=this.lean*.42;this.weaponGroup.position.y=(this.crouch?-.11:0)+bob*.75;this.weaponGroup.rotation.z=-this.lean*.42;this.weaponGroup.rotation.x=this.weaponKick;this.weaponKick=THREE.MathUtils.damp(this.weaponKick,0,18,dt)}
    if(this.handGroup){this.handGroup.visible=state.settings.hands;this.handGroup.position.y=(this.crouch?-.1:0)+bob*.7;this.handGroup.position.x=this.lean*1.2;}
    this.botMeshes.forEach(b=>{b.mesh.position.x=b.origin.x+Math.sin(performance.now()*.0004+b.phase)*3;b.mesh.position.z=b.origin.z+Math.cos(performance.now()*.00033+b.phase)*3;b.mesh.rotation.y+=dt});
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);
    this.ping=Math.round(18+Math.sin(performance.now()*.0007)*5+Math.random()*5);this.packetLoss=Math.random()<.035?Number((Math.random()*.7).toFixed(1)):0;
    document.getElementById('stance').textContent=this.crouch?(this.dash?'スライド':'しゃがみ'):'立ち';document.getElementById('drive').textContent=this.dash?'ダッシュ':moving?'歩行':'停止';document.getElementById('hud-state').textContent=this.dash?'高速移動':this.slide>0?'スライド':'準備完了';
    document.getElementById('ping').textContent=`${this.ping} ms`;document.getElementById('packet-loss').textContent=`${this.packetLoss.toFixed(1)} %`;this.updateHealth();this.updateDebug();
  }
  updateHotbar(){
    document.querySelectorAll('#hotbar .slot').forEach((el,i)=>{el.classList.toggle('active',i+1===this.selectedSlot)})
    const names=['スキャナー','タブレット','カメラ','ビーコン','無線','センサー','救急キット','ツールキット','バッテリー','空'];
    const tool=names[this.selectedSlot-1]||'スキャナー';document.getElementById('tool-hud').textContent=tool;
  }
  updateHealth(){const hp=document.getElementById('hp-fill');if(hp)hp.style.width=`${this.health}%`;const hv=document.getElementById('hp-value');if(hv)hv.textContent=`${Math.round(this.health)}`;const sv=document.getElementById('stamina-fill');if(sv)sv.style.width=`${this.stamina}%`;const st=document.getElementById('stamina-value');if(st)st.textContent=`${Math.round(this.stamina)}`}
  updateDebug(){
    const p=this.camera.position,s=this.velocity.length();const txt=[`ZERO DIVISION // DEBUG`,`FPS: ${Math.round(this.currentFPS||0)}`,`POS: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,`VEL: ${s.toFixed(2)} m/s`,`MAP: ${state.map}`,`DRONES: ${state.bots}`,`PING: ${this.ping} ms`,`PACKET LOSS: ${this.packetLoss.toFixed(1)} %`,`DRAW CALLS: ${this.renderer.info.render.calls}`,`TRIANGLES: ${this.renderer.info.render.triangles}`,`PIXEL RATIO: ${this.renderer.getPixelRatio().toFixed(2)}`,`DASH: ${this.dash}  CROUCH: ${this.crouch}`,`TOOL SLOT: ${this.selectedSlot}`];document.getElementById('debug-lines').textContent=txt.join('\n');
  }
  render(){
    this.renderer.render(this.scene,this.camera);
    if(this.previewRenderer&&this.previewScene&&document.getElementById('loading-screen')?.classList.contains('active')){const t=performance.now()*.00022;this.previewCamera.position.x=Math.cos(t)*17;this.previewCamera.position.z=Math.sin(t)*17;this.previewCamera.position.y=10.5;this.previewCamera.lookAt(0,1.5,0);this.previewRenderer.render(this.previewScene,this.previewCamera)}
  }
  animate(){
    requestAnimationFrame(()=>this.animate());
    const now=performance.now();
    const dt=Math.min(0.05,Math.max(0.001,(now-this.lastFrameTime)/1000));
    this.lastFrameTime=now;
    this.update(dt);
    this.render();
    const fps=Math.round(1/dt);
    this.currentFPS=fps;
    const el=document.getElementById('fps');
    if(el)el.textContent=`${fps} FPS`;
  }
}
const _dir=new THREE.Vector3();
