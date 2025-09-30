/* ===== Restricciones de entrada: nombre y teléfono ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Solo letras (con acentos y ñ) y espacios
  ['cliente','c-nombre'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const okChar = /^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ ]$/;
    const clean = v => v.normalize('NFC').replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ ]/g, '');
    el.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const nav = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter'];
      if (nav.includes(e.key)) return;
      if (e.key.length === 1 && !okChar.test(e.key)) e.preventDefault();
    });
    el.addEventListener('input', () => {
      const v = clean(el.value);
      if (v !== el.value) el.value = v;
    });
  });

  // Teléfono: solo dígitos, máx 10
  const tel = document.getElementById('telefono');
  if (tel){
    tel.addEventListener('input', () => {
      tel.value = tel.value.replace(/\D/g,'').slice(0,10);
    });
    tel.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const nav = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter'];
      if (nav.includes(e.key)) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    });
  }
});

/* ===== Utilidades ===== */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ===================== CITAS (localStorage) ===================== */
const APPT_KEY = 'dcury_citas_v1';
const apptForm = $('#appt-form'), apptList = $('#appt-list'), apptMsg = $('#appt-msg');
const apptFecha = $('#fecha');

function todayLocalISO(){
  const tz = new Date().getTimezoneOffset()*60000;
  return new Date(Date.now()-tz).toISOString().slice(0,16);
}
if (apptFecha) apptFecha.min = todayLocalISO();

function aLoad(){ try { return JSON.parse(localStorage.getItem(APPT_KEY))||[] } catch { return [] } }
function aSave(v){ localStorage.setItem(APPT_KEY, JSON.stringify(v)) }
function aRender(){
  const arr = aLoad().sort((a,b)=> new Date(a.fecha)-new Date(b.fecha));
  apptList.innerHTML = '';
  if(!arr.length){ apptList.innerHTML = '<p class="small">No hay citas registradas.</p>'; return; }
  const now = new Date();
  arr.forEach(a=>{
    const start = new Date(a.fecha);
    const soon = (start - now) < 1000*60*60*24 ? 'warn' : 'ok';
    const el = document.createElement('div');
    el.className = 'appt';
    el.innerHTML = `
      <div>
        <h4>${a.cliente} <span class="badge ${soon}">${start.toLocaleString()}</span></h4>
        <p class="small"><strong>Servicio:</strong> ${a.servicio} · <strong>Duración:</strong> ${a.duracion} min · <strong>Profesional:</strong> ${a.stylist}</p>
        ${a.telefono ? `<p class="small"><strong>Tel:</strong> ${a.telefono}</p>` : ''}
        ${a.notas ? `<p class="small"><strong>Notas:</strong> ${a.notas}</p>` : ''}
      </div>
      <div><button class="btn danger" data-cancel="${a.id}">Cancelar</button></div>
    `;
    apptList.appendChild(el);
  });
}
function aNotify(txt, ok=true){ apptMsg.textContent=txt; apptMsg.style.color= ok?'var(--ok)':'var(--danger)'; setTimeout(()=>apptMsg.textContent='',3000); }

if (apptForm){
  apptForm.addEventListener('submit', e=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(apptForm).entries());
    if(!d.cliente || !/^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ ]+$/.test(d.cliente)){ aNotify('El nombre solo admite letras y espacios.', false); return; }
    if(!d.telefono || !/^\d{10}$/.test(d.telefono)){ aNotify('El teléfono debe tener 10 dígitos.', false); return; }
    if(!d.servicio || !d.fecha || !d.duracion || !d.stylist){ aNotify('Completa los campos obligatorios.', false); return; }
    if(new Date(d.fecha) < new Date()){ aNotify('La fecha debe ser posterior a hoy.', false); return; }

    const appt = { id: crypto.randomUUID(), cliente:d.cliente.trim(), telefono:d.telefono.trim(), servicio:d.servicio, fecha:d.fecha, duracion:+d.duracion, stylist:d.stylist, notas:d.notas?.trim()||'' };
    const arr = aLoad(); arr.push(appt); aSave(arr); aRender(); apptForm.reset(); apptFecha.min = todayLocalISO(); aNotify('Cita creada correctamente.');
  });
  apptList.addEventListener('click', e=>{
    const id = e.target?.dataset?.cancel; if(!id) return;
    aSave(aLoad().filter(x=>x.id!==id)); aRender(); aNotify('Cita cancelada.');
  });
  aRender();
}

