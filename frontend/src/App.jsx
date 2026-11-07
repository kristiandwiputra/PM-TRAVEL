import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, BusFront, ChevronDown, CircleHelp, Clock3,
  Compass, Gauge, LayoutDashboard, ListFilter, LogOut, MapPin,
  Menu, Navigation, RadioTower, RefreshCw, Route, Search, Settings2,
  ShieldCheck, WifiOff, X,
} from 'lucide-react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ApiError, loadDashboard, login, REFRESH_INTERVAL_MS } from './api'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Titik awal referensi Tanjung Karang (sekitar Stasiun Tanjung Karang).
// Titik naik resmi kendaraan harus diverifikasi oleh operator di lapangan.
const routeOrigin = { name: 'Tanjung Karang', position: [-5.40885, 105.26011] }
const defaultTargets = [
  { name: 'Hajimena', position: [-5.3619361, 105.2253941] },
  { name: 'Kotabumi', position: [-4.8351362, 104.8962439] },
]

const vehicleIcon = L.divIcon({
  className: 'pm-vehicle-marker',
  html: '<span class="pm-vehicle-marker-inner" aria-hidden="true">🚐</span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
})

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Pemantauan', icon: MapPin },
  { name: 'Kendaraan', icon: BusFront },
  { name: 'Perjalanan', icon: Route },
  { name: 'Pengaturan', icon: Settings2 },
]

const statusText = {
  fresh: 'GPS segar',
  stale: 'GPS terlambat',
  no_update: 'Tidak ada pembaruan',
  no_location: 'Belum ada lokasi',
  invalid_timestamp: 'Waktu GPS tidak valid',
}

