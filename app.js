const API = '/api';

// ── Auth Logic ────────────────────────────────────────────────────────────────
function checkAuth() {
    const user = localStorage.getItem('omnibus_admin');
    const overlay = document.getElementById('auth-overlay');
    if (!user) {
        overlay.classList.remove('hidden-auth');
    } else {
        overlay.classList.add('hidden-auth');
        // Trigger initial load if not already loaded
        if (loaders['dashboard']) loaders['dashboard']();
    }
}

function toggleAuth(mode) {
    if (mode === 'signup') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = 'Create a new Admin account';
    } else {
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = 'Sign in to Admin Portal';
    }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    if (!user || !pass) return toast('Fill all fields', 'error');
    
    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Username: user, Password: pass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        localStorage.setItem('omnibus_admin', data.username);
        toast('Welcome ' + data.username);
        checkAuth();
    } catch (e) { toast(e.message, 'error'); }
}

async function handleSignup() {
    const user = document.getElementById('signup-user').value;
    const pass = document.getElementById('signup-pass').value;
    if (!user || !pass) return toast('Fill all fields', 'error');
    
    try {
        const res = await fetch(`${API}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Username: user, Password: pass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        toast('Account created. Please login.');
        toggleAuth('login');
    } catch (e) { toast(e.message, 'error'); }
}

function handleLogout() {
    localStorage.removeItem('omnibus_admin');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    checkAuth();
}

window.addEventListener('DOMContentLoaded', checkAuth);


// ── Navigation ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const sec = btn.dataset.section;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(sec).classList.add('active');
        loaders[sec] && loaders[sec]();
    });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3200);
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('open');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ── Confirm Helper ────────────────────────────────────────────────────────────
function confirmDelete(msg, onConfirm) {
    document.getElementById('confirm-msg').textContent = msg;
    const btn = document.getElementById('confirm-yes');
    btn.onclick = () => { closeModal('confirm-modal'); onConfirm(); };
    openModal('confirm-modal');
}

// ── Fetch Helpers ─────────────────────────────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function setLoading(tbodyId) {
    document.querySelector(`#${tbodyId} tbody`).innerHTML =
        `<tr class="loading-row"><td colspan="20">LOADING...</td></tr>`;
}

// ── Badge Helpers ─────────────────────────────────────────────────────────────
function statusBadge(s) {
    const map = { Pending: 'pending', Confirmed: 'confirmed', Cancelled: 'cancelled', Completed: 'completed', Failed: 'failed' };
    return `<span class="badge badge-${(map[s] || 'pending')}">${s || '—'}</span>`;
}
function roleBadge(r) {
    const map = { Driver: 'driver', Hostess: 'hostess', Security: 'security', Attendant: 'attendant', Staff: 'staff' };
    return `<span class="badge badge-${map[r] || 'staff'}">${r || 'Staff'}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
async function loadDashboard() {
    try {
        const s = await apiFetch(`${API}/stats`);
        document.getElementById('stat-passengers').textContent = s.passengers ?? 0;
        document.getElementById('stat-buses').textContent = s.buses ?? 0;
        document.getElementById('stat-trips').textContent = s.trips ?? 0;
        document.getElementById('stat-bookings').textContent = s.bookings ?? 0;
        document.getElementById('stat-revenue').textContent = Number(s.revenue || 0).toLocaleString('en-PK');
        document.getElementById('stat-pending').textContent = s.pendingBookings ?? 0;
    } catch (e) { toast('Could not load stats: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSENGERS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadPassengers() {
    setLoading('passengers-table');
    try {
        const rows = await apiFetch(`${API}/passengers`);
        const tbody = document.querySelector('#passengers-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No passengers found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(p => `
      <tr>
        <td>${p.PassengerID}</td>
        <td>${p.FirstName} ${p.LastName}</td>
        <td>${p.Email || '—'}</td>
        <td>${p.Phone || '—'}</td>
        <td>${p.CNIC || '—'}</td>
        <td>${p.DateOfBirth ? p.DateOfBirth.split('T')[0] : '—'}</td>
        <td>
          <button class="action-btn" onclick="editPassenger(${p.PassengerID})">Edit</button>
          <button class="action-btn del" onclick="deletePassenger(${p.PassengerID}, '${p.FirstName} ${p.LastName}')">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading passengers: ' + e.message, 'error'); }
}

function openAddPassenger() {
    document.getElementById('passenger-modal-title').textContent = 'Add Passenger';
    document.getElementById('p-id').value = '';
    ['p-pid', 'p-fname', 'p-lname', 'p-email', 'p-phone', 'p-cnic', 'p-dob', 'p-pass'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p-pid').disabled = false;
    document.getElementById('passenger-modal').classList.add('open');
}

async function editPassenger(id) {
    try {
        const p = await apiFetch(`${API}/passengers/${id}`);
        document.getElementById('passenger-modal-title').textContent = 'Edit Passenger';
        document.getElementById('p-id').value = p.PassengerID;
        document.getElementById('p-pid').value = p.PassengerID;
        document.getElementById('p-pid').disabled = true;
        document.getElementById('p-fname').value = p.FirstName || '';
        document.getElementById('p-lname').value = p.LastName || '';
        document.getElementById('p-email').value = p.Email || '';
        document.getElementById('p-phone').value = p.Phone || '';
        document.getElementById('p-cnic').value = p.CNIC || '';
        document.getElementById('p-dob').value = p.DateOfBirth ? p.DateOfBirth.split('T')[0] : '';
        document.getElementById('p-pass').value = '';
        openModal('passenger-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function savePassenger() {
    const id = document.getElementById('p-id').value;
    const phone = document.getElementById('p-phone').value;
    const cnic = document.getElementById('p-cnic').value;

    // Validate Phone (exactly 11 digits, no characters)
    if (!/^\d{11}$/.test(phone)) {
        return toast('Phone must be exactly 11 digits (numbers only)', 'error');
    }
    // Validate CNIC (exactly 13 digits, no characters)
    if (!/^\d{13}$/.test(cnic)) {
        return toast('CNIC must be exactly 13 digits (numbers only)', 'error');
    }

    const body = {
        PassengerID: document.getElementById('p-pid').value || null,
        FirstName: document.getElementById('p-fname').value,
        LastName: document.getElementById('p-lname').value,
        Email: document.getElementById('p-email').value,
        Phone: phone,
        CNIC: cnic,
        DateOfBirth: document.getElementById('p-dob').value,
        Password: document.getElementById('p-pass').value || 'default'
    };
    try {
        if (id) {
            await apiFetch(`${API}/passengers/${id}`, 'PUT', body);
            toast('Passenger updated');
        } else {
            await apiFetch(`${API}/passengers`, 'POST', body);
            toast('Passenger added');
        }
        closeModal('passenger-modal');
        loadPassengers();
        loadDashboard();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deletePassenger(id, name) {
    confirmDelete(`Delete passenger "${name}"?`, async () => {
        try {
            await apiFetch(`${API}/passengers/${id}`, 'DELETE');
            toast('Passenger deleted');
            loadPassengers();
            loadDashboard();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF
// ═══════════════════════════════════════════════════════════════════════════════
async function loadStaff() {
    setLoading('staff-table');
    try {
        const rows = await apiFetch(`${API}/staff`);
        const tbody = document.querySelector('#staff-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No staff found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(s => {
            let detail = '—';
            if (s.Role === 'Driver') detail = `Lic: ${s.DriverLicense || '?'} · ${s.ExperienceYears || 0}yr`;
            else if (s.Role === 'Security') detail = `Lic: ${s.SecurityLicense || '?'}`;
            else if (s.Role === 'Attendant') detail = s.ServiceLevel || 'Junior';
            else if (s.Role === 'Hostess') detail = `Langs: ${s.LanguagesKnown || 'None'}`;
            return `<tr>
        <td>${s.OperatorID}</td>
        <td>${s.Name}</td>
        <td>${s.PhoneNumber || '—'}</td>
        <td>${roleBadge(s.Role)}</td>
        <td>${detail}</td>
        <td>
          <button class="action-btn" onclick="editStaff(${s.OperatorID})">Edit</button>
          <button class="action-btn del" onclick="deleteStaff(${s.OperatorID}, '${s.Name}')">Del</button>
        </td>
      </tr>`;
        }).join('');
    } catch (e) { toast('Error loading staff: ' + e.message, 'error'); }
}

function openAddStaff() {
    document.getElementById('staff-modal-title').textContent = 'Add Staff';
    document.getElementById('s-id').value = '';
    document.getElementById('s-oid').value = '';
    document.getElementById('s-oid').disabled = false;
    document.getElementById('s-name').value = '';
    document.getElementById('s-phone').value = '';
    document.getElementById('s-addr').value = '';
    document.getElementById('s-role').value = '';
    document.getElementById('s-license').value = '';
    document.getElementById('s-exp').value = '';
    document.getElementById('s-slicense').value = '';
    document.getElementById('s-level').value = 'Junior';
    document.getElementById('s-lang').value = '';
    toggleStaffFields();
    openModal('staff-modal');
}

function toggleStaffFields() {
    const role = document.getElementById('s-role').value;
    document.getElementById('driver-fields').classList.toggle('hidden', role !== 'Driver');
    document.getElementById('security-fields').classList.toggle('hidden', role !== 'Security');
    document.getElementById('attendant-fields').classList.toggle('hidden', role !== 'Attendant');
    // FIX 1: show hostess language group using the same class-based pattern
    document.getElementById('hostess-lang-group').classList.toggle('hidden', role !== 'Hostess');
}

async function editStaff(id) {
    try {
        const rows = await apiFetch(`${API}/staff`);
        const s = rows.find(r => r.OperatorID == id);
        if (!s) return;
        document.getElementById('staff-modal-title').textContent = 'Edit Staff';
        document.getElementById('s-id').value = s.OperatorID;
        document.getElementById('s-oid').value = s.OperatorID;
        document.getElementById('s-oid').disabled = true;
        document.getElementById('s-name').value = s.Name || '';
        document.getElementById('s-phone').value = s.PhoneNumber || '';
        document.getElementById('s-addr').value = s.Address || '';
        document.getElementById('s-role').value = s.Role || '';
        document.getElementById('s-lang').value = s.LanguagesKnown || '';
        toggleStaffFields();
        openModal('staff-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function saveStaff() {
    const id = document.getElementById('s-id').value;
    const role = document.getElementById('s-role').value;

    // FIX 1: Collect Hostess languages from text input
    let hostessLangs = '';
    if (role === 'Hostess') {
        hostessLangs = document.getElementById('s-lang').value;
    }

    // FIX 2: Map driver license to LicenseNumber, security license to SLicenseNumber separately
    // Validate Phone (exactly 11 digits, no characters)
    const phone = document.getElementById('s-phone').value;
    if (!/^\d{11}$/.test(phone)) {
        return toast('Phone must be exactly 11 digits (numbers only)', 'error');
    }

    const body = {
        OperatorID: document.getElementById('s-oid').value,
        Name: document.getElementById('s-name').value,
        PhoneNumber: phone,
        Address: document.getElementById('s-addr').value,
        Role: role,
        // Driver-specific: license goes to Driver.LicenseNumber
        LicenseNumber: document.getElementById('s-license').value || null,
        ExperienceYears: document.getElementById('s-exp').value || null,
        // Security-specific: license goes to SecurityStaff.LicenseNumber via SLicenseNumber key
        SLicenseNumber: document.getElementById('s-slicense').value || null,
        // Attendant-specific
        ServiceLevel: document.getElementById('s-level').value || 'Junior',
        // Hostess languages
        Languages: hostessLangs
    };

    if (!body.OperatorID || !body.Name || !body.Role) {
        toast('Please fill ID, Name and Role', 'error');
        return;
    }

    try {
        if (id) {
            await apiFetch(`${API}/staff/${id}`, 'PUT', body);
            toast('Staff member updated successfully');
        } else {
            await apiFetch(`${API}/staff`, 'POST', body);
            toast('Staff member added successfully');
        }
        closeModal('staff-modal');
        document.getElementById('s-id').value = '';
        document.getElementById('s-oid').disabled = false;
        loadStaff();
    } catch (e) {
        console.error('Save Staff Error:', e);
        toast(e.message, 'error');
    }
}

function deleteStaff(id, name) {
    confirmDelete(`Delete staff member "${name}"?`, async () => {
        try {
            await apiFetch(`${API}/staff/${id}`, 'DELETE');
            toast('Staff deleted');
            loadStaff();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSES
// ═══════════════════════════════════════════════════════════════════════════════
async function populateDriverDropdown(selectedId = '') {
    try {
        const staff = await apiFetch(`${API}/staff`);
        const drivers = staff.filter(s => s.Role === 'Driver');
        const sel = document.getElementById('b-opid');
        sel.innerHTML = '<option value="">— No Driver —</option>';
        drivers.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.OperatorID;
            opt.textContent = `#${d.OperatorID} — ${d.Name} (${d.ExperienceYears || 0}yr exp)`;
            if (d.OperatorID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function populateHostessDropdown(selectedId = '') {
    try {
        const staff = await apiFetch(`${API}/staff`);
        const hostesses = staff.filter(s => s.Role === 'Hostess');
        const sel = document.getElementById('b-hid');
        sel.innerHTML = '<option value="">— No Hostess —</option>';
        hostesses.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.OperatorID;
            opt.textContent = `#${h.OperatorID} — ${h.Name} (${h.LanguagesKnown || 'N/A'})`;
            if (h.OperatorID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function populateDriverBusDropdown(selectedId = '') {
    try {
        const buses = await apiFetch(`${API}/buses`);
        // Only buses that have a driver assigned
        const driverBuses = buses.filter(b => b.OperatorID);
        const sel = document.getElementById('tr-bid');
        sel.innerHTML = '<option value="">— Select Bus —</option>';
        driverBuses.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.BusID;
            opt.textContent = `${b.BusNumber} — Driver: ${b.DriverName || 'Assigned'} (${b.TotalSeats} seats)`;
            if (b.BusID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
        if (!driverBuses.length) {
            sel.innerHTML = '<option value="">No driver-assigned buses found</option>';
        }
    } catch (e) { /* silently fail */ }
}

async function populateRouteDropdown(selectedId = '') {
    try {
        const routes = await apiFetch(`${API}/routes`);
        const sel = document.getElementById('tr-rid');
        sel.innerHTML = '<option value="">— Select Route —</option>';
        routes.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.RouteID;
            opt.textContent = `${r.SourceCity} → ${r.DestinationCity} (${r.Distance || '?'} km)`;
            if (r.RouteID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function loadBuses() {
    setLoading('buses-table');
    try {
        const rows = await apiFetch(`${API}/buses`);
        const tbody = document.querySelector('#buses-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No buses found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(b => `
      <tr>
        <td>${b.BusID}</td>
        <td>${b.BusNumber}</td>
        <td>${b.TotalSeats}</td>
        <td>${b.Types ? b.Types.split(',').map(t => `<span class="badge badge-driver">${t}</span>`).join(' ') : '—'}</td>
        <td>${b.DriverName ? `<span class="badge badge-driver">🧑‍✈ ${b.DriverName}</span>` : '<span class="badge badge-staff">Unassigned</span>'}</td>
        <td>${b.HostessName ? `<span class="badge badge-driver">💁‍♀ ${b.HostessName}</span>` : '<span class="badge badge-staff">Unassigned</span>'}</td>
        <td>
          <button class="action-btn" onclick="editBus(${b.BusID})">Edit</button>
          <button class="action-btn del" onclick="deleteBus(${b.BusID}, '${b.BusNumber}')">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading buses: ' + e.message, 'error'); }
}

async function openAddBus() {
    document.getElementById('bus-modal-title').textContent = 'Add Bus';
    document.getElementById('b-id').value = '';
    document.getElementById('b-bid').value = '';
    document.getElementById('b-bid').disabled = false;
    document.getElementById('b-num').value = '';
    document.getElementById('b-seats').value = '';
    document.getElementById('bt-luxury').checked = false;
    document.getElementById('bt-ac').checked = false;
    document.getElementById('bt-sleeper').checked = false;
    await Promise.all([populateDriverDropdown(''), populateHostessDropdown('')]);
    openModal('bus-modal');
}

async function editBus(id) {
    try {
        const rows = await apiFetch(`${API}/buses`);
        const b = rows.find(r => r.BusID == id);
        if (!b) return;
        document.getElementById('bus-modal-title').textContent = 'Edit Bus';
        document.getElementById('b-id').value = b.BusID;
        document.getElementById('b-bid').value = b.BusID;
        document.getElementById('b-bid').disabled = true;
        document.getElementById('b-num').value = b.BusNumber || '';
        document.getElementById('b-seats').value = b.TotalSeats || '';
        const types = (b.Types || '').split(',');
        document.getElementById('bt-luxury').checked = types.includes('Luxury');
        document.getElementById('bt-ac').checked = types.includes('AC');
        document.getElementById('bt-sleeper').checked = types.includes('Sleeper');
        await Promise.all([populateDriverDropdown(b.OperatorID || ''), populateHostessDropdown(b.HostessID || '')]);
        openModal('bus-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function saveBus() {
    const id = document.getElementById('b-id').value;
    const busId = document.getElementById('b-bid').value || null;
    const selectedTypes = ['Luxury', 'AC', 'Sleeper'].filter(t =>
        document.getElementById(`bt-${t.toLowerCase()}`).checked
    );

    const body = {
        BusID: busId,
        BusNumber: document.getElementById('b-num').value,
        TotalSeats: document.getElementById('b-seats').value,
        OperatorID: document.getElementById('b-opid').value || null,
        HostessID: document.getElementById('b-hid').value || null,
        Types: selectedTypes.join(', ') || 'Standard'
    };

    try {
        if (id) {
            await apiFetch(`${API}/buses/${id}`, 'PUT', body);
            // FIX 5: Delete old types then await ALL new type inserts before reloading
            await apiFetch(`${API}/bustypes/${id}`, 'DELETE');
            await Promise.all(selectedTypes.map(type =>
                apiFetch(`${API}/bustypes`, 'POST', { BusID: id, CategoryName: type })
            ));
            toast('Bus updated');
        } else {
            const result = await apiFetch(`${API}/buses`, 'POST', body);
            const newBusId = busId || result.id;
            // FIX 5: Await all type inserts together so loadBuses() sees them immediately
            await Promise.all(selectedTypes.map(type =>
                apiFetch(`${API}/bustypes`, 'POST', { BusID: newBusId, CategoryName: type })
            ));
            toast('Bus added');
        }
        closeModal('bus-modal');
        document.getElementById('b-bid').disabled = false;
        // FIX 5: loadBuses() now runs only after all inserts are confirmed
        await loadBuses();
        loadDashboard();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deleteBus(id, num) {
    confirmDelete(`Delete bus "${num}"?`, async () => {
        try {
            await apiFetch(`${API}/buses/${id}`, 'DELETE');
            toast('Bus deleted');
            loadBuses();
            loadDashboard();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
async function loadRoutes() {
    setLoading('routes-table');
    try {
        const rows = await apiFetch(`${API}/routes`);
        const tbody = document.querySelector('#routes-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No routes found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.RouteID}</td>
        <td>${r.SourceCity}</td>
        <td>${r.DestinationCity}</td>
        <td>${r.Distance || '—'}</td>
        <td>${r.EstimatedDuration || '—'}</td>
        <td>
          <button class="action-btn" onclick="editRoute(${r.RouteID})">Edit</button>
          <button class="action-btn del" onclick="deleteRoute(${r.RouteID}, '${r.SourceCity}→${r.DestinationCity}')">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading routes: ' + e.message, 'error'); }
}

async function editRoute(id) {
    try {
        const rows = await apiFetch(`${API}/routes`);
        const r = rows.find(x => x.RouteID == id);
        if (!r) return;
        document.getElementById('route-modal-title').textContent = 'Edit Route';
        document.getElementById('r-id').value = r.RouteID;
        document.getElementById('r-rid').value = r.RouteID;
        document.getElementById('r-rid').disabled = true;
        document.getElementById('r-src').value = r.SourceCity || '';
        document.getElementById('r-dst').value = r.DestinationCity || '';
        document.getElementById('r-dist').value = r.Distance || '';
        document.getElementById('r-dur').value = r.EstimatedDuration || '';
        openModal('route-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function openAddRoute() {
    document.getElementById('route-modal-title').textContent = 'Add Route';
    document.getElementById('r-id').value = '';
    document.getElementById('r-rid').value = '';
    document.getElementById('r-rid').disabled = false;
    document.getElementById('r-src').value = '';
    document.getElementById('r-dst').value = '';
    document.getElementById('r-dist').value = '';
    document.getElementById('r-dur').value = '';
    openModal('route-modal');
}

async function saveRoute() {
    const id = document.getElementById('r-id').value;
    const body = {
        RouteID: document.getElementById('r-rid').value || null,
        SourceCity: document.getElementById('r-src').value,
        DestinationCity: document.getElementById('r-dst').value,
        Distance: document.getElementById('r-dist').value,
        EstimatedDuration: document.getElementById('r-dur').value
    };
    try {
        if (id) {
            await apiFetch(`${API}/routes/${id}`, 'PUT', body);
            toast('Route updated');
        } else {
            await apiFetch(`${API}/routes`, 'POST', body);
            toast('Route created');
        }
        closeModal('route-modal');
        document.getElementById('r-id').value = '';
        document.getElementById('r-rid').disabled = false;
        loadRoutes();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deleteRoute(id, label) {
    confirmDelete(`Delete route "${label}"?`, async () => {
        try {
            await apiFetch(`${API}/routes/${id}`, 'DELETE');
            toast('Route deleted');
            loadRoutes();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIPS
// ═══════════════════════════════════════════════════════════════════════════════
async function openAddTrip() {
    document.getElementById('trip-modal-title').textContent = 'Add Trip';
    document.getElementById('tr-id').value = '';
    document.getElementById('tr-tid').value = '';
    document.getElementById('tr-tid').disabled = false;
    document.getElementById('tr-ddate').value = '';
    document.getElementById('tr-dtime').value = '';
    document.getElementById('tr-atime').value = '';
    document.getElementById('tr-fare').value = '';
    await Promise.all([populateDriverBusDropdown(), populateRouteDropdown()]);
    openModal('trip-modal');
}
async function loadTrips() {
    setLoading('trips-table');
    try {
        const rows = await apiFetch(`${API}/trips`);
        const tbody = document.querySelector('#trips-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No trips found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${t.TripID}</td>
        <td>${t.BusNumber || t.BusID}</td>
        <td>${t.SourceCity || '?'} → ${t.DestinationCity || '?'}</td>
        <td>${t.DepartureDate ? t.DepartureDate.split('T')[0] : '—'}</td>
        <td>${t.DepartureTime || '—'}</td>
        <td>${t.ArrivalTime || '—'}</td>
        <td>PKR ${Number(t.Fare || 0).toLocaleString()}</td>
        <td>
          <button class="action-btn" onclick="editTrip(${t.TripID})">Edit</button>
          <button class="action-btn del" onclick="deleteTrip(${t.TripID})">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading trips: ' + e.message, 'error'); }
}

async function editTrip(id) {
    try {
        const rows = await apiFetch(`${API}/trips`);
        const t = rows.find(x => x.TripID == id);
        if (!t) return;
        document.getElementById('trip-modal-title').textContent = 'Edit Trip';
        document.getElementById('tr-id').value = t.TripID;
        document.getElementById('tr-tid').value = t.TripID;
        document.getElementById('tr-tid').disabled = true;
        document.getElementById('tr-ddate').value = t.DepartureDate ? t.DepartureDate.split('T')[0] : '';
        document.getElementById('tr-dtime').value = t.DepartureTime || '';
        document.getElementById('tr-atime').value = t.ArrivalTime || '';
        document.getElementById('tr-fare').value = t.Fare || '';
        await Promise.all([
            populateDriverBusDropdown(t.BusID),
            populateRouteDropdown(t.RouteID)
        ]);
        openModal('trip-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function saveTrip() {
    const id = document.getElementById('tr-id').value;
    const body = {
        TripID: document.getElementById('tr-tid').value || null,
        BusID: document.getElementById('tr-bid').value,
        RouteID: document.getElementById('tr-rid').value,
        DepartureDate: document.getElementById('tr-ddate').value,
        DepartureTime: document.getElementById('tr-dtime').value,
        ArrivalTime: document.getElementById('tr-atime').value,
        Fare: document.getElementById('tr-fare').value
    };
    try {
        if (id) {
            await apiFetch(`${API}/trips/${id}`, 'PUT', body);
            toast('Trip updated');
        } else {
            await apiFetch(`${API}/trips`, 'POST', body);
            toast('Trip created');
        }
        closeModal('trip-modal');
        document.getElementById('tr-id').value = '';
        document.getElementById('tr-tid').disabled = false;
        loadTrips();
        loadDashboard();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deleteTrip(id) {
    confirmDelete(`Delete trip #${id}?`, async () => {
        try {
            await apiFetch(`${API}/trips/${id}`, 'DELETE');
            toast('Trip deleted');
            loadTrips();
            loadDashboard();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadBookings() {
    setLoading('bookings-table');
    try {
        const rows = await apiFetch(`${API}/bookings`);
        const tbody = document.querySelector('#bookings-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No bookings found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(b => `
      <tr>
        <td>${b.BookingID}</td>
        <td>${b.PassengerName || b.PassengerID}</td>
        <td>${b.SourceCity || '?'} → ${b.DestinationCity || '?'}</td>
        <td>${b.DepartureDate ? b.DepartureDate.split('T')[0] : '—'}</td>
        <td>PKR ${Number(b.TotalAmount || 0).toLocaleString()}</td>
        <td>${statusBadge(b.BookingStatus)}</td>
        <td>
          <button class="action-btn" onclick="editBooking(${b.BookingID})">Edit</button>
          <button class="action-btn del" onclick="deleteBooking(${b.BookingID})">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading bookings: ' + e.message, 'error'); }
}

async function populatePassengerDropdown(selectedId = '') {
    try {
        const passengers = await apiFetch(`${API}/passengers`);
        const sel = document.getElementById('bk-pid');
        sel.innerHTML = '<option value="">— Select Passenger —</option>';
        passengers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.PassengerID;
            opt.textContent = `${p.FirstName} ${p.LastName} (${p.Phone || p.CNIC || 'No contact'})`;
            if (p.PassengerID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function populateTripDropdownForBooking(selectedId = '') {
    try {
        const trips = await apiFetch(`${API}/trips`);
        const sel = document.getElementById('bk-tid');
        sel.innerHTML = '<option value="">— Select Trip —</option>';
        trips.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.TripID;
            opt.textContent = `Trip ${t.TripID}: ${t.SourceCity || '?'} → ${t.DestinationCity || '?'} (${t.DepartureDate ? t.DepartureDate.split('T')[0] : ''})`;
            if (t.TripID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function editBooking(id) {
    try {
        const rows = await apiFetch(`${API}/bookings`);
        const b = rows.find(x => x.BookingID == id);
        if (!b) return;
        document.getElementById('booking-modal-title').textContent = 'Edit Booking';
        document.getElementById('bk-id').value = b.BookingID;
        document.getElementById('bk-bid').value = b.BookingID;
        document.getElementById('bk-bid').disabled = true;
        document.getElementById('bk-amt').value = b.TotalAmount || '';
        document.getElementById('bk-status').value = b.BookingStatus || 'Pending';
        await Promise.all([
            populatePassengerDropdown(b.PassengerID),
            populateTripDropdownForBooking(b.TripID)
        ]);
        openModal('booking-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function openAddBooking() {
    document.getElementById('booking-modal-title').textContent = 'Add Booking';
    document.getElementById('bk-id').value = '';
    document.getElementById('bk-bid').value = '';
    document.getElementById('bk-bid').disabled = false;
    document.getElementById('bk-amt').value = '';
    document.getElementById('bk-status').value = 'Pending';
    await Promise.all([populatePassengerDropdown(), populateTripDropdownForBooking()]);
    openModal('booking-modal');
}

async function saveBooking() {
    const id = document.getElementById('bk-id').value;
    const body = {
        BookingID: document.getElementById('bk-bid').value || null,
        PassengerID: document.getElementById('bk-pid').value,
        TripID: document.getElementById('bk-tid').value,
        TotalAmount: document.getElementById('bk-amt').value,
        BookingStatus: document.getElementById('bk-status').value
    };
    try {
        if (id) {
            await apiFetch(`${API}/bookings/${id}`, 'PUT', body);
            toast('Booking updated');
        } else {
            await apiFetch(`${API}/bookings`, 'POST', body);
            toast('Booking created');
        }
        closeModal('booking-modal');
        document.getElementById('bk-id').value = '';
        document.getElementById('bk-bid').disabled = false;
        loadBookings();
        loadDashboard();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deleteBooking(id) {
    confirmDelete(`Delete booking #${id}?`, async () => {
        try {
            await apiFetch(`${API}/bookings/${id}`, 'DELETE');
            toast('Booking deleted');
            loadBookings();
            loadDashboard();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadPayments() {
    setLoading('payments-table');
    try {
        const rows = await apiFetch(`${API}/payments`);
        const tbody = document.querySelector('#payments-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No payments found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(p => `
      <tr>
        <td>${p.PaymentID}</td>
        <td>${p.BookingID}</td>
        <td>${p.PassengerName || '—'}</td>
        <td>${p.PaymentMethod}</td>
        <td>PKR ${Number(p.PaymentAmount || 0).toLocaleString()}</td>
        <td>${statusBadge(p.PaymentStatus)}</td>
        <td>${p.PaymentDate ? new Date(p.PaymentDate).toLocaleDateString() : '—'}</td>
        <td>
          <button class="action-btn" onclick="editPayment(${p.PaymentID})">Edit</button>
          <button class="action-btn del" onclick="deletePayment(${p.PaymentID})">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading payments: ' + e.message, 'error'); }
}

async function populateBookingDropdownForPayment(selectedId = '') {
    try {
        const bookings = await apiFetch(`${API}/bookings`);
        const sel = document.getElementById('py-bid');
        sel.innerHTML = '<option value="">— Select Booking —</option>';
        bookings.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.BookingID;
            opt.textContent = `Booking ${b.BookingID}: ${b.PassengerName || b.PassengerID} (${b.TotalAmount ? 'PKR ' + b.TotalAmount : 'No Fare'})`;
            if (b.BookingID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function editPayment(id) {
    try {
        const rows = await apiFetch(`${API}/payments`);
        const p = rows.find(x => x.PaymentID == id);
        if (!p) return;
        document.getElementById('payment-modal-title').textContent = 'Edit Payment';
        document.getElementById('py-id').value = p.PaymentID;
        document.getElementById('py-pid').value = p.PaymentID;
        document.getElementById('py-pid').disabled = true;
        document.getElementById('py-bid').value = p.BookingID || '';
        document.getElementById('py-bid').disabled = true;
        document.getElementById('py-method').value = p.PaymentMethod || 'Cash';
        document.getElementById('py-amt').value = p.PaymentAmount || '';
        document.getElementById('py-status').value = p.PaymentStatus || 'Pending';
        await populateBookingDropdownForPayment(p.BookingID);
        openModal('payment-modal');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function openAddPayment() {
    document.getElementById('payment-modal-title').textContent = 'Record Payment';
    document.getElementById('py-id').value = '';
    document.getElementById('py-pid').value = '';
    document.getElementById('py-pid').disabled = false;
    document.getElementById('py-bid').disabled = false;
    document.getElementById('py-method').value = 'Cash';
    document.getElementById('py-amt').value = '';
    document.getElementById('py-status').value = 'Pending';
    await populateBookingDropdownForPayment();
    openModal('payment-modal');
}

async function savePayment() {
    const id = document.getElementById('py-id').value;
    const body = {
        PaymentID: document.getElementById('py-pid').value || null,
        BookingID: document.getElementById('py-bid').value,
        PaymentMethod: document.getElementById('py-method').value,
        PaymentAmount: document.getElementById('py-amt').value,
        PaymentStatus: document.getElementById('py-status').value
    };
    try {
        if (id) {
            await apiFetch(`${API}/payments/${id}`, 'PUT', body);
            toast('Payment updated');
        } else {
            await apiFetch(`${API}/payments`, 'POST', body);
            toast('Payment recorded');
        }
        closeModal('payment-modal');
        document.getElementById('py-id').value = '';
        document.getElementById('py-pid').disabled = false;
        document.getElementById('py-bid').disabled = false;
        loadPayments();
        loadBookings(); // Sync booking section automatically
        loadDashboard();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deletePayment(id) {
    confirmDelete(`Delete payment #${id}?`, async () => {
        try {
            await apiFetch(`${API}/payments/${id}`, 'DELETE');
            toast('Payment deleted');
            loadPayments();
            loadDashboard();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadTickets() {
    setLoading('tickets-table');
    try {
        const rows = await apiFetch(`${API}/tickets`);
        const tbody = document.querySelector('#tickets-table tbody');
        if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No tickets found</div></td></tr>`; return; }
        tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${t.TicketID}</td>
        <td>${t.TicketNumber}</td>
        <td>${t.PassengerName || '—'}</td>
        <td>${t.SourceCity || '?'} → ${t.DestinationCity || '?'}</td>
        <td>${t.BusNumber || '—'}</td>
        <td>${t.SeatNumber || '—'}</td>
        <td>${t.IssueDate ? new Date(t.IssueDate).toLocaleDateString() : '—'}</td>
        <td>
          <button class="action-btn del" onclick="deleteTicket(${t.TicketID}, '${t.TicketNumber}')">Del</button>
        </td>
      </tr>`).join('');
    } catch (e) { toast('Error loading tickets: ' + e.message, 'error'); }
}

async function populateSeatDropdown(bookingId = '') {
    try {
        const url = bookingId ? `${API}/seats?bookingId=${bookingId}` : `${API}/seats`;
        const seats = await apiFetch(url);
        const sel = document.getElementById('tk-sid');
        sel.innerHTML = '<option value="">— Select Available Seat —</option>';
        seats.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.SeatID;
            opt.textContent = `Bus ${s.BusNumber || '?'} - ${s.SeatNumber} (${s.SeatType || 'Standard'})`;
            sel.appendChild(opt);
        });
        if (!seats.length) {
            sel.innerHTML = '<option value="">No seats available for this trip</option>';
        }
    } catch (e) { /* silently fail */ }
}

async function updateTicketSeats() {
    const bid = document.getElementById('tk-bid').value;
    if (bid) {
        populateSeatDropdown(bid);
    } else {
        document.getElementById('tk-sid').innerHTML = '<option value="">— Select Booking First —</option>';
    }
}

async function populateBookingDropdownForTicket(selectedId = '') {
    try {
        const bookings = await apiFetch(`${API}/bookings`);
        const sel = document.getElementById('tk-bid');
        sel.innerHTML = '<option value="">— Select Booking —</option>';
        bookings.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.BookingID;
            opt.textContent = `Booking ${b.BookingID}: ${b.PassengerName || b.PassengerID} (${b.TotalAmount ? 'PKR ' + b.TotalAmount : 'No Fare'})`;
            if (b.BookingID == selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) { /* silently fail */ }
}

async function openAddTicket() {
    document.getElementById('tk-tid').value = '';
    document.getElementById('tk-bid').value = '';
    document.getElementById('tk-sid').innerHTML = '<option value="">— Select Booking First —</option>';
    document.getElementById('tk-num').value = '';
    await populateBookingDropdownForTicket();
    openModal('ticket-modal');
}

async function saveTicket() {
    const body = {
        TicketID: document.getElementById('tk-tid').value || null,
        BookingID: document.getElementById('tk-bid').value,
        SeatID: document.getElementById('tk-sid').value,
        TicketNumber: document.getElementById('tk-num').value
    };
    if (!body.BookingID || !body.SeatID || !body.TicketNumber) {
        toast('Please fill all required ticket fields', 'error');
        return;
    }
    try {
        await apiFetch(`${API}/tickets`, 'POST', body);
        toast('Ticket issued');
        closeModal('ticket-modal');
        loadTickets();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function deleteTicket(id, num) {
    confirmDelete(`Delete ticket "${num}"?`, async () => {
        try {
            await apiFetch(`${API}/tickets/${id}`, 'DELETE');
            toast('Ticket deleted');
            loadTickets();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
    });
}

// ── Section → loader map ──────────────────────────────────────────────────────
const loaders = {
    dashboard: loadDashboard,
    passengers: loadPassengers,
    staff: loadStaff,
    buses: loadBuses,
    routes: loadRoutes,
    trips: loadTrips,
    bookings: loadBookings,
    payments: loadPayments,
    tickets: loadTickets
};

// ── Init ──────────────────────────────────────────────────────────────────────
loadDashboard();