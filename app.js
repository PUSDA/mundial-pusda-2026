const PLAYERS = ["Luis","Tere","Niko","Caro","Abraham","Samir","Pablo","Jorgito","Taty","Marty","Teo"];
const MATCHES = [
  {id:"r32-1", round:"16avos", a:"Ecuador", af:"🇪🇨", b:"Por confirmar", bf:"🏳️", date:"Por confirmar - Hora Ecuador"},
  {id:"r32-2", round:"16avos", a:"Brasil", af:"🇧🇷", b:"Japón", bf:"🇯🇵", date:"29 junio - Hora Ecuador"},
  {id:"r32-3", round:"16avos", a:"Alemania", af:"🇩🇪", b:"Por confirmar", bf:"🏳️", date:"29 junio - Hora Ecuador"},
  {id:"r32-4", round:"16avos", a:"Países Bajos", af:"🇳🇱", b:"Marruecos", bf:"🇲🇦", date:"29 junio - Hora Ecuador"},
  {id:"r32-5", round:"16avos", a:"México", af:"🇲🇽", b:"Por confirmar", bf:"🏳️", date:"30 junio - Hora Ecuador"},
  {id:"r32-6", round:"16avos", a:"Argentina", af:"🇦🇷", b:"Por confirmar", bf:"🏳️", date:"3 julio - Hora Ecuador"}
];
let client = null, votes = [], results = [];
function configured(){return window.SUPABASE_URL && !window.SUPABASE_URL.includes('PEGA_AQUI') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes('PEGA_AQUI')}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function init(){
  const sel=document.getElementById('playerSelect'); PLAYERS.forEach(p=>sel.innerHTML+=`<option value="${p}">${p}</option>`);
  sel.value=localStorage.getItem('player')||''; sel.onchange=()=>{localStorage.setItem('player',sel.value); render()};
  if(configured()){client=supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); loadRemote(); subscribe();}
  else{votes=JSON.parse(localStorage.getItem('votes')||'[]'); results=JSON.parse(localStorage.getItem('results')||'[]'); render(); toast('Modo prueba: falta conectar Supabase para votos compartidos')}
  document.getElementById('unlockAdmin').onclick=unlockAdmin;
}
async function loadRemote(){ const v=await client.from('votes').select('*'); const r=await client.from('results').select('*'); votes=v.data||[]; results=r.data||[]; render(); }
function subscribe(){ client.channel('votes-live').on('postgres_changes',{event:'*',schema:'public',table:'votes'},loadRemote).on('postgres_changes',{event:'*',schema:'public',table:'results'},loadRemote).subscribe(); }
function render(){renderMatches(); renderBoard();}
function renderMatches(){
  const player=document.getElementById('playerSelect').value; const box=document.getElementById('matches'); box.innerHTML='';
  MATCHES.forEach(m=>{const mine=votes.find(v=>v.match_id===m.id && v.player===player); const all=votes.filter(v=>v.match_id===m.id); const res=results.find(r=>r.match_id===m.id); const disabled=!player||mine||res; box.innerHTML+=`
    <div class="match ${mine?'locked':''}">
      <div class="date"><b>${m.round}</b> · ${m.date}</div>
      <div class="team"><div class="flag">${m.af}</div><h3>${m.a}</h3><button ${disabled?'disabled':''} onclick="vote('${m.id}','${m.a}')">Votar ${m.a}</button></div>
      <div class="vs">VS</div>
      <div class="team"><div class="flag">${m.bf}</div><h3>${m.b}</h3><button ${disabled?'disabled':''} onclick="vote('${m.id}','${m.b}')">Votar ${m.b}</button></div>
      ${mine?`<div class="winner">✅ ${player}, tu voto fue registrado: ${mine.pick}</div>`:''}
      ${res?`<div class="winner">🏆 Ganador real: ${res.winner}</div>`:''}
      <div class="votes"><b>Votos:</b> ${all.length?all.map(v=>`<span class="pill">${v.player}: ${v.pick}</span>`).join(''):'Aún no hay votos'}</div>
    </div>`});
}
async function vote(match_id,pick){
  const player=document.getElementById('playerSelect').value; if(!player){toast('Primero escoge tu nombre'); return;}
  if(votes.some(v=>v.match_id===match_id && v.player===player)){toast('Ya votaste este partido');return;}
  const row={match_id,player,pick,created_at:new Date().toISOString()};
  if(client){const {error}=await client.from('votes').insert(row); if(error){toast('No se pudo guardar: quizá ya votaste');return;} await loadRemote();}
  else{votes.push(row);localStorage.setItem('votes',JSON.stringify(votes));render();}
  toast('⚽ ¡GOOOOL! Voto registrado');
}
function renderBoard(){
  const scores=PLAYERS.map(p=>({p,pts:votes.filter(v=>results.some(r=>r.match_id===v.match_id && r.winner===v.pick)&&v.player===p).length})).sort((a,b)=>b.pts-a.pts||a.p.localeCompare(b.p));
  document.getElementById('leaderboard').innerHTML=scores.map((s,i)=>`<div class="row"><span><span class="rank">${i+1}.</span> ${medal(i)} ${s.p}</span><b>${s.pts} pts</b></div>`).join('');
}
function medal(i){return i===0?'🥇':i===1?'🥈':i===2?'🥉':'⚽'}
function unlockAdmin(){ if(document.getElementById('adminPass').value!==window.ADMIN_PASSWORD){toast('Clave incorrecta');return;} const p=document.getElementById('adminPanel');p.classList.remove('hidden'); p.innerHTML=MATCHES.map(m=>`<div class="adminMatch"><b>${m.a} vs ${m.b}</b><select id="win-${m.id}"><option value="">Sin resultado</option><option>${m.a}</option><option>${m.b}</option></select><button onclick="saveResult('${m.id}')">Guardar ganador</button></div>`).join(''); results.forEach(r=>{const el=document.getElementById('win-'+r.match_id); if(el)el.value=r.winner}); }
async function saveResult(match_id){ const winner=document.getElementById('win-'+match_id).value; if(!winner){toast('Escoge ganador');return;} const row={match_id,winner,updated_at:new Date().toISOString()}; if(client){await client.from('results').upsert(row); await loadRemote();} else{const i=results.findIndex(r=>r.match_id===match_id); if(i>=0)results[i]=row; else results.push(row); localStorage.setItem('results',JSON.stringify(results)); render();} toast('Resultado guardado'); }
init();
