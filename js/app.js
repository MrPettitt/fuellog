// ──────────────────────────────────────────
// STATE
// ──────────────────────────────────────────
let S = {
  view:          'dashboard',
  entryType:     'trip',
  manualKm:      false,
  month:         now(),
  entries:       [],
  settings: {
    employeeName: '',
    employerName: '',
    ratePerKm:    4.28,
    vehicleMake:  '',
    vehicleReg:   ''
  }
};

function now()  { return new Date().toISOString().slice(0,7); }
function today(){ return new Date().toISOString().split('T')[0]; }

function load() {
  try {
    const d = localStorage.getItem('fuellog_v1');
    if (d) {
      const p = JSON.parse(d);
      S.entries  = p.entries  || [];
      S.settings = { ...S.settings, ...(p.settings || {}) };
    }
  } catch(_) {}
}

function save() {
  localStorage.setItem('fuellog_v1', JSON.stringify({ entries: S.entries, settings: S.settings }));
}

load();

// ──────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function fmtR(n) {
  return 'R\u00A0' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function monthLabel(ym) {
  const [y,m] = ym.split('-');
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][+m-1] + ' ' + y;
}
function monthEntries(m) { return S.entries.filter(e => e.date.startsWith(m)); }
function allMonths() {
  const ms = new Set(S.entries.map(e => e.date.slice(0,7)));
  ms.add(now());
  return [...ms].sort().reverse();
}
function stats(m) {
  const es = monthEntries(m);
  const trips = es.filter(e => e.type === 'trip');
  const fuels = es.filter(e => e.type === 'fuel');
  const km    = trips.reduce((s,e) => s + (+e.km||0), 0);
  const fuel  = fuels.reduce((s,e) => s + (+e.totalCost||0), 0);
  return { trips: trips.length, km, fuel, reimburse: km * S.settings.ratePerKm, count: es.length, fuels: fuels.length };
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ──────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────
const views = ['dashboard','add','log','summary','settings'];
function go(v) {
  S.view = v;
  document.querySelectorAll('.nav-btn').forEach((b,i) => b.classList.toggle('active', views[i]===v));
  render();
}

// ──────────────────────────────────────────
// RENDER DISPATCH
// ──────────────────────────────────────────
function render() {
  document.getElementById('header-user').textContent =
    S.settings.employeeName ? '👤 ' + S.settings.employeeName : '';
  const map = { dashboard: rDash, add: rAdd, log: rLog, summary: rSummary, settings: rSettings };
  document.getElementById('app').innerHTML = map[S.view]();
}

// ──────────────────────────────────────────
// MONTH SELECTOR HTML
// ──────────────────────────────────────────
function monthSel() {
  return `<select class="month-select" onchange="S.month=this.value;render()">
    ${allMonths().map(m=>`<option value="${m}" ${m===S.month?'selected':''}>${monthLabel(m)}</option>`).join('')}
  </select>`;
}

// ──────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────
function rDash() {
  const st = stats(S.month);
  const recent = [...S.entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);

  return `
  <div class="section-header">
    <div>
      <h1>Dashboard</h1>
      <p>Business travel overview · <strong>${monthLabel(S.month)}</strong></p>
    </div>
    ${monthSel()}
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Business KM</div>
      <div class="stat-value">${st.km.toFixed(0)}</div>
      <div class="stat-sub">kilometres</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Trips Logged</div>
      <div class="stat-value">${st.trips}</div>
      <div class="stat-sub">business trips</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Fuel Spend</div>
      <div class="stat-value" style="font-size:1.35rem">${fmtR(st.fuel)}</div>
      <div class="stat-sub">fill-ups: ${st.fuels}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Reimbursement</div>
      <div class="stat-value" style="font-size:1.35rem;color:var(--success)">${fmtR(st.reimburse)}</div>
      <div class="stat-sub">@ R${S.settings.ratePerKm}/km</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">Recent Entries</span>
      <button class="btn btn-outline" onclick="go('add')" style="padding:0.38rem 1rem;font-size:0.78rem">+ Add Entry</button>
    </div>
    ${recent.length === 0 ? `
      <div class="empty-state">
        <div class="icon">🚗</div>
        <h3>No entries yet</h3>
        <p>Start logging your business trips and fuel fill-ups</p>
        <br>
        <button class="btn btn-primary" onclick="go('add')">Log First Entry</button>
      </div>
    ` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>KM / Cost</th><th></th></tr></thead>
          <tbody>
            ${recent.map(e=>`
              <tr>
                <td>${fmtDate(e.date)}</td>
                <td><span class="badge badge-${e.type}">${e.type==='trip'?'🚗 Trip':'⛽ Fuel'}</span></td>
                <td>${e.type==='trip' ? (e.purpose||'-') : (e.station||'Fill-up')}</td>
                <td><strong>${e.type==='trip' ? parseFloat(e.km).toFixed(1)+' km' : fmtR(e.totalCost)}</strong></td>
                <td><button class="btn btn-ghost" onclick="del('${e.id}')">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  </div>`;
}

// ──────────────────────────────────────────
// ADD ENTRY
// ──────────────────────────────────────────
function rAdd() {
  return `
  <div class="section-header">
    <div><h1>New Entry</h1><p>Log a business trip or fuel fill-up</p></div>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="type-tabs">
        <button class="type-tab ${S.entryType==='trip'?'active':''}"  onclick="S.entryType='trip';render()">🚗 Trip</button>
        <button class="type-tab ${S.entryType==='fuel'?'active':''}"  onclick="S.entryType='fuel';render()">⛽ Fuel Fill-up</button>
      </div>
      ${S.entryType==='trip' ? rTripForm() : rFuelForm()}
    </div>
  </div>`;
}

function rTripForm() {
  return `
  <form onsubmit="saveTrip(event)">
    <div class="form-row">
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="t-date" value="${today()}" required>
      </div>
      <div class="form-group">
        <label>Trip Purpose / Description</label>
        <input type="text" id="t-purpose" placeholder="e.g. Client meeting - Sandton" required>
      </div>
    </div>

    <div class="toggle-row">
      <input type="checkbox" id="t-manual" ${S.manualKm?'checked':''} onchange="S.manualKm=this.checked;render()">
      <span class="lbl" onclick="document.getElementById('t-manual').click()">Enter distance manually (no odometer readings)</span>
    </div>

    ${S.manualKm ? `
      <div class="form-group" style="max-width:260px">
        <label>Distance (km)</label>
        <input type="number" id="t-km" min="0.1" step="0.1" placeholder="e.g. 42.0" required>
      </div>
    ` : `
      <div class="form-row">
        <div class="form-group">
          <label>Start Odometer (km)</label>
          <input type="number" id="t-odo-s" min="0" step="1" placeholder="e.g. 85 420" oninput="calcKm()" required>
        </div>
        <div class="form-group">
          <label>End Odometer (km)</label>
          <input type="number" id="t-odo-e" min="0" step="1" placeholder="e.g. 85 468" oninput="calcKm()" required>
        </div>
      </div>
      <div class="info-box" id="km-info"></div>
    `}

    <div class="form-row" style="margin-top:0.5rem">
      <div class="form-group">
        <label>Category</label>
        <select id="t-cat">
          <option>Client Visit</option>
          <option>Site Inspection</option>
          <option>Delivery / Collection</option>
          <option>Meeting</option>
          <option>Training</option>
          <option>Airport / Transport</option>
          <option>Other Business</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <input type="text" id="t-notes" placeholder="Additional notes…">
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.75rem">
      <button type="button" class="btn btn-outline" onclick="go('dashboard')">Cancel</button>
      <button type="submit" class="btn btn-primary">Save Trip</button>
    </div>
  </form>`;
}

function rFuelForm() {
  return `
  <form onsubmit="saveFuel(event)">
    <div class="form-row">
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="f-date" value="${today()}" required>
      </div>
      <div class="form-group">
        <label>Filling Station (optional)</label>
        <input type="text" id="f-station" placeholder="e.g. Engen Bryanston">
      </div>
    </div>

    <div class="form-row-3">
      <div class="form-group">
        <label>Litres</label>
        <input type="number" id="f-litres" min="0.1" step="0.01" placeholder="e.g. 40.50" oninput="calcFuel()" required>
      </div>
      <div class="form-group">
        <label>Price / Litre (R)</label>
        <input type="number" id="f-ppl" min="0" step="0.001" placeholder="e.g. 22.490" oninput="calcFuel()" required>
      </div>
      <div class="form-group">
        <label>Total Cost (R)</label>
        <input type="number" id="f-total" min="0" step="0.01" placeholder="Auto-calculated" oninput="calcFuelBack()">
      </div>
    </div>
    <div class="info-box" id="fuel-info"></div>

    <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
      <button type="button" class="btn btn-outline" onclick="go('dashboard')">Cancel</button>
      <button type="submit" class="btn btn-accent">Save Fill-up</button>
    </div>
  </form>`;
}

function calcKm() {
  const s = +document.getElementById('t-odo-s')?.value;
  const e = +document.getElementById('t-odo-e')?.value;
  const box = document.getElementById('km-info');
  if (!box) return;
  const km = e - s;
  if (s && e && km > 0) {
    box.style.display = 'block';
    box.textContent = `📍 Distance: ${km.toFixed(1)} km`;
  } else {
    box.style.display = 'none';
  }
}

function calcFuel() {
  const l = +document.getElementById('f-litres')?.value;
  const p = +document.getElementById('f-ppl')?.value;
  const tEl = document.getElementById('f-total');
  const box = document.getElementById('fuel-info');
  if (!tEl || !box) return;
  if (l && p) {
    const t = l * p;
    tEl.value = t.toFixed(2);
    box.style.display = 'block';
    box.textContent = `💰 Total: ${fmtR(t)}`;
  }
}

function calcFuelBack() {
  const l = +document.getElementById('f-litres')?.value;
  const t = +document.getElementById('f-total')?.value;
  const pEl = document.getElementById('f-ppl');
  if (l && t && pEl) pEl.value = (t/l).toFixed(3);
}

function saveTrip(ev) {
  ev.preventDefault();
  let km, odoS = null, odoE = null;
  if (S.manualKm) {
    km = +document.getElementById('t-km').value;
  } else {
    odoS = +document.getElementById('t-odo-s').value;
    odoE = +document.getElementById('t-odo-e').value;
    km = odoE - odoS;
    if (km <= 0) { alert('End odometer must be greater than start odometer.'); return; }
  }
  S.entries.push({
    id: uid(), type: 'trip',
    date:     document.getElementById('t-date').value,
    purpose:  document.getElementById('t-purpose').value,
    category: document.getElementById('t-cat').value,
    notes:    document.getElementById('t-notes').value,
    km, manualKm: S.manualKm, startOdo: odoS, endOdo: odoE
  });
  save(); toast('✓ Trip saved'); go('dashboard');
}

function saveFuel(ev) {
  ev.preventDefault();
  const litres = +document.getElementById('f-litres').value;
  const ppl    = +document.getElementById('f-ppl').value;
  const total  = +document.getElementById('f-total').value || (litres * ppl);
  S.entries.push({
    id: uid(), type: 'fuel',
    date:         document.getElementById('f-date').value,
    station:      document.getElementById('f-station').value,
    litres, pricePerLitre: ppl, totalCost: total
  });
  save(); toast('✓ Fuel fill-up saved'); go('dashboard');
}

function del(id) {
  if (!confirm('Delete this entry?')) return;
  S.entries = S.entries.filter(e => e.id !== id);
  save(); toast('Entry deleted'); render();
}

// ──────────────────────────────────────────
// MONTHLY LOG
// ──────────────────────────────────────────
function rLog() {
  const es  = monthEntries(S.month).sort((a,b)=>a.date.localeCompare(b.date));
  const st  = stats(S.month);
  return `
  <div class="section-header">
    <div><h1>Monthly Log</h1><p>All entries · ${monthLabel(S.month)}</p></div>
    ${monthSel()}
  </div>

  <div class="stats-strip">
    <div class="strip-item"><div class="stat-label">Total KM</div><strong>${st.km.toFixed(1)} km</strong></div>
    <div class="strip-item"><div class="stat-label">Trips</div><strong>${st.trips}</strong></div>
    <div class="strip-item"><div class="stat-label">Fuel Spend</div><strong>${fmtR(st.fuel)}</strong></div>
    <div class="strip-item"><div class="stat-label">Est. Reimbursement</div><strong style="color:var(--success)">${fmtR(st.reimburse)}</strong></div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">${monthLabel(S.month)}</span>
      <span style="font-size:0.82rem;color:var(--muted)">${es.length} entr${es.length===1?'y':'ies'}</span>
    </div>
    ${es.length === 0 ? `
      <div class="empty-state">
        <div class="icon">📋</div>
        <h3>No entries for this month</h3>
        <p>Switch months or add a new entry</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Odometer</th><th>KM / Cost</th><th></th></tr></thead>
          <tbody>
            ${es.map(e=>`
              <tr>
                <td>${fmtDate(e.date)}</td>
                <td><span class="badge badge-${e.type}">${e.type==='trip'?'🚗 Trip':'⛽ Fuel'}</span></td>
                <td>
                  <strong>${e.type==='trip' ? (e.purpose||'-') : (e.station||'Fill-up')}</strong>
                  ${e.type==='trip' && e.category ? `<br><small style="color:var(--muted)">${e.category}</small>` : ''}
                  ${e.type==='fuel' ? `<br><small style="color:var(--muted)">${e.litres}L @ R${(+e.pricePerLitre).toFixed(3)}/L</small>` : ''}
                  ${e.type==='trip' && e.notes ? `<br><small style="color:var(--muted)">${e.notes}</small>` : ''}
                </td>
                <td style="color:var(--muted);font-size:0.82rem">
                  ${e.type==='trip' && !e.manualKm && e.startOdo
                    ? (+e.startOdo).toLocaleString('en-ZA') + ' → ' + (+e.endOdo).toLocaleString('en-ZA')
                    : '-'}
                </td>
                <td><strong>${e.type==='trip' ? (+e.km).toFixed(1)+' km' : fmtR(e.totalCost)}</strong></td>
                <td><button class="btn btn-ghost" onclick="del('${e.id}')">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  </div>`;
}

// ──────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────
function rSummary() {
  const es    = monthEntries(S.month).sort((a,b)=>a.date.localeCompare(b.date));
  const trips = es.filter(e=>e.type==='trip');
  const fuels = es.filter(e=>e.type==='fuel');
  const st    = stats(S.month);
  const s     = S.settings;
  const text  = buildSummary(s, trips, fuels, st);

  return `
  <div class="section-header">
    <div><h1>Monthly Summary</h1><p>Shareable reimbursement report for your employer</p></div>
    ${monthSel()}
  </div>

  ${!s.employeeName ? `
    <div class="notice">
      <span style="font-size:1.5rem">⚙️</span>
      <div>
        <strong>Set up your profile first</strong>
        <p>Add your name and employer details in Settings to generate a complete summary.</p>
      </div>
      <button class="btn btn-outline" onclick="go('settings')" style="margin-left:auto;white-space:nowrap">Go to Settings</button>
    </div>
  ` : ''}

  <div class="card">
    <div class="card-header">
      <span class="card-title">Reimbursement Report - ${monthLabel(S.month)}</span>
      <button class="btn btn-primary" onclick="copySummary()">📋 Copy to Clipboard</button>
    </div>
    <div class="card-body">
      <div class="summary-box" id="sum-text">${text}</div>
    </div>
  </div>`;
}

function pad(str, len) {
  str = String(str);
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function buildSummary(s, trips, fuels, st) {
  const W = 60;
  const line = '─'.repeat(W);
  const ln = [];
  const mo = monthLabel(S.month).toUpperCase();

  ln.push(`BUSINESS TRAVEL REIMBURSEMENT - ${mo}`);
  ln.push(line);
  ln.push(`Employee : ${s.employeeName || '[Employee Name]'}`);
  if (s.vehicleMake) ln.push(`Vehicle  : ${s.vehicleMake}${s.vehicleReg?' ('+s.vehicleReg+')':''}`);
  if (s.employerName) ln.push(`Employer : ${s.employerName}`);
  ln.push('');

  ln.push('TRIP LOG');
  ln.push(line);
  if (trips.length === 0) {
    ln.push('  No trips recorded.');
  } else {
    trips.forEach((t,i) => {
      const num = String(i+1).padStart(2,'0');
      const desc = pad(t.purpose||'Business Trip', 32);
      const km = `${(+t.km).toFixed(1)} km`;
      ln.push(`  ${num}.  ${fmtDate(t.date)}   ${desc}  ${km.padStart(8)}`);
      if (!t.manualKm && t.startOdo)
        ln.push(`        Odometer: ${(+t.startOdo).toLocaleString('en-ZA')} → ${(+t.endOdo).toLocaleString('en-ZA')} km`);
      if (t.category) ln.push(`        Category: ${t.category}`);
      if (t.notes)    ln.push(`        Note:     ${t.notes}`);
    });
  }
  ln.push('');
  ln.push(line);
  ln.push(`  TOTAL BUSINESS KM    : ${st.km.toFixed(1)} km`);
  ln.push(`  REIMBURSEMENT RATE   : R ${(+S.settings.ratePerKm).toFixed(2)}/km`);
  ln.push(`  TOTAL REIMBURSEMENT  : ${fmtR(st.reimburse)}`);

  if (fuels.length > 0) {
    ln.push('');
    ln.push('FUEL EXPENSES');
    ln.push(line);
    fuels.forEach(f => {
      const d   = fmtDate(f.date);
      const sta = pad(f.station||'Fill-up', 22);
      const lit = `${(+f.litres).toFixed(2)}L`.padStart(8);
      const cst = fmtR(f.totalCost).padStart(12);
      ln.push(`  ${d}   ${sta}  ${lit}  ${cst}`);
    });
    ln.push('');
    ln.push(`  TOTAL FUEL SPEND     : ${fmtR(st.fuel)}`);
  }

  ln.push('');
  ln.push(line);
  ln.push(`  Generated: ${new Date().toLocaleDateString('en-ZA', {day:'2-digit',month:'long',year:'numeric'})}`);
  ln.push(`  This report was generated by FuelLog.`);

  return ln.join('\n');
}

function copySummary() {
  const txt = document.getElementById('sum-text')?.textContent || '';
  navigator.clipboard.writeText(txt)
    .then(()  => toast('✓ Copied to clipboard!'))
    .catch(()  => {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('✓ Copied!');
    });
}

// ──────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────
function rSettings() {
  const s = S.settings;
  return `
  <div class="section-header">
    <div><h1>Settings</h1><p>Employee profile & reimbursement rate</p></div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">Employee Profile</span></div>
    <div class="card-body">
      <div class="settings-grid">
        <div class="form-group">
          <label>Your Full Name</label>
          <input type="text" id="s-name" value="${s.employeeName}" placeholder="e.g. Thabo Nkosi">
        </div>
        <div class="form-group">
          <label>Employer / Company Name</label>
          <input type="text" id="s-company" value="${s.employerName}" placeholder="e.g. Apex Solutions (Pty) Ltd">
        </div>
        <div class="form-group">
          <label>Vehicle Make &amp; Model</label>
          <input type="text" id="s-vmake" value="${s.vehicleMake}" placeholder="e.g. Toyota Corolla Quest">
        </div>
        <div class="form-group">
          <label>Vehicle Registration</label>
          <input type="text" id="s-vreg" value="${s.vehicleReg}" placeholder="e.g. CA 123-456">
        </div>
      </div>

      <div class="divider"></div>

      <div class="form-group" style="max-width:280px">
        <label>Reimbursement Rate (R / km)</label>
        <input type="number" id="s-rate" value="${s.ratePerKm}" min="0" step="0.01">
        <p style="font-size:0.78rem;color:var(--muted);margin-top:0.35rem">
          SARS AA rate for private vehicles. Confirm with your employer.
        </p>
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:1.5rem;border-left:3px solid var(--danger)">
    <div class="card-header"><span class="card-title" style="color:var(--danger)">Danger Zone</span></div>
    <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <strong>Clear all data</strong><br>
        <span style="font-size:0.875rem;color:var(--muted)">Permanently delete all entries and settings</span>
      </div>
      <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="clearAll()">
        Clear All Data
      </button>
    </div>
  </div>`;
}

function saveSettings() {
  S.settings = {
    employeeName: document.getElementById('s-name').value.trim(),
    employerName: document.getElementById('s-company').value.trim(),
    vehicleMake:  document.getElementById('s-vmake').value.trim(),
    vehicleReg:   document.getElementById('s-vreg').value.trim(),
    ratePerKm:    +document.getElementById('s-rate').value || 4.28
  };
  save(); toast('✓ Settings saved'); render();
}

function clearAll() {
  if (!confirm('This will permanently delete all entries and settings. Are you sure?')) return;
  S.entries = [];
  S.settings = { employeeName:'', employerName:'', ratePerKm:4.28, vehicleMake:'', vehicleReg:'' };
  save(); toast('All data cleared'); render();
}

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────
render();
