(() => {
  const root = document.documentElement;
  const storage = {get(k){try{return localStorage.getItem('sun-ledger-'+k)}catch{return null}},set(k,v){try{localStorage.setItem('sun-ledger-'+k,v)}catch{}}};
  let size = Number(storage.get('size')) || 20;
  const theme = document.getElementById('theme-toggle');
  const smaller = document.getElementById('font-smaller'), larger = document.getElementById('font-larger');
  function applySize(){size=Math.max(17,Math.min(26,size));root.style.setProperty('--reading-size',size+'px');smaller.disabled=size<=17;larger.disabled=size>=26;storage.set('size',size)}
  root.dataset.theme = storage.get('theme') === 'dark' ? 'dark' : 'light';
  function labelTheme(){theme.textContent=root.dataset.theme==='dark'?'Day':'Night';theme.setAttribute('aria-label',root.dataset.theme==='dark'?'Use day reading theme':'Use night reading theme');theme.setAttribute('aria-pressed',String(root.dataset.theme==='dark'))}
  theme.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';storage.set('theme',root.dataset.theme);labelTheme()});
  smaller.addEventListener('click',()=>{size-=1;applySize()});larger.addEventListener('click',()=>{size+=1;applySize()});applySize();labelTheme();
  const sidebar=document.getElementById('contents'), menu=document.getElementById('menu-toggle');
  function closeMenu(){sidebar.classList.remove('open');menu.setAttribute('aria-expanded','false')}
  menu.addEventListener('click',()=>{const open=sidebar.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
  sidebar.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  document.addEventListener('click',e=>{if(!sidebar.contains(e.target)&&!menu.contains(e.target))closeMenu()});
  const chapters=[...document.querySelectorAll('section.chapter')], links=[...sidebar.querySelectorAll('a[data-section]')];
  const last=storage.get('chapter'), resume=document.getElementById('resume-link');
  if(last&&document.getElementById(last)&&!location.hash){resume.href='#'+last;resume.hidden=false}
  let queued=false;
  function update(){
    queued=false; const max=document.documentElement.scrollHeight-innerHeight;
    const ratio=max>0?Math.max(0,Math.min(1,scrollY/max)):0;
    document.getElementById('reading-progress').style.width=(ratio*100)+'%';
    let active=null;for(const section of chapters){if(section.getBoundingClientRect().top<innerHeight*.36)active=section;else break}
    for(const a of links){if(active&&a.dataset.section===active.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')}
    if(active)storage.set('chapter',active.id);
  }
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});
  addEventListener('resize',update);update();
})();