function statusTone(status) {
  if (status === 'fresh') return 'mint'
  if (status === 'stale') return 'amber'
  return 'rose'
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waktu tidak valid'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

function formatSpeed(speed) {
  return speed === null || speed === undefined ? '—' : `${Number(speed).toFixed(1)} km/jam`
}

function formatPosition(position) {
  return position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Belum tersedia'
}

function etaLabel(trips, vehicleId) {
  const trip = trips.find((item) => item.vehicleId === vehicleId && item.status === 'active')
  if (!trip?.eta || trip.eta.status === 'unavailable') return 'Belum tersedia (PM_15)'
  const value = trip.eta.eta_minutes ?? trip.eta.minutes
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? `${Math.round(Number(value))} menit`
    : 'Belum tersedia (PM_15)'
}

function StatusPill({ children, tone = 'mint' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

function PageHeader({ title, subtitle, connected = false, loading = false }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">OPERASIONAL TRAVEL</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <StatusPill tone={loading ? 'amber' : connected ? 'mint' : 'rose'}>
        {loading ? 'Membaca API...' : connected ? 'API PM_10 terhubung' : 'API terputus'}
      </StatusPill>
    </div>
  )
}

function StatCard({ icon: Icon, tone, value, label, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className={`stat-icon stat-icon--${tone}`}><Icon size={21} /></span>
        <span className="stat-spark" aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <span className="stat-label">{label}</span>
      <small>{detail}</small>
    </div>
  )
}

function FocusMap({ position, focusKey }) {
  const map = useMap()
  const latitude = position?.[0]
  const longitude = position?.[1]
  useEffect(() => {
    if (focusKey > 0 && latitude !== undefined && longitude !== undefined) {
      map.flyTo([latitude, longitude], 13, { duration: 0.8 })
    }
  }, [focusKey, latitude, longitude, map])
  return null
}

function FitRoute({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) {
      map.fitBounds(L.latLngBounds(points.map((point) => point.position)), {
        paddingTopLeft: [20, 25],
        paddingBottomRight: [85, 25],
        maxZoom: 11,
      })
    }
    // Hanya initial fit; fokus pengguna tidak diganggu ketika API refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

function VehicleList({ vehicles, selectedId, onSelect, search, setSearch, filter, setFilter, connected }) {
  return (
    <div className="vehicle-list-panel">
      <div className="panel-heading">
        <div><h3>Daftar Travel</h3><span>Data kendaraan dari API PM_10</span></div>
        <ListFilter size={19} />
      </div>
      <label className="fleet-search">
        <Search size={17} />
        <input
          aria-label="Cari kendaraan"
          placeholder="Cari plat atau kendaraan..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="filter-row" role="group" aria-label="Filter kendaraan">
        {['Semua', 'GPS segar'].map((item) => (
          <button
            key={item}
            type="button"
            className={`filter-chip ${filter === item ? 'is-selected' : ''}`}
            onClick={() => setFilter(item)}
          >{item}</button>
        ))}
      </div>
      <div className="vehicle-items">
        {vehicles.length ? vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            className={`vehicle-item ${selectedId === vehicle.id ? 'vehicle-item--selected' : ''}`}
            onClick={() => onSelect(vehicle.id)}
          >
            <span className={`vehicle-dot vehicle-dot--${statusTone(vehicle.locationStatus)}`} aria-hidden="true" />
            <span className="vehicle-info">
              <strong>{vehicle.plate}</strong>
              <small>{vehicle.id} • {statusText[vehicle.locationStatus] ?? vehicle.locationStatus}</small>
              <small>{formatSpeed(vehicle.speed)}</small>
            </span>
            <ChevronDown className="vehicle-chevron" size={16} />
          </button>
        )) : (
          <div className="empty-list"><Search size={22} /><p>Belum ada kendaraan atau tidak cocok dengan filter.</p></div>
        )}
      </div>
      <div className={`qa-note ${connected ? 'qa-note--connected' : ''}`}>
        {connected ? <ShieldCheck size={17} /> : <WifiOff size={17} />}
        <span>{connected
          ? 'Data dibaca dari backend. Pastikan sendiri apakah baris GPS berasal dari alat atau pengujian QA.'
          : 'Belum dapat mengambil data baru. Posisi lama, jika ada, ditampilkan sebagai data terakhir.'}</span>
      </div>
    </div>
  )
}

function LiveMap({ vehicles, selectedVehicle, focusKey, targets, children }) {
  const points = [routeOrigin, ...(targets.length ? targets : defaultTargets)]
  return (
    <div className="map-shell">
      <MapContainer center={[-5.17, 105.04]} zoom={10} scrollWheelZoom={false} className="travel-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitRoute points={points} />
        <Polyline
          positions={points.map((point) => point.position)}
          pathOptions={{ color: '#229c89', weight: 3, opacity: 0.75, dashArray: '8, 8' }}
        />
        {points.map((point, index) => (
          <CircleMarker
            key={`${point.name}-${index}`}
            center={point.position}
            radius={index === 0 ? 10 : 8}
            pathOptions={{
              color: index === 0 ? '#d97735' : '#0b736a',
              fillColor: index === 0 ? '#ffb267' : '#35c2b1',
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Tooltip direction="top" offset={[0, -11]} permanent>{point.name}</Tooltip>
            <Popup>{index === 0 ? 'Titik awal referensi' : 'Target perjalanan'}: {point.name}</Popup>
          </CircleMarker>
        ))}
        {vehicles.filter((vehicle) => vehicle.position).map((vehicle) => (
          <Marker key={vehicle.id} position={vehicle.position} icon={vehicleIcon}>
            <Popup>
              <strong>{vehicle.plate}</strong>
              <p>{vehicle.name}</p>
              <small>{statusText[vehicle.locationStatus] ?? vehicle.locationStatus}</small>
              <p>{formatPosition(vehicle.position)}</p>
              <small>GPS: {formatTime(vehicle.observedAt)}</small>
            </Popup>
          </Marker>
        ))}
        {selectedVehicle?.position && <FocusMap position={selectedVehicle.position} focusKey={focusKey} />}
      </MapContainer>
      <div className="map-legend" aria-label="Legenda peta">
        <span><i className="legend-pin" /> Posisi GPS API</span>
        <span><i className="legend-origin" /> Titik awal</span>
        <span><i className="legend-target" /> Target</span>
      </div>
      {children}
    </div>
  )
}

function WarningBanner({ message }) {
  if (!message) return null
  return <div className="api-warning" role="status"><AlertTriangle size={18} />{message}</div>
}

function Dashboard({ data, sync, onRefresh, onNavigate, search, setSearch, filter, setFilter }) {
  const [selectedId, setSelectedId] = useState(null)
  const [focusKey, setFocusKey] = useState(0)
  const { vehicles, trips, targets } = data
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0] ?? null
  const visibleVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const matchSearch = `${vehicle.plate} ${vehicle.id} ${vehicle.name}`.toLowerCase()
      .includes(search.toLowerCase().trim())
    return matchSearch && (filter === 'Semua' || vehicle.locationStatus === 'fresh')
  }), [vehicles, search, filter])
  const freshCount = vehicles.filter((vehicle) => vehicle.locationStatus === 'fresh').length
  const activeTripCount = trips.filter((trip) => trip.status === 'active').length
  const warning = sync.error || data.warning

  return (
    <>
      <PageHeader
        title="Live Fleet"
        subtitle="Pemantauan kendaraan berbasis GPS, perjalanan, dan status pengiriman data."
        connected={sync.connected}
        loading={sync.loading}
      />
      <WarningBanner message={warning} />

      <div className="stats-grid">
        <StatCard icon={BusFront} tone="teal" value={vehicles.length} label="Kendaraan terdaftar" detail="Dari API kendaraan" />
        <StatCard icon={Route} tone="blue" value={activeTripCount} label="Perjalanan aktif" detail="Status active di PM_10" />
        <StatCard icon={Navigation} tone="amber" value={freshCount} label="GPS segar" detail="Usia posisi ≤30 detik" />
        <StatCard icon={Clock3} tone="rose" value="—" label="Estimasi tiba" detail="Menunggu model PM_15" />
      </div>

      <div className="content-toolbar">
        <div className="section-title">
          <div className="section-icon"><MapPin size={20} /></div>
          <div>
            <h2>Pemantauan Lokasi</h2>
            <p>API PM_10 • terakhir diperiksa: {formatTime(data.checkedAt)} • refresh 5 detik</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <button className="outline-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} /> Perbarui
          </button>
          <button
            className="outline-button"
            type="button"
            disabled={!selectedVehicle?.position}
            onClick={() => setFocusKey((key) => key + 1)}
          >
            <Compass size={17} /> Pusatkan kendaraan
          </button>
        </div>
      </div>

      <LiveMap vehicles={vehicles} selectedVehicle={selectedVehicle} focusKey={focusKey} targets={targets}>
        <VehicleList
          vehicles={visibleVehicles}
          selectedId={selectedVehicle?.id}
          onSelect={(id) => { setSelectedId(id); setFocusKey((key) => key + 1) }}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          connected={sync.connected}
        />
      </LiveMap>
      <p className="route-footnote">
        Garis putus-putus hanya menghubungkan titik referensi koridor, <strong>bukan rute jalan</strong>.
        {targets.length ? ' Target Hajimena/Kotabumi diambil dari konfigurasi API.' : ' Koordinat target memakai referensi awal sampai konfigurasi API tersedia.'}
      </p>

      <div className="detail-grid">
        <div className="detail-card">
          <div className="detail-card-title"><Gauge size={20} /><h3>Informasi Kendaraan</h3></div>
          <div className="detail-body">
            <div><span>Kendaraan</span><strong>{selectedVehicle?.plate ?? '—'}</strong></div>
            <div><span>Status GPS</span><strong>{selectedVehicle ? statusText[selectedVehicle.locationStatus] ?? selectedVehicle.locationStatus : '—'}</strong></div>
            <div><span>Kecepatan</span><strong>{formatSpeed(selectedVehicle?.speed)}</strong></div>
            <div><span>Koordinat valid terakhir</span><strong>{formatPosition(selectedVehicle?.position)}</strong></div>
            <div><span>Waktu GPS (observed_at)</span><strong>{formatTime(selectedVehicle?.observedAt)}</strong></div>
            <div><span>Waktu diterima backend</span><strong>{formatTime(selectedVehicle?.receivedAt)}</strong></div>
            <div><span>ETA ke tujuan</span><strong>{etaLabel(trips, selectedVehicle?.id)}</strong></div>
          </div>
        </div>
        <div className="detail-card">
          <div className="detail-card-title"><RadioTower size={20} /><h3>Status Integrasi</h3></div>
          <div className="integration-status">
            <StatusPill tone={sync.connected ? 'mint' : 'rose'}>
              {sync.connected ? 'Berhasil membaca API' : 'Koneksi API bermasalah'}
            </StatusPill>
            <p>
              Data berasal dari backend PM_10. Status GPS "segar" tidak otomatis membuktikan
              bahwa kendaraan sedang dalam perjalanan; cek trip dan sumber telemetri di backend.
            </p>
            <button className="text-button" onClick={() => onNavigate('Pengaturan')} type="button">
              Lihat koneksi API <Navigation size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function SecondaryPage({ page, data, sync }) {
  const rows = page === 'Kendaraan'
    ? data.vehicles.map((item) => [item.plate, item.id, statusText[item.locationStatus] ?? item.locationStatus, formatTime(item.observedAt)])
    : page === 'Perjalanan'
      ? data.trips.map((item) => [item.id, item.vehicleId ?? '—', item.status, etaLabel(data.trips, item.vehicleId)])
      : [
        ['Endpoint API', '/api (proxy Vite → backend)', 'Baca saja', 'Tidak menyimpan token'],
        ['Polling', '5 detik', 'Browser aktif', 'Tidak menambah frekuensi GPS alat'],
        ['ETA', 'PM_15', 'Belum terhubung', 'Tidak dibuat-buat'],
      ]
  return (
    <>
      <PageHeader title={page} subtitle="Informasi backend PM_10 tanpa pengubahan data." connected={sync.connected} loading={sync.loading} />
      <WarningBanner message={sync.error || data.warning} />
      <div className="secondary-card">
        <div className="secondary-banner">
          <Activity size={26} />
          <div>
            <h2>{page === 'Pengaturan' ? 'Pengaturan integrasi PM_12' : `Data ${page.toLowerCase()} dari backend`}</h2>
            <p>Permintaan menggunakan JWT operator/admin dan mematuhi hak akses PM_10.</p>
          </div>
        </div>
        <div className="simple-table-wrap">
          <table className="simple-table">
            <thead><tr><th>Nama / ID</th><th>Referensi</th><th>Status / Sumber</th><th>Keterangan</th></tr></thead>
            <tbody>{rows.length ? rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`}>{row.map((value, cell) => <td key={`${cell}-${value}`}>{value}</td>)}</tr>
            )) : <tr><td colSpan="4">Belum ada data yang bisa ditampilkan dari API.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function LoginPage({ onLogin, busy, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (email.trim() && password) onLogin(email.trim(), password)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon"><MapPin size={29} /></div>
        <p className="eyebrow">PM-TRAVEL • PM_12</p>
        <h1>Panel Operator</h1>
        <p>Masuk dengan akun admin/operator PM_10 untuk membaca data lokasi asli dari backend.</p>
        <form onSubmit={submit}>
          <label htmlFor="login-user">Email admin / operator</label>
          <input id="login-user" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@contoh.com" required />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <div className="login-error" role="alert"><AlertTriangle size={16} />{error}</div>}
          <button type="submit" className="login-submit" disabled={busy}>{busy ? 'Menghubungkan...' : 'Masuk ke dashboard'}</button>
        </form>
        <small>Token hanya disimpan di memori browser, hilang ketika halaman dimuat ulang.</small>
      </div>
    </div>
  )
}

const emptyData = { vehicles: [], trips: [], targets: [], checkedAt: null, warning: '' }

function App() {
  const [token, setToken] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState('Pemantauan')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Semua')
  const [data, setData] = useState(emptyData)
  const [sync, setSync] = useState({ connected: false, loading: true, error: '' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!token) return undefined
    let disposed = false
    let inFlight = false

    async function refresh() {
      if (inFlight) return
      inFlight = true
      try {
        const payload = await loadDashboard(token)
        if (!disposed) {
          setData(payload)
          setSync({ connected: true, loading: false, error: '' })
        }
      } catch (error) {
        if (!disposed) {
          if (error instanceof ApiError && error.status === 401) {
            setToken(null)
            setLoginError('Sesi berakhir atau tidak memiliki izin. Silakan masuk kembali.')
          } else {
            setSync({ connected: false, loading: false, error: error.message })
          }
        }
      } finally {
        inFlight = false
      }
    }

    void refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => { disposed = true; clearInterval(interval) }
  }, [token, refreshKey])

  const handleLogin = async (email, password) => {
    setLoginBusy(true)
    setLoginError('')
    try {
      const freshToken = await login(email, password)
      setData(emptyData)
      setSync({ connected: false, loading: true, error: '' })
      setToken(freshToken)
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginBusy(false)
    }
  }

  const navigate = (nextPage) => { setPage(nextPage); setMenuOpen(false) }

  if (!token) return <LoginPage onLogin={handleLogin} busy={loginBusy} error={loginError} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon"><MapPin size={20} fill="currentColor" /></span>
          <span>PM<span>TRAVEL</span></span>
        </div>
        <div className="topbar-right">
          <StatusPill>PM_12 • Operator</StatusPill>
          <button type="button" className="icon-button" aria-label="Bantuan" onClick={() => navigate('Pengaturan')}><CircleHelp size={20} /></button>
          <span className="header-divider" />
          <div className="user-chip"><span className="avatar">P</span><span><strong>Operator PM_10</strong><small>Sesi login aktif</small></span></div>
          <button className="logout-button" type="button" onClick={() => { setToken(null); setData(emptyData); setLoginError('') }}><LogOut size={16} /> Keluar</button>
          <button type="button" className="mobile-menu-button" aria-label="Buka navigasi" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar-label">MENU UTAMA</div>
          <nav aria-label="Navigasi utama">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => navigate(name)}
                className={`nav-item ${page === name ? 'nav-item--active' : ''}`}
              ><Icon size={19} /><span>{name}</span></button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-status"><span className={`live-dot ${sync.connected ? '' : 'live-dot--offline'}`} /><div><strong>{sync.connected ? 'API terhubung' : 'API belum terhubung'}</strong><small>Refresh otomatis 5 detik</small></div></div>
            <div className="sidebar-footer">PM-TRAVEL<br /><span>Travel Monitoring System</span></div>
          </div>
        </aside>

        <main className="main-area">
          {['Pemantauan', 'Dashboard'].includes(page) ? (
            <Dashboard
              data={data}
              sync={sync}
              onRefresh={() => setRefreshKey((key) => key + 1)}
              onNavigate={navigate}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
            />
          ) : <SecondaryPage page={page} data={data} sync={sync} />}
          <footer className="site-footer">
            <span>© 2026 PM-TRAVEL • Proyek Mandiri</span>
            <span>Data aktual API / kemungkinan data QA lokal • Bukan sistem produksi</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
