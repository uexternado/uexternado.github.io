let participants = [];
let historySet = new Set();
const STORAGE_KEY = 'sorteador_history_ids_v1';
const HISTORY_FILE_KEY = 'sorteador_winners_log_v1';
let drawCounter = 0;

function loadHistory(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){ try{ const arr = JSON.parse(raw); arr.forEach(x=>historySet.add(String(x))); }catch(e){} }
  const logRaw = localStorage.getItem(HISTORY_FILE_KEY) || '';
  drawCounter = (logRaw.match(/Sorteo /g) || []).length;
  renderHistory(logRaw);
  updateStatus();
}

function renderHistory(logRaw){
  const panel = document.getElementById('historyPanel');
  if(!logRaw){
    panel.innerHTML = '<div class="history-empty">Aún no hay sorteos registrados</div>';
    return;
  }
  const blocks = logRaw.trim().split(/-+\n/).filter(Boolean);
  panel.innerHTML = blocks.map(b=>{
    const lines = b.trim().split('\n');
    const title = lines.shift();
    return `<div class="history-entry"><strong>${title}</strong><br>${lines.join('<br>')}</div>`;
  }).join('');
}

function saveHistory(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(historySet))); }
function updateStatus(){
  document.getElementById('status').textContent = participants.length ? `${participants.length} participantes cargados` : 'Sin archivo cargado';
  document.getElementById('countInfo').textContent = `${participants.length} participantes — ${historySet.size} ganadores previos`;
}

function parseCSVFile(file){
  return new Promise((resolve,reject)=>{ Papa.parse(file,{header:true,skipEmptyLines:true,complete:(res)=>{resolve(res.data);},error:reject}); });
}
function normalizeRow(row){
  const mapKey = k=>k?k.trim().toLowerCase():''; 
  const normalized = {};
  const keys = Object.keys(row);
  const find = name => { const target = name.toLowerCase(); for(const k of keys){ if(mapKey(k)===target) return row[k]; } for(const k of keys){ if(mapKey(k).includes(target)) return row[k]; } return ''; };
  normalized.Numero = String(find('Numero') || find('id')|| find('numero'));
  normalized.Nombres = find('Nombres') || '';
  normalized.Apellidos = find('Apellidos') || '';
  normalized.Correo = find('Correo') || find('Email') || '';
  normalized.Telefono = find('Telefono') || find('Phone') || '';
  return normalized;
}
function censorPhone(phone){
  if(!phone) return '';
  const s = String(phone).trim();
  if(!s) return '';
  const maxKeep = 4;
  const keep = Math.max(1, Math.min(maxKeep, Math.floor(s.length/2)));
  return s.slice(0,keep) + '...';
}
function renderTable(filterText=''){
  const container = document.getElementById('tableContainer');
  if(!participants.length){ container.innerHTML = '<div class="empty">Cargue un CSV para ver participantes</div>'; updateStatus(); return; }
  const ft = filterText.trim().toLowerCase();
  const rows = participants.filter(p=>!ft || (p.Numero||'').toLowerCase().includes(ft) || (p.Nombres||'').toLowerCase().includes(ft) || (p.Apellidos||'').toLowerCase().includes(ft) || (p.Correo||'').toLowerCase().includes(ft));
  const html = ['<table><thead><tr><th>Numero</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Telefono</th></tr></thead><tbody>'];
  for(const r of rows){ const isPrev = historySet.has(String(r.Numero)); 
    const censEmail = r.Correo;
    const censPhone = censorPhone(r.Telefono);
    html.push(`<tr style="${isPrev? 'opacity:0.5':''}"><td>${r.Numero}</td><td>${r.Nombres}</td><td>${r.Apellidos}</td><td>${censEmail}</td><td>${censPhone}</td></tr>`); 
  }
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
  updateStatus();
}
function pickWinners(count, excludeHistory){
  const pool = participants.filter(p=>p.Numero && (!excludeHistory || !historySet.has(String(p.Numero))));
  if(count > pool.length) throw new Error(`No hay suficientes participantes disponibles`);
  const arr = pool.slice();
  for(let i=arr.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr.slice(0,count);
}

function showCountdown(){
  return new Promise((resolve)=>{
    let counter = 5;
    const html = `
      <div class="lc-countdown">
        <div class="lc-label">Sorteando en...</div>
        <div class="lc-circle" id="lcCircle" aria-hidden="true">
          <div id="lcCounter" class="lc-number">5</div>
          <div class="lc-orb" style="left:18%;top:20%;width:10px;height:10px;opacity:0.9"></div>
          <div class="lc-orb" style="left:82%;top:28%;width:14px;height:14px;opacity:0.8"></div>
          <div class="lc-orb" style="left:70%;top:72%;width:8px;height:8px;opacity:0.7"></div>
        </div>
      </div>
    `;
    Swal.fire({
      title: '',
      html,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const counterEl = document.getElementById('lcCounter');
        const circle = document.getElementById('lcCircle');
        counterEl.classList.add('lc-animate','lc-glow');
        const t = setInterval(()=>{
          counter--;
          if(counter >= 1){
            counterEl.classList.remove('lc-animate');
            void counterEl.offsetWidth;
            counterEl.textContent = String(counter);
            counterEl.classList.add('lc-animate');
            circle.classList.remove('lc-glow');
            void circle.offsetWidth;
            circle.classList.add('lc-glow');
          }
          if(counter < 1){
            clearInterval(t);
            circle.style.transition = 'transform 220ms ease';
            circle.style.transform = 'scale(1.06)';
            setTimeout(()=> {
              circle.style.transform = 'scale(1)';
              Swal.close();
              resolve();
            }, 220);
          }
        }, 1000);
      },
      customClass:{ popup:'swal2-ios-like' }
    });
  });
}

