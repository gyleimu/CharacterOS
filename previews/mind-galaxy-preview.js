// V10.35 Zoom/LOD
var SCALE_MIN=0.25,SCALE_MAX=8.0,LOD_TF=0.2;
var ZOOM_BANDS=[{level:"L0",min:0.25,max:0.75},{level:"L1",min:0.75,max:1.5},{level:"L2",min:1.5,max:3.0},{level:"L3",min:3.0,max:5.0},{level:"L4",min:5.0,max:8.0}];
var NODE_HOME={personality_core:"L0",impact_cluster:"L1",temporal_process:"L1",memory:"L2",impact_particle:"L2",belief:"L2",need:"L2",desire:"L2",behavior_bias:"L3",internal_state_variable:"L3",benchmark_signal:"L3"};
var LEVEL_ORD={L0:0,L1:1,L2:2,L3:3,L4:4};
function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}
function clampScale(s){return isFinite(s)?clamp(s,SCALE_MIN,SCALE_MAX):SCALE_MIN;}
function getLevel(s){s=clampScale(s);for(var i=0;i<ZOOM_BANDS.length;i++){var b=ZOOM_BANDS[i];if(s>=b.min&&s<b.max)return b.level;}return"L4";}
function bandForLevel(lv){for(var i=0;i<ZOOM_BANDS.length;i++)if(ZOOM_BANDS[i].level===lv)return ZOOM_BANDS[i];return ZOOM_BANDS[4];}
function fullOpacityAt(band){return band.min+(band.max-band.min)*LOD_TF;}
function lodOpacity(nodeType,scale){var home=NODE_HOME[nodeType];if(!home)return 1;var ho=LEVEL_ORD[home],co=LEVEL_ORD[getLevel(scale)];if(co<ho)return 0;if(co>ho)return 1;var b=bandForLevel(getLevel(scale)),fa=fullOpacityAt(b);if(scale<fa)return clamp((scale-b.min)/(fa-b.min),0,1);return 1;}

