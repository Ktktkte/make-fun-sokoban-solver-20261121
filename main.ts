import{readdirSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{join}from'node:path';
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
const DR=[-1,1,0,0],DC=[0,0,-1,1],CH='udlr',INF=1e9;
let W=0,H=0,N2=0,WA=new Set(),WK=new Set(),GL=[],BL=[],PS=0,GB=0;
const lt=(a,b)=>a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]);
class Hp{constructor(){this.a=[]}get n(){return this.a.length}
push(x){let a=this.a;a.push(x);let i=a.length-1;while(i>0){let p=(i-1)>>1;if(!lt(x,a[p]))break;a[i]=a[p];i=p;}a[i]=x;}
pop(){let a=this.a,t=a[0],x=a.pop();if(a.length){let i=0;for(;;){let l=2*i+1,r=l+1,m=i;if(l<a.length&&lt(a[l],x))m=l;if(r<a.length&&lt(a[r],m===i?x:a[m]))m=r;if(m===i)break;a[i]=a[m];i=m;}a[i]=x;}return t;}}
function nb(id,d){let r=(id/W)|0,c=id%W,nr=r+DR[d],nc=c+DC[d];if(nr<0||nc<0||nr>=H||nc>=W)return -1;let j=nr*W+nc;return WA.has(j)?-1:j;}
function bf(s,wk,oc){let p=new Map([[s,-1]]),q=[s];
for(let h=0;h<q.length;h++){let x=q[h];
for(let d=0;d<4;d++){let y=nb(x,d);
if(y<0||!wk.has(y)||(oc&&oc.has(y))||p.has(y))continue;
p.set(y,(x<<2)|d);q.push(y);}}
return p;}
function pth(p,s,t){if(!p.has(t))return null;let m='',c=t;
while(c!==s){let e=p.get(c);m=CH[e&3]+m;c=e>>2;}return m;}
function rgm(p){let m=INF;for(let k of p.keys())if(k<m)m=k;return m;}
function parse(t){let L=t.split('\n'),h=L.length,w=0;
for(let s of L)w=Math.max(w,s.replace(/\r$/,'').length);
W=w;H=h;N2=w*h;WA=new Set();WK=new Set();GL=[];BL=[];PS=0;
for(let r=0;r<h;r++){let s=L[r].replace(/\r$/,'');
for(let c=0;c<s.length;c++){let ch=s[c],id=r*w+c;
if(ch==='#')WA.add(id);else{WK.add(id);
if(ch==='.'||ch==='*')GL.push(id);
if(ch==='$'||ch==='*')BL.push(id);
if(ch==='@'||ch==='+')PS=id;}}}}
function aps(cs){let a=[],A=[...cs];
for(let v of A){let s=A.find(x=>x!==v);if(s===void 0)continue;
let p=bf(s,cs,new Set([v]));if(p.size<cs.size-1)a.push(v);}return a;}
function cmps(cs,v){let rem=new Set(cs);rem.delete(v);let o=[];
while(rem.size){let s=rem.values().next().value,p=bf(s,rem,null);
for(let x of p.keys())rem.delete(x);o.push(p);}return o;}
function decomp(){let rem=new Set(WK),rs=[];
for(;;){let best=null;
for(let d of aps(rem))for(let C of cmps(rem,d)){if(C.has(PS))continue;
let b=BL.filter(x=>C.has(x)||x===d),g=GL.filter(x=>C.has(x)||x===d);
if(b.length&&b.length===g.length&&C.size<=36&&(!best||C.size<best.C.size))best={C,d,b,g};}
if(!best)break;
let cl=new Set(best.C.keys());cl.add(best.d);
let ap=-1;for(let k=0;k<4;k++){let y=nb(best.d,k);if(y>=0&&!best.C.has(y)){ap=y;break;}}
rs.push({w:new Set([...cl,ap].filter(x=>x>=0)),x:cl,d:best.d,ap,b:best.b,g:best.g});
for(let x of best.C.keys())rem.delete(x);rem.delete(best.d);}
return rs;}
let DD=new Int32Array(0),DG=[],DW=new Set(),DX=new Set(),DE=new Set();
function dist0(){let m=DG.length;
DD=new Int32Array(m*N2).fill(-1);
for(let j=0;j<m;j++){let g=DG[j],dist=new Int32Array(N2*N2).fill(-1),hp=new Hp(),sq=1,fin=new Uint8Array(N2*N2);
for(let p of DW){if(p===g)continue;let s=g*N2+p;dist[s]=0;hp.push([0,sq++,s]);}
while(hp.n){let e=hp.pop(),k=e[0],st=e[2];if(fin[st])continue;fin[st]=1;
let b=(st/N2)|0,p=st%N2;
for(let d=0;d<4;d++){let q=nb(p,d);
if(q<0||!DW.has(q)||q===b)continue;
let s2=b*N2+q;if(dist[s2]<0||k<dist[s2]){dist[s2]=k;hp.push([k,sq++,s2]);}}
for(let d=0;d<4;d++){if(nb(p,d)!==b||!DX.has(p))continue;
let pp=nb(p,d^1);if(pp<0||!DW.has(pp))continue;
let s2=p*N2+pp;if(dist[s2]<0||k+1<dist[s2]){dist[s2]=k+1;hp.push([k+1,sq++,s2]);}}}
for(let c of DX){let v=INF;for(let p of DW){if(p===c)continue;let x=dist[c*N2+p];if(x>=0&&x<v)v=x;}
DD[j*N2+c]=v>=INF?-1:v;}}}
function asg(bx){if(bx.length>6){let s=0;
for(let b of bx){let m=INF;for(let j=0;j<DG.length;j++){let d=DD[j*N2+b];if(d>=0&&d<m)m=d;}
if(m>=INF)return INF;s+=m;}return s;}
let rc=(i,u)=>{if(i===bx.length)return 0;let m=INF;
for(let j=0;j<DG.length;j++)if(!(u>>j&1)){let d=DD[j*N2+bx[i]];
if(d>=0){let v=d+rc(i+1,u|1<<j);if(v<m)m=v;}}return m;};
return rc(0,0);}
function deadSet(){DE=new Set();
for(let c of DX){if(DG.includes(c))continue;
let ok=false;for(let j=0;j<DG.length;j++)if(DD[j*N2+c]>=0){ok=true;break;}
if(!ok)DE.add(c);}}
function frz(bx){let bs=new Set(bx);
for(let b of bx){let r=(b/W)|0,c=b%W;
for(let a=-1;a<=0;a++)for(let e=-1;e<=0;e++){
let rr=r+a,cc=c+e,all=true,hasG=false;
for(let i=0;i<2&&all;i++)for(let j=0;j<2;j++){
let R=rr+i,C=cc+j;
if(R<0||C<0||R>=H||C>=W)continue;
let x=R*W+C;
if(WA.has(x)||bs.has(x)){if(GL.includes(x))hasG=true;continue;}
all=false;break;}
if(all&&!hasG)return true;}}
return false;}
function astar(wk,bx,b0,g0,st,w,nx,ap){
DW=wk;DX=bx;DG=[...g0].sort((a,b)=>a-b);
dist0();deadSet();
let gs=new Set(DG),b1=[...b0].sort((a,b)=>a-b);
if(frz(b1))return null;
let h0=asg(b1);if(h0>=INF)return null;
let hp=new Hp(),seen=new Map(),sq=1,exp=0;
let k0=b1.join(',')+'|'+rgm(bf(st,wk,new Set(b1)));
seen.set(k0,0);
hp.push([w*h0,sq++,{b:b1,p:st,g:0,par:null,mv:'',k:k0}]);
while(hp.n){let nd=hp.pop()[2];
if(nd.g>seen.get(nd.k))continue;
if(nd.b.every(x=>gs.has(x))){
if(!nx)return nd;
if(bf(nd.p,wk,new Set(nd.b)).has(ap))return nd;
continue;}
if(++exp>150000||++GB>3000000)return null;
let oc=new Set(nd.b);
for(let i=0;i<nd.b.length;i++){let b=nd.b[i];
for(let d=0;d<4;d++){let t=nb(b,d);
if(t<0||!bx.has(t)||oc.has(t)||DE.has(t))continue;
let s=nb(b,d^1);
if(s<0||!wk.has(s)||oc.has(s))continue;
let wp=pth(bf(nd.p,wk,oc),nd.p,s);if(wp===null)continue;
let nb2=nd.b.slice();nb2[i]=t;nb2.sort((a,b)=>a-b);
if(frz(nb2))continue;
let h=asg(nb2);if(h>=INF)continue;
let g2=nd.g+1,k2=nb2.join(',')+'|'+rgm(bf(b,wk,new Set(nb2)));
let sv=seen.get(k2);if(sv!==void 0&&sv<=g2)continue;
seen.set(k2,g2);
hp.push([g2+w*h,sq++,{b:nb2,p:b,g:g2,par:nd,mv:wp+CH[d],k:k2}]);}}}
return null;}
function recon(nd){let s='',c=nd;while(c){s=c.mv+s;c=c.par;}return s;}
function sroom(r,last){let nx=!last;
return astar(r.w,r.x,r.b,r.g,r.ap,1,nx,r.ap)
||astar(r.w,r.x,r.b,r.g,r.ap,1.5,nx,r.ap)
||astar(r.w,r.x,r.b,r.g,r.ap,0,nx,r.ap);}
function solve(t){parse(t);
let rs=decomp();
rs.sort((a,b)=>((GL.includes(a.d)?1:0)-(GL.includes(b.d)?1:0))||(a.d-b.d));
let cov=new Set();for(let r of rs)for(let b of r.b)cov.add(b);
if(cov.size!==BL.length){
let nd=astar(WK,WK,BL,GL,PS,1,false,-1)
||astar(WK,WK,BL,GL,PS,1.5,false,-1)
||astar(WK,WK,BL,GL,PS,0,false,-1);
return nd?recon(nd):'';}
let mv='',cur=PS,cb=[...BL];
for(let i=0;i<rs.length;i++){let r=rs[i];
if(r.ap<0)return '';
let wp=pth(bf(cur,WK,new Set(cb)),cur,r.ap);if(wp===null)return '';
mv+=wp;cur=r.ap;
let nd=sroom(r,i===rs.length-1);if(!nd)return '';
mv+=recon(nd);cur=nd.p;
let rb=new Set(r.b);
cb=cb.filter(b=>!rb.has(b)).concat(r.g);}
return mv;}
for(let id of readdirSync(I).sort()){let mv='';
try{mv=solve(readFileSync(join(I,id,'level.txt'),'utf8'));}catch(e){mv='';}
mkdirSync(join(O,id),{recursive:true});
writeFileSync(join(O,id,'solution.txt'),mv+'\n');}