async function performDraw(){
  const count = Math.max(1, parseInt(document.getElementById('winnersCount').value||1));
  const excludeHistory = document.getElementById('excludeHistory').checked;
  try{
    const winners = pickWinners(count, excludeHistory);
    await showCountdown();

    winners.forEach(w=>historySet.add(String(w.Numero)));
    saveHistory();
    renderTable(document.getElementById('search').value);

    confetti({particleCount: 120, spread: 140, origin: { y: 0.6 }});
    const html = winners.map((w,i)=>`<div style="margin:8px 0">
    <strong style="font-size:16px">#${i+1} ${w.Nombres} ${w.Apellidos}</strong>
    <div style="font-size:13px;opacity:0.85">${w.Correo}</div>
    </div>`).join('');

    await Swal.fire({
      title: '🎉 ¡Ganador' + (winners.length>1? 'es':'') + '! 🎉',
      html: `<div style="text-align:left">${html}</div>`,
      showCloseButton: true,
      confirmButtonText: 'Cerrar',
      width: 700,
      customClass: { popup: 'swal2-ios-like' }
    });

    drawCounter++;
    const line = `Sorteo ${drawCounter}:\n` + winners.map(w=>
      `🏆 ${w.Nombres} ${w.Apellidos}`
    ).join('\n') + `\n--------------------------------------\n`;

    let prevLog = localStorage.getItem(HISTORY_FILE_KEY) || '';
    prevLog += line;
    localStorage.setItem(HISTORY_FILE_KEY, prevLog);
    renderHistory(prevLog);

  }catch(e){ Swal.fire({icon:'error',title:'Error',text:e.message,customClass:{popup:'swal2-ios-like'}}); }
}

function downloadHistory(){
  const log = localStorage.getItem(HISTORY_FILE_KEY) || '';
  if(!log){ 
    Swal.fire({ icon:'info', title:'Historial vacío', text:'Aún no hay sorteos registrados', customClass:{ popup:'swal2-ios-like' }}); 
    return; 
  }
  const blob = new Blob([log], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "winners.txt";
  a.click();
  URL.revokeObjectURL(a.href);

  Swal.fire({ icon:'success', title:'Descarga lista', text:'El historial se descargó correctamente', customClass:{ popup:'swal2-ios-like' } });
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_FILE_KEY);
  historySet.clear();
  drawCounter = 0;
  updateStatus();
  renderHistory('');
  Swal.fire({ icon:'success', title:'Historial borrado', text:'El historial de ganadores ha sido eliminado', customClass:{ popup:'swal2-ios-like' } });
  renderTable();
}

document.getElementById('csvfile').addEventListener('change', async (e)=>{ const f = e.target.files[0]; if(!f) return; const data = await parseCSVFile(f); participants = data.map(normalizeRow).filter(r=>r.Numero); renderTable(); Swal.fire({position:'top-end',icon:'success',title:`CSV cargado: ${participants.length} registros`,showConfirmButton:false,timer:1600,toast:true,customClass:{ popup:'swal2-ios-like' }}); });
document.getElementById('drawBtn').addEventListener('click', performDraw);
document.getElementById('search').addEventListener('input', (e)=> renderTable(e.target.value));
document.getElementById('downloadHistoryBtn').addEventListener('click', downloadHistory);
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

loadHistory(); renderTable();