// WebGL neural artwork. All impulses are illustrative, not biometric signals.
(()=>{
const canvas=document.querySelector('#atmosphere'),button=document.querySelector('#motion'),media=matchMedia('(prefers-reduced-motion: reduce)');
let gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'}),running=!media.matches,raf=0,last=0,time=0,lost=false;
const fallback=()=>{canvas.style.background='radial-gradient(ellipse at 0% 30%,#25444888,transparent 65%),radial-gradient(ellipse at 100% 70%,#64423866,transparent 60%),#101217';button.textContent='Статичний фон';button.disabled=true};
if(!gl){fallback();return}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const vs=`precision mediump float;
attribute vec3 aStart;attribute vec3 aEnd;attribute vec4 aMeta;attribute vec2 aCorner;
uniform float uTime;uniform vec2 uResolution;
varying vec2 vUv;varying float vDepth;varying float vPhase;varying float vOrder;varying float vTint;
vec3 camera(vec3 p){float a=sin(uTime*.045)*.10; p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;p.x+=sin(uTime*.032)*.065;p.y+=cos(uTime*.04)*.035;return p;}
vec2 project(vec3 p){return p.xy/(p.z+3.6)*2.8;}
void main(){vec3 p=camera(aStart),q=camera(aEnd);vec2 pa=project(p),pb=project(q);float aspect=uResolution.x/uResolution.y;pa.x/=aspect;pb.x/=aspect;
vec2 d=(pb-pa)*uResolution;vec2 n=normalize(vec2(-d.y,d.x)+vec2(.00001));float z=mix(p.z,q.z,aCorner.x);float blur=smoothstep(.15,1.55,abs(z));float width=(aMeta.x*6.0+blur*15.0)/(z+3.6);
vec2 pos=mix(pa,pb,aCorner.x)+n*aCorner.y*width/uResolution*2.0;
gl_Position=vec4(pos,0.,1.);vUv=aCorner;vDepth=blur;vPhase=aMeta.y;vOrder=aMeta.z;vTint=aMeta.w;}`;
const fs=`precision mediump float;
varying vec2 vUv;varying float vDepth;varying float vPhase;varying float vOrder;varying float vTint;uniform float uTime;
void main(){float y=abs(vUv.y);float soft=exp(-y*y*5.5);float core=exp(-y*y*mix(170.,8.,vDepth));
float progress=mod(uTime*.19+vPhase,1.8);float signal=exp(-pow((progress-vOrder)*12.,2.));
vec3 color=mix(vec3(.25,.58,.59),vec3(.82,.42,.25),vTint);
vec3 light=mix(vec3(.66,.96,.91),vec3(1.,.79,.56),vTint);
float body=(.095*soft+.17*core)*(1.-vDepth*.48);float pulse=signal*(.22*soft+.67*core)*(1.-vDepth*.45);
gl_FragColor=vec4(color*body+light*pulse,1.);}`;
let prog,buffer,count;
function setup(){prog=program(vs,fs);let seed=12;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};const verts=[];
function segment(p,q,width,phase,order,tint){[[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]].forEach(c=>verts.push(...p,...q,width,phase,order,tint,...c))}
function branch(start,angle,length,z,depth,phase,tint,order){let end=[start[0]+Math.cos(angle)*length,start[1]+Math.sin(angle)*length,z+(random()-.5)*.3];const bend=(random()-.5)*length*.9,normal=[-Math.sin(angle),Math.cos(angle)];let prev=start;
for(let i=1;i<=12;i++){let u=i/12,p=[start[0]+(end[0]-start[0])*u+normal[0]*Math.sin(u*Math.PI)*bend,start[1]+(end[1]-start[1])*u+normal[1]*Math.sin(u*Math.PI)*bend,start[2]+(end[2]-start[2])*u];segment(prev,p,.4+depth*.35,phase,order+u*.11,tint);prev=p}
if(depth>0){branch(end,angle+.35+random()*.5,length*(.57+random()*.14),end[2],depth-1,phase,tint,order+.11);branch(end,angle-.35-random()*.6,length*(.55+random()*.16),end[2],depth-1,phase,tint,order+.11)}}
// Depth layers occupy the full viewport; peripheral trunks preserve central legibility.
[-1.5,-.4,.5,1.4].forEach((z,layer)=>{for(let i=0;i<4;i++){const side=i%2?1:-1;branch([side*(1.1+layer*.3),(i-1.5)*.88,z],side>0?Math.PI+(random()-.5):random()-.5,.9+layer*.15,z,4,random()*1.8,layer%2,0)}});
count=verts.length/12;buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);gl.useProgram(prog);
[['aStart',3,0],['aEnd',3,3],['aMeta',4,6],['aCorner',2,10]].forEach(([name,size,offset])=>{let loc=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,48,offset*4)});gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.clearColor(.038,.048,.061,1)}
function draw(){if(lost)return;gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(prog);gl.uniform1f(gl.getUniformLocation(prog,'uTime'),time);gl.uniform2f(gl.getUniformLocation(prog,'uResolution'),canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,count)}
function loop(now){raf=0;if(!running||document.hidden||lost)return;if(last&&now-last<33){raf=requestAnimationFrame(loop);return}time+=(last?Math.min((now-last)/1000,.1):0)*(document.body.dataset.quiet==='true'?.3:1);last=now;draw();raf=requestAnimationFrame(loop)}
function sync(){cancelAnimationFrame(raf);last=0;if(running&&!document.hidden&&!lost)raf=requestAnimationFrame(loop);else draw();button.textContent=running?'Зупинити фон':'Увімкнути фон';button.setAttribute('aria-pressed',String(!running))}
function resize(){const d=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*d);canvas.height=Math.round(innerHeight*d);gl.viewport(0,0,canvas.width,canvas.height);draw()}
try{setup();resize();sync()}catch(e){console.error('Ambient WebGL unavailable',e);fallback();return}
button.onclick=()=>{running=!running;sync()};media.addEventListener('change',e=>{running=!e.matches;sync()});document.addEventListener('visibilitychange',sync);addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf)});canvas.addEventListener('webglcontextrestored',()=>{lost=false;setup();resize();sync()});
})();
