const modelAnchors=new Set(['workspace','master-outlook','graph-details','graph','worked-paths','macro-scenario','payoff-summary','value-summary','inspector','matrix-details','score-editor','ranked','search']);
function followHash(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  if(!id)return;
  if(document.body.dataset.page==='summary'&&modelAnchors.has(id)){
    location.replace(new URL('./model.html'+location.hash,location.href));return;
  }
  const target=document.getElementById(id);if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  if(document.body.dataset.page==='essay')requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
}
followHash();
window.addEventListener('hashchange',followHash);