/* ===================== INVENTARIO (localStorage) ===================== */
const INV_PROD_KEY = 'dcury_inv_products_v1';
const INV_MOV_KEY  = 'dcury_inv_movs_v1';

const prodForm = $('#prod-form'), prodMsg = $('#prod-msg'), prodTable = $('#prod-table tbody'), prodSearch = $('#prod-search');
const movForm  = $('#mov-form'),  movMsg  = $('#mov-msg'),  movTable  = $('#mov-table tbody');
const movProdSelect = $('#m-prod');

function pLoad(){ try { return JSON.parse(localStorage.getItem(INV_PROD_KEY))||[] } catch { return [] } }
function pSave(v){ localStorage.setItem(INV_PROD_KEY, JSON.stringify(v)) }
function mLoad(){ try { return JSON.parse(localStorage.getItem(INV_MOV_KEY))||[] } catch { return [] } }
function mSave(v){ localStorage.setItem(INV_MOV_KEY, JSON.stringify(v)) }

function computeStock(){
  const stock = {};
  mLoad().forEach(m=>{
    const qty = Number(m.qty);
    if(!stock[m.productId]) stock[m.productId] = 0;
    if(m.type==='IN') stock[m.productId] += qty;
    else if(m.type==='OUT') stock[m.productId] -= qty;
    else if(m.type==='ADJUST') stock[m.productId] += qty;
  });
  return stock;
}

function getExpiring(days = 30){
  const limit = new Date(); limit.setDate(limit.getDate()+days);
  return mLoad()
    .filter(m => m.type==='IN' && m.expiry)
    .filter(m => new Date(m.expiry) <= limit)
    .map(m => ({ productId:m.productId, lot:m.lot||'', expiry:m.expiry }));
}

function renderProducts(){
  const products = pLoad();
  const stock = computeStock();
  const q = (prodSearch?.value||'').toLowerCase();
  prodTable.innerHTML = '';
  products
    .filter(p => (p.name+' '+(p.category||'')).toLowerCase().includes(q))
    .forEach(p=>{
      const s = Number(stock[p.id]||0);
      const status = s <= Number(p.min||0) ? '<span class="status low">Bajo</span>' : '<span class="status ok">OK</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.category||'-'}</td><td>${p.unit}</td><td>${s.toFixed(2)}</td><td>${Number(p.min||0).toFixed(2)}</td><td>${status}</td>`;
      prodTable.appendChild(tr);
    });

  if(movProdSelect){
    const optVal = movProdSelect.value;
    movProdSelect.innerHTML = '<option value="">Selecciona…</option>';
    products.forEach(p=>{
      const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; movProdSelect.appendChild(o);
    });
    if (optVal) movProdSelect.value = optVal;
  }
}