// Fixture
var W=900,H=700,WW=2000,WH=1600,WCX=WW/2,WCY=WH/2;
function hf(s){var h=0;for(var i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return(h>>>0)/4294967295;}
var NODES=[
  {id:"core",type:"personality_core",label:"Personality Core",x:WCX,y:WCY,r:28,fill:"#FFD700",stroke:"#B8860B",w:1.0,z:100,drift:{a:hf("core")*Math.PI*2,m:0.15+hf("corem")*0.3}},
  {id:"cl_a",type:"impact_cluster",label:"Abandonment",x:WCX-380,y:WCY+200,r:35,fill:"rgba(100,149,237,0.25)",stroke:"#4169E1",w:0.7,risk:"high",z:30,drift:{a:hf("cla")*Math.PI*2,m:0.15+hf("clam")*0.4}},
  {id:"cl_s",type:"impact_cluster",label:"Support",x:WCX+360,y:WCY-250,r:28,fill:"rgba(60,179,113,0.25)",stroke:"#3CB371",w:0.5,risk:"low",z:30,drift:{a:hf("cls")*Math.PI*2,m:0.15+hf("clsm")*0.3}},
  {id:"m1",type:"memory",label:"Mother left in rain",x:WCX-440,y:WCY+280,r:9,fill:"#87CEEB",stroke:"#4682B4",w:0.8,risk:"high",z:50,drift:{a:hf("m1")*Math.PI*2,m:0.15+hf("m1m")*0.3}},
  {id:"m2",type:"memory",label:"First heartbreak",x:WCX-300,y:WCY+150,r:7,fill:"#87CEEB",stroke:"#4682B4",w:0.6,risk:"medium",z:50,drift:{a:hf("m2")*Math.PI*2,m:0.15+hf("m2m")*0.2}},
  {id:"m3",type:"memory",label:"Friend stayed up",x:WCX+410,y:WCY-330,r:6,fill:"#87CEEB",stroke:"#4682B4",w:0.5,z:50,drift:{a:hf("m3")*Math.PI*2,m:0.15+hf("m3m")*0.2}},
  {id:"b1",type:"belief",label:"Intimacy fails",x:WCX-280,y:WCY-80,r:11,fill:"#98FB98",stroke:"#228B22",w:0.7,risk:"high",z:50,drift:{a:hf("b1")*Math.PI*2,m:0.15+hf("b1m")*0.2}},
  {id:"b2",type:"belief",label:"People can be trusted",x:WCX+250,y:WCY+60,r:9,fill:"#98FB98",stroke:"#228B22",w:0.4,risk:"low",z:50,drift:{a:hf("b2")*Math.PI*2,m:0.15+hf("b2m")*0.15}},
  {id:"n1",type:"need",label:"Safety",x:WCX-80,y:WCY-120,r:9,fill:"#3A3A5A",stroke:"#6A6A9A",w:0.8,risk:"high",z:50,drift:{a:hf("n1")*Math.PI*2,m:0.15+hf("n1m")*0.2}},
  {id:"d1",type:"desire",label:"Control",x:WCX+70,y:WCY-140,r:7,fill:"#FF6347",stroke:"#CD5C5C",w:0.6,risk:"medium",z:50,drift:{a:hf("d1")*Math.PI*2,m:0.15+hf("d1m")*0.2}},
  {id:"bb1",type:"behavior_bias",label:"Avoid conflict",x:WCX-130,y:WCY+100,r:6,fill:"#FFA500",stroke:"#FF8C00",w:0.5,risk:"medium",z:50,drift:{a:hf("bb1")*Math.PI*2,m:0.15+hf("bb1m")*0.1}},
  {id:"tp1",type:"temporal_process",label:"Memory decay",x:WCX-480,y:WCY-440,r:5,fill:"#E8E8E8",stroke:"#B8B8B8",w:0.3,z:45,drift:{a:hf("tp1")*Math.PI*2,m:0.1+hf("tp1m")*0.1}},
  {id:"bs1",type:"benchmark_signal",label:"Trust check",x:WCX+520,y:WCY+440,r:4,fill:"#00FF7F",stroke:"#2E8B57",w:0.2,risk:"low",z:60,drift:{a:hf("bs1")*Math.PI*2,m:0.1+hf("bs1m")*0.1}}
];
var NM={};for(var i=0;i<NODES.length;i++)NM[NODES[i].id]=NODES[i];
var EDGES=[
  {id:"e1",t:"belongs_to_cluster",s:"m1",d:"cl_a",w:0.9,style:{stroke:"#4169E1",sw:1.5,op:0.6},dir:0},
  {id:"e2",t:"belongs_to_cluster",s:"m2",d:"cl_a",w:0.7,style:{stroke:"#4169E1",sw:1.5,op:0.6},dir:0},
  {id:"e3",t:"belongs_to_cluster",s:"m3",d:"cl_s",w:0.6,style:{stroke:"#3CB371",sw:1.5,op:0.6},dir:0},
  {id:"e4",t:"activates_belief",s:"cl_a",d:"b1",w:0.8,style:{stroke:"#228B22",sw:2,op:0.7},dir:1},
  {id:"e5",t:"activates_belief",s:"cl_s",d:"b2",w:0.5,style:{stroke:"#228B22",sw:2,op:0.7},dir:1},
  {id:"e6",t:"creates_need",s:"b1",d:"n1",w:0.7,style:{stroke:"#8B0000",sw:2,op:0.6},dir:1},
  {id:"e7",t:"drives_desire",s:"n1",d:"d1",w:0.6,style:{stroke:"#CD5C5C",sw:2,op:0.6},dir:1},
  {id:"e8",t:"pulls_personality",s:"cl_a",d:"core",w:0.8,style:{stroke:"#FF4500",sw:2.5,op:0.8},dir:1},
  {id:"e9",t:"pulls_personality",s:"cl_s",d:"core",w:0.5,style:{stroke:"#6495ED",sw:2.5,op:0.7},dir:1},
  {id:"e10",t:"biases_behavior",s:"b1",d:"bb1",w:0.6,style:{stroke:"#FF8C00",sw:2,op:0.7},dir:1}
];
var EDGE_MINZ={belongs_to_cluster:"L1",clusters_around:"L1",pulls_personality:"L2",impacts_personality:"L2",activates_belief:"L2",reinforces_belief:"L2",creates_need:"L2",drives_desire:"L2",biases_behavior:"L3",regulated_by_homeostasis:"L3",observed_by_benchmark:"L3",temporal_transition:"L3",decays_to:"L3",derived_from:"L3"};

// Canvas drawing functions
var canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d");
canvas.width=W;canvas.height=H;
function isFiniteNumber(v){return typeof v==="number"&&isFinite(v);}
function worldToScreen(wx,wy,px,py,s){return{x:(wx-px)*s,y:(wy-py)*s};}
function computeNodeCenter(nodes,fallbackX,fallbackY){
  if(!nodes||nodes.length===0)return{x:fallbackX,y:fallbackY};
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,seen=0;
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];
    if(!isFiniteNumber(n.x)||!isFiniteNumber(n.y))continue;
    minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y);seen++;
  }
  if(seen===0)return{x:fallbackX,y:fallbackY};
  return{x:(minX+maxX)/2,y:(minY+maxY)/2};
}
function setDataStatus(text,statusClass){
  var el=document.getElementById("hud-data");
  realDataStatus=text;
  if(!el)return;
  el.textContent=text;
  el.className=statusClass||"";
}
function drawBg(c){ctx.fillStyle=c.color;ctx.fillRect(0,0,W,H);}
function drawGlow(c){var g=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.radius);g.addColorStop(0,c.color);g.addColorStop(1,"transparent");ctx.globalAlpha=c.opacity;ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x,c.y,c.radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
function drawLine(c){ctx.globalAlpha=c.opacity;ctx.strokeStyle=c.stroke;ctx.lineWidth=c.strokeWidth;ctx.beginPath();ctx.moveTo(c.x1,c.y1);ctx.lineTo(c.x2,c.y2);ctx.stroke();if(c.directed){var dx=c.x2-c.x1,dy=c.y2-c.y1,len=Math.sqrt(dx*dx+dy*dy);if(len>0){var ux=dx/len,uy=dy/len,tx=c.x2-ux*6,ty=c.y2-uy*6;ctx.fillStyle=c.stroke;ctx.beginPath();ctx.moveTo(c.x2,c.y2);ctx.lineTo(tx-uy*4,ty+ux*4);ctx.lineTo(tx+uy*4,ty-ux*4);ctx.closePath();ctx.fill();}}ctx.globalAlpha=1;}
function drawCircle(c){ctx.globalAlpha=c.opacity;ctx.fillStyle=c.fill;ctx.strokeStyle=c.stroke;ctx.lineWidth=c.strokeWidth;ctx.beginPath();ctx.arc(c.x,c.y,c.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.globalAlpha=1;}
function drawText(c){ctx.globalAlpha=c.opacity;ctx.fillStyle=c.color;ctx.font=c.fontSize+"px system-ui, sans-serif";ctx.textAlign="center";ctx.fillText(c.content,c.x,c.y);ctx.globalAlpha=1;}
function drawDrift(c){ctx.globalAlpha=c.opacity;ctx.strokeStyle=c.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.endX,c.endY);ctx.stroke();var dx=c.dx,dy=c.dy,len=Math.sqrt(dx*dx+dy*dy);if(len>0.5){var ux=dx/len,uy=dy/len;ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(c.endX,c.endY);ctx.lineTo(c.endX-ux*3-uy*2,c.endY-uy*3+ux*2);ctx.lineTo(c.endX-ux*3+uy*2,c.endY-uy*3-ux*2);ctx.closePath();ctx.fill();}ctx.globalAlpha=1;}
var DRAW={background:drawBg,glow:drawGlow,line:drawLine,circle:drawCircle,text:drawText,driftVector:drawDrift};

