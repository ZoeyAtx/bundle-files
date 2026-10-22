(()=>{
const D=document,$=(s,r=D)=>r.querySelector(s),A=(s,r=D)=>[...r.querySelectorAll(s)],N=(v,d=0)=>v===''||v==null?d:+v;
const H=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const F=n=>`${(n||0).toLocaleString('cs-CZ')} Kč`;
const K='zbBundlesV5',BEG='--- DÁRKOVÉ BALÍČKY ---',END='--- KONEC DÁRKOVÝCH BALÍČKŮ ---';
const DL=k=>{try{return typeof getShoptetDataLayer==='function'?getShoptetDataLayer(k):null}catch{return null}};
const LB=()=>{try{return(JSON.parse(localStorage.getItem(K)||'[]')).filter(x=>Date.now()-x.t<864e5)}catch{return[]}};
const SB=x=>localStorage.setItem(K,JSON.stringify(x)),CLR=()=>localStorage.removeItem(K);
const CQ=c=>{let a=DL('cart');if(!Array.isArray(a))return null;return a.filter(x=>x.code===c).reduce((s,x)=>s+N(x.quantity),0)};

function note(){
  let a=LB(),t=$('#remark');if(!a.length||!t)return;
  let esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp('\\n*'+esc(BEG)+'[\\s\\S]*?'+esc(END)+'\\n*','g');
  let own=t.value.replace(re,'').trim(),txt=a.map((b,i)=>`Balíček ${i+1}: ${b.type}\nKrabice: ${b.box} (${b.size}/${b.cap})\n${b.items.map(x=>`${x.q}× ${x.n}`).join('\n')}`).join('\n\n');
  t.value=(own?own+'\n\n':'')+BEG+'\n'+txt+'\n'+END;
}
function noteInit(){
  if(DL('pageType')==='thankYou'){CLR();return}let c=DL('cart');if(Array.isArray(c)&&!c.length)CLR();
  let f=()=>{let t=$('#remark'),a=LB();if(!t||!a.length)return;let ch=$('#add-note');if(ch&&!ch.checked)ch.click();note();let form=$('#order-form');if(form&&!form.dataset.zbn){form.dataset.zbn=1;form.addEventListener('submit',note,true)}};
  f();new MutationObserver(f).observe(D.body,{childList:true,subtree:true});D.addEventListener('ShoptetCartUpdated',()=>{let c=DL('cart');if(Array.isArray(c)&&!c.length)CLR()});
}

async function init(){
  let m=$('.bundle_menu'),l=$('.bundle-source-list');if(!m||!l||$('#zb'))return;
  let types=A('.bundle-type').map(e=>({id:e.dataset.id||e.dataset.name,n:e.dataset.name||e.dataset.id,min:e.dataset.min==null?null:N(e.dataset.min),max:e.dataset.max==null?null:N(e.dataset.max)}));
  if(!types.length)types=[{id:'all',n:m.dataset.bundleName||'Balíček',min:null,max:null}];let cur=types[0].id;
  let boxes=A('.bundle-box').map(e=>({n:e.dataset.name||'Krabice',cap:N(e.dataset.capacity),t:(e.dataset.types||'').split(',').map(x=>x.trim()).filter(Boolean)})).filter(e=>e.cap>0).sort((a,b)=>a.cap-b.cap);
  let rules=A('.bundle-rule').map(e=>({t:e.dataset.type||'',g:e.dataset.group||'',n:e.dataset.label||e.dataset.group||'',min:N(e.dataset.min),max:N(e.dataset.max,99)}));
  let combos=A('.bundle-combination').map(e=>({t:e.dataset.type||'',n:e.dataset.label||'',i:A('.bundle-combination-item',e).map(x=>({g:x.dataset.group||'',q:N(x.dataset.qty)})).filter(x=>x.g&&x.q>=0)})).filter(e=>e.i.length);
  let p=A('li',l).map(e=>({c:e.dataset.code||'',u:e.dataset.url||$('a',e)?.href||'',g:e.dataset.group||'x',t:(e.dataset.types||'').split(',').map(x=>x.trim()).filter(Boolean),sz:Math.max(.01,N(e.dataset.size,1)),n:e.dataset.name||e.textContent.trim(),i:e.dataset.image||'',p:e.dataset.price==null?null:N(e.dataset.price,null),stockExact:null,stockMin:null,stockText:'',out:false,q:0})).filter(e=>e.c||e.u);
  p.forEach((e,k)=>e.k=k);if(!p.length)return;if(!boxes.length)boxes=[{n:m.dataset.boxName||'Krabice',cap:N(m.dataset.capacity||m.dataset.max,99),t:[]}];

  let R=()=>rules.filter(e=>!e.t||e.t===cur),C=()=>combos.filter(e=>!e.t||e.t===cur),TY=()=>types.find(e=>e.id===cur),VIS=e=>!e.t.length||e.t.includes(cur);
  let T=()=>p.reduce((s,e)=>s+e.q,0),S=()=>p.reduce((s,e)=>s+e.q*e.sz,0),G=q=>p.filter(e=>e.g===q).reduce((s,e)=>s+e.q,0);
  let BS=()=>boxes.filter(e=>!e.t.length||e.t.includes(cur)),BX=s=>BS().find(e=>e.cap>=s)||null,VG=()=>[...new Set(p.filter(VIS).map(e=>e.g))];
  let CQTY=(c,g)=>c.i.find(x=>x.g===g)?.q||0,CM=c=>VG().every(g=>G(g)===CQTY(c,g));
  let MM=()=>{let y=TY(),cc=C(),r=R(),mn,mx;if(cc.length){let totals=cc.map(c=>c.i.reduce((s,x)=>s+x.q,0));mn=Math.min(...totals);mx=Math.max(...totals)}else{mn=r.reduce((s,e)=>s+e.min,0);mx=r.reduce((s,e)=>s+(e.max>=99?0:e.max),0)}mn=y.min??(m.dataset.min==null?mn:N(m.dataset.min));mx=y.max??(m.dataset.max==null?mx:N(m.dataset.max));if(!mx)mx=99;return[mn,mx]};
  let V=()=>{let t=T(),x=MM(),b=BX(S()),cc=C();return t>0&&t>=x[0]&&t<=x[1]&&!!b&&(cc.length?cc.some(CM):R().every(e=>G(e.g)>=e.min&&G(e.g)<=e.max))};

  async function load(e){
    if(!e.u)return;try{
      let d=new DOMParser().parseFromString(await(await fetch(e.u,{cache:'no-store'})).text(),'text/html'),M=s=>$(s,d)?.content||'';
      let av=($('.availability-label',d)?.textContent||'').replace(/\s+/g,' ').trim(),avLow=av.toLowerCase(),amount=($('.availability-amount',d)?.textContent||'').replace(/\s+/g,' ').trim();
      let inp=$('input.amount[name="amount"]',d),btn=$('button[data-testid="buttonAddToCart"],button.add-to-cart-button',d);
      e.c=e.c||M('meta[itemprop="sku"]');e.n=e.n||$('h1',d)?.textContent.trim()||M('meta[property="og:title"]');e.i=e.i||M('meta[property="og:image"]');e.p=e.p??N(M('meta[property="product:price:amount"]'),null);
      e.out=/vyprod|není skladem|nedostup|out of stock|unavailable/.test(avLow)||!!btn?.disabled;e.stockExact=e.stockMin=null;e.stockText='';
      if(e.out){e.stockExact=0;e.stockMin=0;e.stockText='Vyprodáno';return}let raw=(av+' '+amount).replace(/\u00a0/g,' '),gt=raw.match(/>\s*(\d+)/),exact=amount.match(/(\d+)/);
      if(gt){let n=N(gt[1]);e.stockMin=n+1;e.stockText=`> ${n} ks`}else if(exact){let n=N(exact[1]);e.stockExact=n;e.stockMin=n;e.stockText=`${n} ks`}else if(inp?.dataset.max&&N(inp.dataset.max)>0){let n=N(inp.dataset.max);e.stockExact=n;e.stockMin=n;e.stockText=`${n} ks`}else if(/skladem|in stock/.test(avLow))e.stockText='Skladem';
    }catch{e.stockExact=e.stockMin=null;e.stockText=''}
  }

  m.hidden=l.hidden=true;D.body.classList.add('zb-on');let b=D.createElement('section');b.id='zb';
  b.innerHTML=`<header><b>${H(m.dataset.title||'Vyberte produkty do balíčku')}</b><small class="zd"></small></header>${types.length>1?`<nav class="zy">${types.map(e=>`<button type="button" data-t="${H(e.id)}">${H(e.n)}</button>`).join('')}</nav>`:''}<main><div class="zp">Načítám…</div><aside><b>Váš balíček</b><div class="zbinfo"></div><i><u></u></i><small class="zc"></small><div class="zr"></div><div class="zs"></div><strong class="zt">0 Kč</strong><button type="button" disabled>${H(m.dataset.buttonText||'Přidat do košíku')}</button><em></em></aside></main>`;
  ($('.p-info-wrapper')||m.parentElement).append(b);await Promise.all(p.map(load));let g=$('.zp',b);
  g.innerHTML=p.map(e=>`<article data-k="${e.k}">${e.i?`<img src="${H(e.i)}">`:''}<div><a ${e.u?`href="${H(e.u)}" target="_blank"`:''}>${H(e.n||e.c)}</a><small class="stock"></small><strong>${e.p==null?'Cena dle e-shopu':F(e.p)}</strong><span><button type="button" class="m" disabled>−</button><b>0</b><button type="button" class="a">+</button></span></div></article>`).join('');

  function remaining(e){let inCart=CQ(e.c);if(inCart==null)inCart=0;return e.stockExact==null?null:Math.max(0,e.stockExact-inCart)}
  function can(e){
    if(!VIS(e)||!e.c||e.out)return false;let rem=remaining(e);if(rem!=null&&e.q>=rem)return false;let x=MM()[1];if(T()>=x)return false;
    let cc=C();if(cc.length){let groups=VG();if(!cc.some(c=>groups.every(g=>G(g)+(g===e.g?1:0)<=CQTY(c,g))))return false}else{let rr=R().find(r=>r.g===e.g);if(rr&&G(e.g)>=rr.max)return false}
    let bs=BS(),cap=bs.length?bs[bs.length-1].cap:0;return S()+e.sz<=cap;
  }
  function comboLabel(c){return c.n||c.i.map(x=>`${x.q}× ${x.g}`).join(' + ')}
  function U(){
    let t=T(),s=S(),mm=MM(),box=BX(s),sel=p.filter(e=>e.q),cap=box?.cap||BS().at(-1)?.cap||1,cc=C();
    $('.zd',b).textContent=m.dataset.description||`Vyberte ${cc.length>1?'jednu z povolených kombinací':mm[0]===mm[1]?'přesně '+mm[1]:mm[0]+'–'+mm[1]+' položek'}.`;
    A('.zy button',b).forEach(q=>q.classList.toggle('on',q.dataset.t===cur));A('article',g).forEach(c=>{let e=p[+c.dataset.k],v=VIS(e);c.hidden=!v;c.classList.toggle('on',!!e.q);c.classList.toggle('out',e.out);$('span b',c).textContent=e.q;$('.m',c).disabled=!e.q;$('.a',c).disabled=!can(e);$('.stock',c).textContent=e.out?'Vyprodáno':e.stockText?`Skladem: ${e.stockText}`:''});
    $('.zbinfo',b).innerHTML=s?`<small>Krabice <b>${H(box?.n||'Příliš velké')}</b></small><small>Využití <b>${s}/${box?.cap||'—'}</b></small>`:'<small>Krabice <b>—</b></small>';
    $('.zc',b).textContent=`${t} položek`;$('aside i u',b).style.width=`${Math.min(100,s/cap*100)}%`;
    $('.zr',b).innerHTML=cc.length?cc.map(c=>`<small class="${CM(c)?'ok':''}">${H(comboLabel(c))}<b>${CM(c)?'✓':''}</b></small>`).join(''):R().map(e=>{let n=G(e.g);return`<small class="${n>=e.min&&n<=e.max?'ok':''}">${H(e.n)} <b>${n}/${e.min===e.max?e.min:e.min+'–'+e.max}</b></small>`}).join('');
    $('.zs',b).innerHTML=sel.map(e=>`<small>${e.q}× ${H(e.n||e.c)}<b>${e.p==null?'':F(e.p*e.q)}</b></small>`).join('');$('.zt',b).textContent=F(sel.reduce((a,e)=>a+(e.p||0)*e.q,0));$('aside>button',b).disabled=!V();
  }

  $('.zy',b)?.addEventListener('click',e=>{let q=e.target.closest('button[data-t]');if(!q||q.dataset.t===cur)return;p.forEach(x=>x.q=0);cur=q.dataset.t;U()});
  g.onclick=e=>{let q=e.target.closest('.a,.m');if(!q)return;e.preventDefault();e.stopPropagation();let v=p[+q.closest('article').dataset.k];if(q.classList.contains('a')){if(can(v))v.q++}else if(v.q)v.q--;U()};
  const ADD=e=>new Promise((ok,no)=>{let before=CQ(e.c),done=0,timer,finish=()=>{if(done)return;done=1;clearTimeout(timer);D.removeEventListener('ShoptetCartUpdated',hit);let after=CQ(e.c);before==null||after==null||after>=before+e.q?ok():no()};let hit=()=>setTimeout(finish,80);D.addEventListener('ShoptetCartUpdated',hit);timer=setTimeout(finish,3500);try{shoptet.cartShared.addToCart({productCode:e.c,amount:e.q},true)}catch(x){done=1;clearTimeout(timer);D.removeEventListener('ShoptetCartUpdated',hit);no(x)}});
  $('aside>button',b).onclick=async e=>{e.preventDefault();e.stopPropagation();let q=e.currentTarget,n=$('aside>em',b),sel=p.filter(x=>x.q);q.disabled=true;n.textContent='Kontroluji sklad…';await Promise.all(sel.map(load));let bad=sel.find(x=>x.out||(x.stockExact!=null&&x.q+(CQ(x.c)||0)>x.stockExact));if(bad){n.textContent=`Nedostatečný sklad: ${bad.n}`;U();return}let box=BX(S());if(!box){n.textContent='Obsah se nevejde do žádné krabice.';U();return}n.textContent='Přidávám…';try{for(let x of sel)await ADD(x);let a=LB();a.push({t:Date.now(),type:TY().n,box:box.n,size:S(),cap:box.cap,items:sel.map(x=>({c:x.c,n:x.n||x.c,q:x.q}))});SB(a);note();n.textContent='Balíček přidán do košíku.';p.forEach(x=>x.q=0);U()}catch{n.textContent='Část balíčku se nepodařilo přidat. Zkontrolujte košík.';U()}};
  U();
}
let START=()=>{noteInit();init()};D.readyState==='loading'?D.addEventListener('DOMContentLoaded',START):START();
})();