function renderMovs(){
  const products = pLoad(); const byId = Object.fromEntries(products.map(p=>[p.id,p]));
  movTable.innerHTML = '';
  mLoad()
    .sort((a,b)=> new Date(b.date)-new Date(a.date))
    .forEach(m=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(m.date).toLocaleString()}</td>
        <td>${byId[m.productId]?.name || '—'}</td>
        <td>${m.type}</td>
        <td>${Number(m.qty).toFixed(2)}</td>
        <td>${m.lot||'—'}</td>
        <td>${m.expiry||'—'}</td>
        <td>${m.unitCost? Number(m.unitCost).toFixed(2): '—'}</td>
        <td>${m.notes||'—'}</td>`;
      movTable.appendChild(tr);
    });
}

function renderReports(){
  const products = pLoad(); const stock = computeStock();
  const lowUl = $('#rep-low'); const expUl = $('#rep-exp');
  lowUl.innerHTML = ''; expUl.innerHTML = '';

  products.forEach(p=>{
    const s = Number(stock[p.id]||0);
    if (s <= Number(p.min||0)) {
      const li = document.createElement('li');
      li.textContent = `${p.name} — Stock: ${s.toFixed(2)} ${p.unit} (mín. ${Number(p.min||0).toFixed(2)})`;
      lowUl.appendChild(li);
    }
  });

  const expiring = getExpiring(30);
  const seen = new Set();
  expiring.forEach(e=>{
    const key = `${e.productId}|${e.lot}|${e.expiry}`;
    if (seen.has(key)) return; seen.add(key);
    const li = document.createElement('li');
    li.textContent = `${pLoad().find(p=>p.id===e.productId)?.name || '—'} — Lote: ${e.lot||'N/A'} — Caduca: ${e.expiry}`;
    expUl.appendChild(li);
  });
}

/* Eventos: Productos */
if (prodForm){
  prodForm.addEventListener('submit', e=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(prodForm).entries());
    if(!d.name || !d.unit){ prodMsg.textContent='Completa nombre y unidad.'; prodMsg.style.color='var(--danger)'; return; }
    const list = pLoad();
    const prod = { id: crypto.randomUUID(), name:d.name.trim(), category:d.category?.trim()||'', unit:d.unit.trim(), min:+(d.min||0) };
    list.push(prod); pSave(list);
    prodForm.reset(); prodMsg.textContent='Producto agregado.'; prodMsg.style.color='var(--ok)';
    renderProducts();
  });
  $('#prod-clear')?.addEventListener('click', ()=>{ prodForm.reset(); prodMsg.textContent=''; });
  prodSearch?.addEventListener('input', renderProducts);
  renderProducts();
}

/* Eventos: Movimientos */
if (movForm){
  movForm.addEventListener('submit', e=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(movForm).entries());
    if(!d.productId || !d.type || !d.qty){ movMsg.textContent='Producto, tipo y cantidad son obligatorios.'; movMsg.style.color='var(--danger)'; return; }
    const qty = Number(d.qty);
    if (!isFinite(qty) || qty <= 0){ movMsg.textContent='Cantidad inválida.'; movMsg.style.color='var(--danger)'; return; }

    if (d.type === 'OUT'){
      const stock = computeStock()[d.productId] || 0;
      if (qty > stock){ movMsg.textContent='No hay stock suficiente para la salida.'; movMsg.style.color='var(--danger)'; return; }
    }

    const movs = mLoad();
    movs.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      productId: d.productId,
      type: d.type,
      qty: qty,
      unitCost: d.unitCost? Number(d.unitCost): null,
      lot: d.lot?.trim() || null,
      expiry: d.expiry || null,
      notes: d.notes?.trim() || ''
    });
    mSave(movs);
    movForm.reset(); movMsg.textContent='Movimiento registrado.'; movMsg.style.color='var(--ok)';
    renderProducts(); renderMovs(); renderReports();
  });

  renderProducts();
  renderMovs();
  renderReports();
}

/* ===================== TABS Inventario ===================== */
$$('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelector('#tab-'+btn.dataset.tab).classList.add('active');
  });
});

/* ===================== GALERÍA (modal) ===================== */
const modal = $('#modal'), modalImg = $('#modal-img'), closeBtn = $('#close-modal');
if (closeBtn && modal) {
  closeBtn.addEventListener('click', ()=> modal.classList.remove('open'));
  modal.addEventListener('click', e=>{ if(e.target === modal) modal.classList.remove('open'); });
  $$('#galeria .thumb button').forEach(btn=>{
    btn.addEventListener('click', ()=>{ modalImg.src = btn.dataset.full; modal.classList.add('open'); });
  });
}

/* ===================== CARRUSEL (auto-play) ===================== */
(function initCarousel(){
  const container = document.querySelector('.carrusel-contenedor');
  const track = document.querySelector('.carrusel-imagenes');
  const prev = document.getElementById('anterior');
  const next = document.getElementById('siguiente');
  if (!container || !track || !prev || !next) return;

  const slides = track.querySelectorAll('img');
  let index = 0;
  const AUTO_MS = 4000; // velocidad auto
  let timer = null;

  function go(i){
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
  }
  function start(){ if(!timer) timer = setInterval(()=> go(index+1), AUTO_MS); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  // Botones
  prev.addEventListener('click', ()=>{ stop(); go(index - 1); start(); });
  next.addEventListener('click', ()=>{ stop(); go(index + 1); start(); });

  // Swipe en móvil
  let startX = null;
  track.addEventListener('touchstart', e=> { startX = e.touches[0].clientX; stop(); }, {passive:true});
  track.addEventListener('touchend', e=>{
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    startX = null; start();
  });

  // Pausa con hover / focus
  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', start);
  container.addEventListener('focusin', stop);
  container.addEventListener('focusout', start);

  // Pausa si la pestaña no está visible
  document.addEventListener('visibilitychange', ()=> {
    if (document.hidden) stop(); else start();
  });

  go(0); start();
})();