// Build commands with continuous LOD + slow drift
function buildCommands(scale,px,py,now){
  if(now===void 0)now=performance.now();
  var level=getLevel(scale),showLabels=LEVEL_ORD[level]>=LEVEL_ORD.L3;
  var driftVis=(level==="L4"&&!reducedMotion&&!paused)?clamp((scale-5.0)/(5.6-5.0),0,1):0;
  var cmds=[],driftOff={};

  cmds.push({kind:"background",color:"#0A0A14",width:W,height:H,zIndex:0});
  // Nebula dust clouds — multiple off-center faint glows for natural nebula feel
  var nebBase=0.06+clamp((scale-0.25)/2.5,0,0.25);
  var nebR=Math.max(W,H)*0.5;
  cmds.push({kind:"glow",x:W*0.5,y:H*0.5,radius:nebR,color:"rgba(70,90,170,0.05)",opacity:nebBase,zIndex:4});
  cmds.push({kind:"glow",x:W*0.35,y:H*0.55,radius:nebR*0.7,color:"rgba(100,80,160,0.04)",opacity:nebBase*0.8,zIndex:4});
  cmds.push({kind:"glow",x:W*0.65,y:H*0.45,radius:nebR*0.7,color:"rgba(60,100,140,0.04)",opacity:nebBase*0.8,zIndex:4});
  cmds.push({kind:"glow",x:W/2,y:H/2,radius:nebR*0.55,color:"rgba(90,110,190,0.05)",opacity:nebBase*0.9,zIndex:5});

  // Drift offsets (L4 only, deterministic from node id + elapsed time)
  if(driftVis>0){
    var tSec=now/1000;
    // driftMode: "subtle" = 50-100s period, 0.5-2px; "visible" = 20-40s period, 3-6px
    var periodBase=driftMode==="visible"?25:55;
    var periodRange=driftMode==="visible"?25:55;
    var ampScale=driftMode==="visible"?2.5:1.0;
    for(var i=0;i<NODES.length;i++){var n=NODES[i];if(!n.drift)continue;
      var period=periodBase+hf(n.id+"per")*periodRange,phase=hf(n.id+"phase")*Math.PI*2,omega=(2*Math.PI)/period;
      var rox=Math.cos(omega*tSec+phase)*n.drift.m*Math.cos(n.drift.a);
      var roy=Math.sin(omega*tSec+phase)*n.drift.m*Math.sin(n.drift.a);
      driftOff[n.id]={ox:rox*driftVis*scale*ampScale,oy:roy*driftVis*scale*ampScale};
    }
  }

  // Cluster + core glows
  for(var i=0;i<NODES.length;i++){var n=NODES[i];if(n.type!=="impact_cluster")continue;
    var op=lodOpacity(n.type,scale);if(op<=0)continue;
    var p=worldToScreen(n.x,n.y,px,py,scale);
    cmds.push({kind:"glow",x:p.x,y:p.y,radius:n.r*2.5*scale,color:n.fill,opacity:0.12*op,zIndex:6,nodeId:n.id});
  }
  var core=NODES[0],cop=lodOpacity(core.type,scale),cp=worldToScreen(core.x,core.y,px,py,scale);
  cmds.push({kind:"glow",x:cp.x,y:cp.y,radius:core.r*3*scale,color:core.fill,opacity:0.15*cop,zIndex:7,nodeId:core.id});

  // Edges
  for(var i=0;i<EDGES.length;i++){var e=EDGES[i],minZ=EDGE_MINZ[e.t]||"L2";
    if(LEVEL_ORD[level]<LEVEL_ORD[minZ])continue;
    var src=NM[e.s],tgt=NM[e.d];if(!src||!tgt)continue;
    var sOp=lodOpacity(src.type,scale),tOp=lodOpacity(tgt.type,scale);if(sOp<=0||tOp<=0)continue;
    var sp=worldToScreen(src.x,src.y,px,py,scale),tp=worldToScreen(tgt.x,tgt.y,px,py,scale);
    var ew=clamp(e.style.sw*scale*0.4,0.5,3.0);
    cmds.push({kind:"line",x1:sp.x,y1:sp.y,x2:tp.x,y2:tp.y,stroke:e.style.stroke,strokeWidth:ew,opacity:Math.min(sOp,tOp)*e.style.op*0.85,directed:!!e.dir,edgeId:e.id,zIndex:10});
  }

  // Orbit ghost hints (L4 only, very faint anchor circles at original node positions)
  if(driftVis>0){
    for(var i=0;i<NODES.length;i++){var n=NODES[i],op=lodOpacity(n.type,scale);if(op<=0)continue;
      var p=worldToScreen(n.x,n.y,px,py,scale),r=n.r*scale;
      cmds.push({kind:"circle",x:p.x,y:p.y,radius:r,fill:"transparent",stroke:n.stroke,strokeWidth:0.5,opacity:0.12*driftVis*op,nodeId:n.id+"_ghost",zIndex:n.z-1});
    }
  }

  // Nodes (with drift offsets applied)
  for(var i=0;i<NODES.length;i++){var n=NODES[i],op=lodOpacity(n.type,scale);if(op<=0)continue;
    var p=worldToScreen(n.x,n.y,px,py,scale),d=driftOff[n.id]||{ox:0,oy:0},r=n.r*scale;
    cmds.push({kind:"circle",x:p.x+d.ox,y:p.y+d.oy,radius:r,fill:n.fill,stroke:n.stroke,strokeWidth:(n.risk==="high"?3:n.risk==="medium"?2:1)*Math.max(0.5,scale*0.4),opacity:0.9*op,nodeId:n.id,zIndex:n.z});
  }

  // Labels
  if(showLabels){
    for(var i=0;i<NODES.length;i++){var n=NODES[i],op=lodOpacity(n.type,scale);if(op<=0)continue;
      var p=worldToScreen(n.x,n.y,px,py,scale),d=driftOff[n.id]||{ox:0,oy:0},sr=n.r*scale;if(sr<6)continue;
      var fadeOp=clamp((LEVEL_ORD[level]-LEVEL_ORD.L2)/2,0,1);
      cmds.push({kind:"text",x:p.x+d.ox*0.5,y:p.y+d.oy*0.5+sr+7,content:n.label.slice(0,20),fontSize:clamp(8*scale*0.6,7,12),color:"#C0C0C8",opacity:0.8*fadeOp*op,nodeId:n.id,zIndex:200});
    }
    for(var i=0;i<EDGES.length;i++){var e=EDGES[i];if(LEVEL_ORD[level]<LEVEL_ORD.L3)continue;
      var src=NM[e.s],tgt=NM[e.d];if(!src||!tgt)continue;
      var sOp=lodOpacity(src.type,scale),tOp=lodOpacity(tgt.type,scale);if(sOp<=0||tOp<=0)continue;
      var sp=worldToScreen(src.x,src.y,px,py,scale),tp=worldToScreen(tgt.x,tgt.y,px,py,scale),mx=(sp.x+tp.x)/2,my=(sp.y+tp.y)/2;
      cmds.push({kind:"text",x:mx,y:my-4,content:e.t.replace(/_/g," "),fontSize:7,color:e.style.stroke,opacity:0.4,edgeId:e.id,zIndex:200});
    }
  }

  // Drift vector arrows
  if(driftVis>0){
    for(var i=0;i<NODES.length;i++){var n=NODES[i],op=lodOpacity(n.type,scale);if(op<=0||!n.drift)continue;
      var p=worldToScreen(n.x,n.y,px,py,scale),d=driftOff[n.id]||{ox:0,oy:0},sx=p.x+d.ox,sy=p.y+d.oy;
      cmds.push({kind:"driftVector",x:sx,y:sy,dx:d.ox,dy:d.oy,endX:sx+d.ox,endY:sy+d.oy,color:"#6495ED",opacity:0.25*driftVis*op,nodeId:n.id,zIndex:300});
    }
  }
  return cmds;
}

