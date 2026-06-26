const PLAYERS = ["Luis","Tere","Niko","Caro","Abraham","Samir","Pablo","Jorgito","Taty","Marty","Teo"];
const DEFAULT_MATCHES = [
 {id:"r32-1",round:"16avos",teamA:"Ecuador",flagA:"🇪🇨",teamB:"Rival por confirmar",flagB:"🌎",date:"2026-06-28T15:00:00-05:00",winner:""},
 {id:"r32-2",round:"16avos",teamA:"Brasil",flagA:"🇧🇷",teamB:"Japón",flagB:"🇯🇵",date:"2026-06-29T12:00:00-05:00",winner:""},
 {id:"r32-3",round:"16avos",teamA:"Alemania",flagA:"🇩🇪",teamB:"Por confirmar",flagB:"🌎",date:"2026-06-29T15:30:00-05:00",winner:""},
 {id:"r32-4",round:"16avos",teamA:"Países Bajos",flagA:"🇳🇱",teamB:"Marruecos",flagB:"🇲🇦",date:"2026-06-29T20:00:00-05:00",winner:""}
];
let state = { player:null, matches:[], votes:[] };
let supabaseClient = null;
let deferredPrompt = null;
const $ = id => document.getElementById(id);

function initSupabase(){
 const cfg = window.MUNDIAL_CONFIG || {};
 if(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase){
  supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  $('syncStatus').textContent = 'En línea';
 }
}
async function loadState(){
 state.player = localStorage.getItem('mundial_player');
 if(supabaseClient){
  const {data: matches} = await supabaseClient.from('matches').select('*').order('date');
  const {data: votes} = await supabaseClient.from('votes').select('*').order('created_at');
  if(matches && matches.length) state.matches = matches; else await seedMatches();
  state.votes = votes || [];
  supabaseClient.channel('public-db').on('postgres_changes',{event:'*',schema:'public',table:'votes'},loadState).on('postgres_changes',{event:'*',schema:'public',table:'matches'},loadState).subscribe();
 } else {
  state.matches = JSON.parse(localStorage.getItem('mundial_matches') || 'null') || DEFAULT_MATCHES;
  state.votes = JSON.parse(localStorage.getItem('mundial_votes') || '[]');
 }
 render();
}
async function seedMatches(){
 if(!supabaseClient) return;
 await supabaseClient.from('matches').insert(DEFAULT_MATCHES.map(m=>({id:m.id,round:m.round,teamA:m.teamA,flagA:m.flagA,teamB:m.teamB,flagB:m.flagB,date:m.date,winner:m.winner})));
 const {data} = await supabaseClient.from('matches').select('*').order('date');
 state.matches = data || DEFAULT_MATCHES;
}
function saveLocal(){ localStorage.setItem('mundial_matches',JSON.stringify(state.matches)); localStorage.setItem('mundial_votes',JSON.stringify(state.votes)); }
function render(){ renderPlayers(); renderGameArea(); renderMatches(); renderRanking(); renderHistory(); renderAdmin(); }
function renderPlayers(){
 $('playersGrid').innerHTML = PLAYERS.map(p=>`<button class="player-btn" onclick="selectPlayer('${p}')">${avatar(p)} ${p}</button>`).join('');
}
function renderGameArea(){
 if(state.player){ $('loginCard').classList.add('hidden'); $('gameArea').classList.remove('hidden'); $('currentPlayerLabel').textContent = `${avatar(state.player)} ${state.player}`; }
 else { $('loginCard').classList.remove('hidden'); $('gameArea').classList.add('hidden'); }
}
window.selectPlayer = function(p){ state.player=p; localStorage.setItem('mundial_player',p); toast(`Bienvenido/a ${p} ⚽`); render(); }
function avatar(p){ return {Luis:'👨',Tere:'👩',Niko:'🧑',Caro:'👩',Abraham:'👨',Samir:'👦',Pablo:'👨',Jorgito:'👨',Taty:'👩',Marty:'👩',Teo:'👦'}[p]||'👤'; }
function renderMatches(){
 $('matchesList').innerHTML = state.matches.map(m=>{
  const myVote = state.votes.find(v=>v.match_id===m.id && v.player===state.player);
  const voters = state.votes.filter(v=>v.match_id===m.id);
  const date = new Date(m.date).toLocaleString('es-EC',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  return `<article class="card match-card ${m.winner?'winner':''}">
    <div class="match-head"><strong>${m.round}</strong><span>🇪🇨 ${date}</span></div>
    <div class="teams">
      <div class="team-row"><span class="team-name"><span class="flag">${m.flagA}</span>${m.teamA}</span>${m.winner===m.teamA?'🏆':''}</div>
      <div class="team-row"><span class="team-name"><span class="flag">${m.flagB}</span>${m.teamB}</span>${m.winner===m.teamB?'🏆':''}</div>
    </div>
    ${myVote?`<div class="locked">🔒 Tu voto: <b>${myVote.pick}</b>. Ya no se puede cambiar.</div>`:`<div class="vote-actions"><button class="vote-btn" onclick="vote('${m.id}','${escapeAttr(m.teamA)}')">Votar ${m.flagA}</button><button class="vote-btn" onclick="vote('${m.id}','${escapeAttr(m.teamB)}')">Votar ${m.flagB}</button></div>`}
    <div class="voters">${voters.map(v=>`<span class="voter-chip">${avatar(v.player)} ${v.player}: ${v.pick}</span>`).join('') || '<span class="muted">Sin votos todavía</span>'}</div>
  </article>`;
 }).join('');
}
function escapeAttr(s){return String(s).replaceAll("'","&#39;")}
window.vote = async function(matchId,pick){
 if(!state.player) return toast('Primero escoge tu nombre');
 if(state.votes.some(v=>v.match_id===matchId && v.player===state.player)) return toast('Tu voto ya está bloqueado 🔒');
 const vote = {match_id:matchId,player:state.player,pick,created_at:new Date().toISOString()};
 if(supabaseClient){
  const {error}= await supabaseClient.from('votes').insert(vote);
  if(error) return toast('No se pudo guardar: '+error.message);
  await loadState();
 } else { state.votes.push(vote); saveLocal(); render(); }
 toast('⚽ ¡GOOOOL! Voto registrado');
}
function scores(){
 const s = Object.fromEntries(PLAYERS.map(p=>[p,0]));
 state.matches.forEach(m=>{ if(!m.winner) return; state.votes.filter(v=>v.match_id===m.id && v.pick===m.winner).forEach(v=>s[v.player]++); });
 return Object.entries(s).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
}
function renderRanking(){
 const list = scores();
 $('podium').innerHTML = list.slice(0,3).map((r,i)=>`<div class="podium-place"><div style="font-size:32px">${['🥇','🥈','🥉'][i]}</div><h3>${r[0]}</h3><b>${r[1]} pts</b></div>`).join('');
 $('rankingList').innerHTML = list.map((r,i)=>`<div class="rank-row"><b>${i+1}</b><span>${avatar(r[0])} ${r[0]}</span><b>${r[1]} pts</b></div>`).join('');
}
function renderHistory(){
 $('votesHistory').innerHTML = state.votes.map(v=>{ const m=state.matches.find(x=>x.id===v.match_id); return `<div class="history-item"><b>${avatar(v.player)} ${v.player}</b> votó por <b>${v.pick}</b><br><span class="muted">${m?m.teamA+' vs '+m.teamB:''}</span></div>`; }).join('') || '<p class="muted">Todavía no hay votos.</p>';
}
function renderAdmin(){
 $('adminMatches').innerHTML = state.matches.map(m=>`<div class="admin-match"><b>${m.teamA} vs ${m.teamB}</b><button onclick="setWinner('${m.id}','${escapeAttr(m.teamA)}')">Ganó ${m.teamA}</button><button onclick="setWinner('${m.id}','${escapeAttr(m.teamB)}')">Ganó ${m.teamB}</button></div>`).join('');
}
window.setWinner = async function(id,winner){
 const match = state.matches.find(m=>m.id===id); if(!match) return;
 match.winner = winner;
 if(supabaseClient){ await supabaseClient.from('matches').update({winner}).eq('id',id); await loadState(); } else { saveLocal(); render(); }
 toast('Resultado actualizado 🏆');
}
function setupEvents(){
 document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $(t.dataset.tab).classList.add('active');}));
 $('changePlayerBtn').onclick=()=>{localStorage.removeItem('mundial_player'); state.player=null; render();};
 $('copyLinkBtn').onclick=async()=>{await navigator.clipboard.writeText(location.href); toast('Link copiado 📲');};
 $('unlockAdminBtn').onclick=()=>{ if($('adminPin').value === (window.MUNDIAL_CONFIG.ADMIN_PIN||'2026')) {$('adminPanel').classList.remove('hidden'); toast('Admin activado 👑')} else toast('Clave incorrecta'); };
 $('addMatchBtn').onclick=addMatch;
 $('resetBtn').onclick=resetAll;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; $('installBtn').classList.remove('hidden');});
 $('installBtn').onclick=()=>deferredPrompt&&deferredPrompt.prompt();
}
async function addMatch(){
 const m={id:'m-'+Date.now(),round:$('newRound').value||'Nueva ronda',teamA:$('newTeamA').value,flagA:$('newFlagA').value||'🌎',teamB:$('newTeamB').value,flagB:$('newFlagB').value||'🌎',date:$('newDate').value?new Date($('newDate').value).toISOString():'2026-06-28T15:00:00-05:00',winner:''};
 if(!m.teamA||!m.teamB) return toast('Completa los equipos');
 if(supabaseClient){ await supabaseClient.from('matches').insert(m); await loadState(); } else { state.matches.push(m); saveLocal(); render(); }
 toast('Partido agregado ⚽');
}
async function resetAll(){
 if(!confirm('¿Seguro que deseas reiniciar votos y partidos?')) return;
 if(supabaseClient){ await supabaseClient.from('votes').delete().neq('id','00000000-0000-0000-0000-000000000000'); await supabaseClient.from('matches').delete().neq('id',''); await seedMatches(); await loadState(); }
 else { state.matches=DEFAULT_MATCHES; state.votes=[]; saveLocal(); render(); }
 toast('Torneo reiniciado');
}
function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),2600); }
if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
initSupabase(); setupEvents(); loadState();
