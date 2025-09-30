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
    const names = lines.map(l=> l.replace(/^🏆 /,'').split('|')[0].trim());
    return `<div class="history-entry"><strong>${title}</strong><br>${names.join('<br>')}</div>`;
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
  normalized.Nombre = find('Nombre') || '';
  normalized.Categoria = find('Categoría') || find('Categoria') || '';
  normalized.Area = find('Área') || find('Area') || '';
  normalized.Asistencia = find('Asistencia') || '';
  return normalized;
}

function renderTable(filterText=''){
  const container = document.getElementById('tableContainer');
  if(!participants.length){ container.innerHTML = '<div class="empty">Cargue un CSV para ver participantes</div>'; updateStatus(); return; }
  const ft = filterText.trim().toLowerCase();
  const rows = participants.filter(p=>!ft || (p.Numero||'').toLowerCase().includes(ft) || (p.Nombre||'').toLowerCase().includes(ft) || (p.Categoria||'').toLowerCase().includes(ft) || (p.Area||'').toLowerCase().includes(ft));
  const html = ['<table><thead><tr><th>Numero</th><th>Nombre</th><th>Categoría</th><th>Área</th><th>Asistencia</th></tr></thead><tbody>'];
  for(const r of rows){ const isPrev = historySet.has(String(r.Numero));
    html.push(`<tr style="${isPrev? 'opacity:0.5':''}"><td>${r.Numero}</td><td>${r.Nombre}</td><td>${r.Categoria}</td><td>${r.Area}</td><td>${r.Asistencia}</td></tr>`);
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
    let counter = 3;
    const html = `
      <div class="lc-countdown">
        <div class="lc-label">Sorteando en...</div>
        <div class="lc-circle" id="lcCircle" aria-hidden="true">
          <div id="lcCounter" class="lc-number">3</div>
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
        const t = setInterval(()=>{
          counter--;
          if(counter >= 1){
            counterEl.textContent = String(counter);
          }
          if(counter < 1){
            clearInterval(t);
            Swal.close();
            resolve();
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
    <strong style="font-size:45px">#${i+1} ${w.Nombre}</strong>
    <div style="font-size:13px;opacity:0.85">${w.Categoria} - ${w.Area} - ${w.Asistencia}</div>
    </div>`).join('');

    await Swal.fire({
      title: '🎉 ¡Ganador' + (winners.length>1? 'es':'') + '! 🎉',
      html: `<div style="text-align:center">${html}</div>`,
      showCloseButton: true,
      confirmButtonText: 'Cerrar',
      width: 700,
      customClass: { popup: 'swal2-ios-like' }
    });

    drawCounter++;
    const line = `Sorteo ${drawCounter}:\n` + winners.map(w=>
      `🏆 ${w.Nombre} | ${w.Categoria} | ${w.Area} | ${w.Asistencia}`
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