// Render + Animation loop
function render(now){
  ctx.clearRect(0,0,W,H);
  if(now===void 0)now=performance.now();
  var sampleNow=frozenTime?fixedTimeMs:now;
  lastFrameTimeMs=sampleNow;
  var cmds=buildCommands(scaleVal,panX,panY,sampleNow);
  cmds.sort(function(a,b){return a.zIndex-b.zIndex;});
  for(var i=0;i<cmds.length;i++){var d=DRAW[cmds[i].kind];if(d)d(cmds[i]);}
  document.getElementById("hud-scale").textContent=scaleVal.toFixed(2);
  document.getElementById("hud-level").textContent=getLevel(scaleVal);
  var anEl=document.getElementById("hud-anim");
  if(paused){anEl.textContent="paused";anEl.className="paused";}
  else{anEl.textContent="running";anEl.className="anim";}
  var motEl=document.getElementById("hud-motion");
  motEl.textContent=reducedMotion?"motion:reduced":"motion:normal";
  if(reducedMotion)motEl.className="reduced";else motEl.className="";
  var nc=cmds.filter(function(c){return c.kind==="circle"&&String(c.nodeId||"").indexOf("_ghost")<0;}).length;
  var ec=cmds.filter(function(c){return c.kind==="line";}).length;
  visibleNodeCount=nc;visibleEdgeCount=ec;
  document.getElementById("hud-nodes").textContent=nc+" nodes";
  highlightZoomButton();
  var driftEl=document.getElementById("hud-drift");
  if(driftEl){
    var level=getLevel(scaleVal);
    if(level!=="L4"||reducedMotion){driftEl.textContent="drift:—";driftEl.className="";}
    else{driftEl.textContent="drift:"+driftMode;driftEl.className="anim";}
  }
  updateDebugPanel();
}

function animLoop(now){if(!paused)render(now);requestAnimationFrame(animLoop);}

// State
var scaleVal=0.5,panX=WCX,panY=WCY,paused=false,reducedMotion=false,driftMode="subtle",worldCenterX=WCX,worldCenterY=WCY;
var frozenTime=false,fixedTimeMs=0,lastFrameTimeMs=0,visibleNodeCount=0,visibleEdgeCount=0,realDataStatus="real:loading";
function centerPan(){panX=worldCenterX-W/(2*scaleVal);panY=worldCenterY-H/(2*scaleVal);}
function highlightZoomButton(){
  var level=getLevel(scaleVal);
  document.querySelectorAll("#controls button[data-scale]").forEach(function(b){
    var ls=getLevel(parseFloat(b.dataset.scale));
    if(ls===level&&b.id!=="btn-pause"&&b.id!=="btn-motion"&&b.id!=="btn-drift"&&b.id!=="btn-source")
      b.classList.add("active");
    else if(b.dataset.scale) b.classList.remove("active");
  });
}

// Input
canvas.addEventListener("wheel",function(e){e.preventDefault();
  var rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
  var wx=mx/scaleVal+panX,wy=my/scaleVal+panY;
  scaleVal=clampScale(scaleVal*(e.deltaY<0?1.08:0.926));
  panX=wx-mx/scaleVal;panY=wy-my/scaleVal;
},{passive:false});
var dragging=false,dsx,dsy,dpx,dpy;
canvas.addEventListener("mousedown",function(e){dragging=true;dsx=e.clientX;dsy=e.clientY;dpx=panX;dpy=panY;});
window.addEventListener("mouseup",function(){dragging=false;});
window.addEventListener("mousemove",function(e){if(!dragging)return;panX=dpx-(e.clientX-dsx)/scaleVal;panY=dpy-(e.clientY-dsy)/scaleVal;});
canvas.addEventListener("contextmenu",function(e){e.preventDefault();});
document.querySelectorAll("#controls button[data-scale]").forEach(function(btn){
  btn.addEventListener("click",function(){
    var target=parseFloat(btn.dataset.scale);
    if(btn.textContent.indexOf("Reset")>=0){scaleVal=0.5;centerPan();}
    else{scaleVal=target;centerPan();}
    if(paused)render(performance.now());
  });
});
document.getElementById("btn-pause").addEventListener("click",function(){
  paused=!paused;this.textContent=paused?"Play":"Pause";
  render(performance.now());
});
document.getElementById("btn-motion").addEventListener("click",function(){
  reducedMotion=!reducedMotion;
  this.textContent=reducedMotion?"Motion:off":"Motion";
  if(reducedMotion)this.classList.add("active");else this.classList.remove("active");
  if(paused)render(performance.now());
});

// Drift mode toggle
var driftBtn=document.getElementById("btn-drift");
if(driftBtn)driftBtn.addEventListener("click",function(){
  driftMode=driftMode==="subtle"?"visible":"subtle";
  this.textContent=driftMode==="visible"?"Drift:visible":"Drift:subtle";
  if(driftMode==="visible")this.classList.add("active");else this.classList.remove("active");
  if(paused)render(performance.now());
});

// Data source switching
var dataSource="fixture";
var realDataReady=false;
var FIXTURE_NODES=NODES.slice(),FIXTURE_EDGES=EDGES.slice(),FIXTURE_NM=NM;
var REAL_NODES=null,REAL_EDGES=null,REAL_NM=null,REAL_CENTER={x:WCX,y:WCY};

function ingestRealData(d,sourceLabel){
  if(!d||!Array.isArray(d.nodes)||!Array.isArray(d.edges)){
    setDataStatus("real:invalid","warn");
    console.log("Real data missing nodes/edges");
    return false;
  }
  var rn=[],re=[],rnm={};
  for(var i=0;i<d.nodes.length;i++){var n=d.nodes[i];
    if(!n||!n.id||!isFiniteNumber(n.x)||!isFiniteNumber(n.y))continue;
    var normalized={id:n.id,type:n.type,label:n.label||"",x:n.x,y:n.y,r:n.r||6,fill:n.fill||"#888",stroke:n.stroke||"#666",w:n.w||0.5,risk:n.risk,z:n.z||50,drift:n.drift};
    rn.push(normalized);rnm[normalized.id]=normalized;
  }
  for(var j=0;j<d.edges.length;j++){var e=d.edges[j];
    if(!e||!rnm[e.s]||!rnm[e.d])continue;
    re.push({id:e.id,t:e.t,s:e.s,d:e.d,w:e.w,style:e.style||{stroke:"#888",sw:1,op:0.5},dir:e.dir||0});
  }
  if(rn.length===0){
    setDataStatus("real:empty","warn");
    console.log("Real data contains no valid nodes");
    return false;
  }
  var center=computeNodeCenter(rn,WCX,WCY);
  REAL_CENTER={
    x:isFiniteNumber(d.centerX)?d.centerX:center.x,
    y:isFiniteNumber(d.centerY)?d.centerY:center.y
  };
  REAL_NODES=rn;REAL_EDGES=re;REAL_NM=rnm;realDataReady=true;
  setDataStatus("real:ready "+rn.length+"/"+re.length,"ok");
  console.log("Real data loaded from "+sourceLabel+": "+rn.length+" nodes, "+re.length+" edges.");
  if(dataSource==="real")swapDataSource("real");
  else render(performance.now());
  return true;
}

function swapDataSource(to){
  if(to==="real"){
    if(!realDataReady){
      setDataStatus("real:not ready","warn");
      console.log("Real data not loaded. Run: npx tsx scripts/export-mind-galaxy-preview-data.ts");
      return;
    }
    NODES=REAL_NODES;EDGES=REAL_EDGES;NM=REAL_NM;
    worldCenterX=REAL_CENTER.x;worldCenterY=REAL_CENTER.y;
    dataSource="real";
  }else{
    NODES=FIXTURE_NODES;EDGES=FIXTURE_EDGES;NM=FIXTURE_NM;
    worldCenterX=WCX;worldCenterY=WCY;
    dataSource="fixture";
  }
  centerPan();
  document.getElementById("hud-src").textContent=dataSource;
  var btn=document.getElementById("btn-source");
  btn.textContent=dataSource==="fixture"?"Real":"Fixture";
  if(dataSource==="real")btn.classList.add("active");else btn.classList.remove("active");
  render(performance.now());
}

document.getElementById("btn-source").addEventListener("click",function(){
  swapDataSource(dataSource==="fixture"?"real":"fixture");
});

// Debug instrument controls
function setScaleAndCenter(nextScale){
  scaleVal=clampScale(nextScale);
  centerPan();
  render(performance.now());
}
function setPreset(name){
  if(name==="outer"){
    driftMode="subtle";reducedMotion=false;setScaleAndCenter(0.5);
  }else if(name==="memory"){
    driftMode="subtle";reducedMotion=false;setScaleAndCenter(2.25);
  }else if(name==="drift"){
    driftMode="visible";reducedMotion=false;paused=false;frozenTime=false;setScaleAndCenter(6.5);
  }
  syncControlButtons();
  render(performance.now());
}
function syncControlButtons(){
  var motionBtn=document.getElementById("btn-motion");
  if(motionBtn){motionBtn.textContent=reducedMotion?"Motion:off":"Motion";if(reducedMotion)motionBtn.classList.add("active");else motionBtn.classList.remove("active");}
  var driftBtn=document.getElementById("btn-drift");
  if(driftBtn){driftBtn.textContent=driftMode==="visible"?"Drift:visible":"Drift:subtle";if(driftMode==="visible")driftBtn.classList.add("active");else driftBtn.classList.remove("active");}
  var pauseBtn=document.getElementById("btn-pause");
  if(pauseBtn)pauseBtn.textContent=paused?"Play":"Pause";
  var freezeBtn=document.getElementById("btn-freeze-time");
  if(freezeBtn){freezeBtn.textContent=frozenTime?"Unfreeze Time":"Freeze Time";if(frozenTime)freezeBtn.classList.add("active");else freezeBtn.classList.remove("active");}
}
function updateDebugPanel(){
  var panel=document.getElementById("debug-panel");
  if(!panel)return;
  function put(id,text){var el=document.getElementById(id);if(el)el.textContent=text;}
  put("dbg-scale",scaleVal.toFixed(2));
  put("dbg-level",getLevel(scaleVal));
  put("dbg-source",dataSource);
  put("dbg-motion",reducedMotion?"reduced":paused?"paused":"normal");
  put("dbg-drift",driftMode);
  put("dbg-time",String(Math.round(lastFrameTimeMs)));
  put("dbg-visible-nodes",String(visibleNodeCount));
  put("dbg-visible-edges",String(visibleEdgeCount));
  put("dbg-real",realDataStatus);
}
function buildSnapshotSummary(){
  return [
    "Mind Galaxy Snapshot Summary",
    "dataSource: "+dataSource,
    "scale: "+scaleVal.toFixed(2),
    "level: "+getLevel(scaleVal),
    "driftMode: "+driftMode,
    "reducedMotion: "+reducedMotion,
    "paused: "+paused,
    "frozenTime: "+frozenTime,
    "visibleNodes: "+visibleNodeCount,
    "visibleEdges: "+visibleEdgeCount,
    "totalNodes: "+NODES.length,
    "totalEdges: "+EDGES.length,
    "timeMs: "+Math.round(lastFrameTimeMs),
    "realDataStatus: "+realDataStatus
  ].join("\n");
}
function writeSnapshotSummary(){
  var text=buildSnapshotSummary();
  var box=document.getElementById("debug-snapshot");
  if(box)box.value=text;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).catch(function(){});
  }
}
document.getElementById("debug-toggle").addEventListener("click",function(){
  var panel=document.getElementById("debug-panel");
  panel.classList.toggle("collapsed");
  updateDebugPanel();
});
document.getElementById("btn-freeze-time").addEventListener("click",function(){
  frozenTime=!frozenTime;
  if(frozenTime)fixedTimeMs=lastFrameTimeMs;
  syncControlButtons();
  render(performance.now());
});
document.getElementById("btn-step-1s").addEventListener("click",function(){
  if(!frozenTime)return;
  fixedTimeMs+=1000;
  render(performance.now());
});
document.getElementById("btn-step-10s").addEventListener("click",function(){
  if(!frozenTime)return;
  fixedTimeMs+=10000;
  render(performance.now());
});
document.getElementById("btn-reset-time").addEventListener("click",function(){
  fixedTimeMs=0;
  if(!frozenTime)frozenTime=true;
  syncControlButtons();
  render(performance.now());
});
document.getElementById("preset-outer").addEventListener("click",function(){setPreset("outer");});
document.getElementById("preset-memory").addEventListener("click",function(){setPreset("memory");});
document.getElementById("preset-drift").addEventListener("click",function(){setPreset("drift");});
document.getElementById("btn-copy-summary").addEventListener("click",writeSnapshotSummary);

// Real data loading: embedded artifact data first, fetch fallback second.
if(window.__MIND_GALAXY_PREVIEW_DATA__){
  ingestRealData(window.__MIND_GALAXY_PREVIEW_DATA__,"embedded artifact");
}else{
  fetch("mind-galaxy-real-data.json").then(function(r){return r.json();}).then(function(d){ingestRealData(d,"fetch");}).catch(function(){
    setDataStatus("real:unavailable","warn");
    console.log("Real data not available (file:// may block fetch). Use fixture or open via local HTTP server.");
  });
}

// Start
centerPan();
syncControlButtons();
requestAnimationFrame(animLoop);
