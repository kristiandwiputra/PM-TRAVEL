import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, BusFront, Check, ChevronDown, CircleHelp, Clock3,
  Compass, Gauge, LayoutDashboard, ListFilter, LogOut, MapPin,
  Menu, Navigation, RadioTower, RefreshCw, Route, Search, Settings2,
  Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, WifiOff, X,
} from 'lucide-react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ApiError, getProfile, loadDashboard, login, REFRESH_INTERVAL_MS } from './api'
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
  html: '<span class="pm-vehicle-marker-inner" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2m8-2v2M9 6h6"/><circle cx="8.5" cy="15" r="1"/><circle cx="15.5" cy="15" r="1"/></svg></span>',
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
  if (!trip?.eta || trip.eta.status === 'unavailable') return 'Belum tersedia'
  const value = trip.eta.eta_minutes ?? trip.eta.minutes
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? `${Math.round(Number(value))} menit`
    : 'Belum tersedia'
}

function StatusPill({ children, tone = 'mint' }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}

function PageHeader({ title, subtitle, connected = false, loading = false }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">RUANG OPERASIONAL <span>/ LAMPUNG</span></p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <StatusPill tone={loading ? 'amber' : connected ? 'mint' : 'rose'}>
        {loading ? 'Menghubungkan...' : connected ? 'Sistem terhubung' : 'Koneksi terputus'}
      </StatusPill>
    </div>
  )
}

function StatCard({ icon: Icon, tone, value, label, detail }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-top">
        <span className={`stat-icon stat-icon--${tone}`}><Icon size={21} /></span>
        <span className="stat-caption">RINGKASAN</span>
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
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 40],
        maxZoom: 11,
      })
    }
    // Hanya initial fit; fokus pengguna tidak diganggu ketika API refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

function VehicleList({ vehicles, selectedId, onSelect, search, setSearch, filter, setFilter, connected, loading }) {
  return (
    <div className="vehicle-list-panel">
      <div className="panel-heading">
        <div><h3>Armada Anda <span className="count-badge">{vehicles.length}</span></h3><span>Pilih kendaraan untuk melihat detail</span></div>
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
            aria-pressed={filter === item}
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
            aria-pressed={selectedId === vehicle.id}
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
          <div className="empty-list">{loading ? <LoaderCircle size={28} className="spin" /> : <BusFront size={28} />}<strong>{loading ? 'Memuat armada...' : search || filter !== 'Semua' ? 'Kendaraan tidak ditemukan' : 'Belum ada kendaraan'}</strong><p>{search || filter !== 'Semua' ? 'Coba kata kunci atau filter lainnya.' : 'Kendaraan yang tersedia akan muncul di sini.'}</p></div>
        )}
      </div>
      <div className={`qa-note ${connected ? 'qa-note--connected' : ''}`}>
        {connected ? <ShieldCheck size={17} /> : <WifiOff size={17} />}
        <span>{connected
          ? 'Data armada diperbarui otomatis setiap 5 detik.'
          : 'Koneksi terputus. Menampilkan data terakhir yang tersedia.'}</span>
      </div>
    </div>
  )
}

function LiveMap({ vehicles, selectedVehicle, focusKey, targets, children }) {
  const points = [routeOrigin, ...(targets.length ? targets : defaultTargets)]
  return (
    <div className="map-shell">
      <div className="map-canvas">
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
        <span><i className="legend-pin" /> Posisi kendaraan</span>
        <span><i className="legend-origin" /> Titik awal</span>
        <span><i className="legend-target" /> Target</span>
      </div>
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
        title="Dashboard armada"
        subtitle="Setiap kendaraan, setiap perjalanan. Semua dalam pantauan."
        connected={sync.connected}
        loading={sync.loading}
      />
      <WarningBanner message={warning} />

      <div className="stats-grid">
        <StatCard icon={BusFront} tone="teal" value={sync.loading ? '—' : vehicles.length} label="Total kendaraan" detail="Armada yang terdaftar" />
        <StatCard icon={Route} tone="blue" value={sync.loading ? '—' : activeTripCount} label="Perjalanan aktif" detail="Perjalanan yang sedang berlangsung" />
        <StatCard icon={Navigation} tone="amber" value={sync.loading ? '—' : freshCount} label="GPS terkini" detail="Usia posisi ≤ 30 detik" />
        <StatCard icon={Clock3} tone="rose" value="—" label="Estimasi tiba" detail="Prediksi waktu belum tersedia" />
      </div>

      <div className="content-toolbar">
        <div className="section-title">
          <div className="section-icon"><MapPin size={20} /></div>
          <div>
            <h2>Pantauan langsung</h2>
            <p>{data.checkedAt ? `Terakhir diperiksa ${formatTime(data.checkedAt)}` : 'Menunggu pembaruan pertama'}</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <button className="outline-button" type="button" onClick={onRefresh} disabled={sync.loading}>
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

      <div className="corridor-bar"><span><Route size={15} />KORIDOR LAMPUNG</span><div>Tanjung Karang <ChevronDown size={13} /> Hajimena <ChevronDown size={13} /> Kotabumi</div></div>
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
          loading={sync.loading}
        />
      </LiveMap>
      <p className="route-footnote">
        Garis putus-putus hanya menghubungkan titik referensi koridor, <strong>bukan rute jalan</strong>.
        {targets.length ? ' Titik tujuan mengikuti konfigurasi operasional.' : ' Titik tujuan menggunakan referensi awal.'}
      </p>

      <div className="detail-grid">
        <div className="detail-card">
          <div className="detail-card-title"><Gauge size={20} /><h3>Informasi Kendaraan</h3></div>
          <div className="detail-body">
            <div><span>Kendaraan</span><strong>{selectedVehicle?.plate ?? '—'}</strong></div>
            <div><span>Status GPS</span><strong>{selectedVehicle ? statusText[selectedVehicle.locationStatus] ?? selectedVehicle.locationStatus : '—'}</strong></div>
            <div><span>Kecepatan</span><strong>{formatSpeed(selectedVehicle?.speed)}</strong></div>
            <div><span>Koordinat valid terakhir</span><strong>{formatPosition(selectedVehicle?.position)}</strong></div>
            <div><span>Waktu posisi GPS</span><strong>{formatTime(selectedVehicle?.observedAt)}</strong></div>
            <div><span>Data diterima</span><strong>{formatTime(selectedVehicle?.receivedAt)}</strong></div>
            <div><span>ETA ke tujuan</span><strong>{etaLabel(trips, selectedVehicle?.id)}</strong></div>
          </div>
        </div>
        <div className="detail-card">
          <div className="detail-card-title"><RadioTower size={20} /><h3>Koneksi & pembaruan</h3></div>
          <div className="integration-status">
            <StatusPill tone={sync.connected ? 'mint' : 'rose'}>
              {sync.loading ? 'Menghubungkan...' : sync.connected ? 'Siap memantau perjalanan' : 'Menunggu koneksi kembali'}
            </StatusPill>
            <p>
              Data kendaraan mengikuti posisi GPS yang diterima server. Status GPS terkini
              menunjukkan usia data; status perjalanan tersedia di menu Perjalanan.
            </p>
            <button className="text-button" onClick={() => onNavigate('Pengaturan')} type="button">
              Lihat pengaturan <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function SecondaryPage({ page, data, sync }) {
  const descriptions = {
    Kendaraan: 'Kenali armada dan lihat status lokasi terakhirnya.',
    Perjalanan: 'Ikuti perjalanan armada dan ketersediaan estimasi tiba.',
    Pengaturan: 'Informasi koneksi dan preferensi ruang operasional.',
  }
  const headings = page === 'Kendaraan'
    ? ['Plat kendaraan', 'Nama kendaraan', 'Status GPS', 'Waktu posisi terakhir']
    : page === 'Perjalanan'
      ? ['ID perjalanan', 'Kendaraan', 'Status perjalanan', 'Estimasi tiba']
      : ['Pengaturan', 'Nilai', 'Status', 'Keterangan']
  const rows = page === 'Kendaraan'
    ? data.vehicles.map((item) => [item.plate, item.name, statusText[item.locationStatus] ?? item.locationStatus, formatTime(item.observedAt)])
    : page === 'Perjalanan'
      ? data.trips.map((item) => [item.id, data.vehicles.find((vehicle) => vehicle.id === item.vehicleId)?.plate ?? item.vehicleId ?? '—', ({ active: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan', planned: 'Terjadwal' })[item.status] ?? item.status, etaLabel(data.trips, item.vehicleId)])
      : [
        ['Koneksi server', sync.loading ? 'Menghubungkan' : sync.connected ? 'Terhubung' : 'Terputus', 'Otomatis', 'Dashboard mengambil data dari server operasional'],
        ['Pembaruan dashboard', 'Setiap 5 detik', 'Otomatis', 'Posisi berubah ketika data GPS baru diterima'],
        ['Zona waktu', 'Asia/Jakarta', 'WIB', 'Seluruh waktu mengikuti waktu Indonesia barat'],
        ['Estimasi tiba', 'Belum tersedia', 'Menunggu integrasi', 'Prediksi akan ditampilkan ketika tersedia'],
        ['Sesi akun', 'Aktif', 'Terautentikasi', 'Keluar atau muat ulang halaman untuk mengakhiri sesi'],
      ]
  return (
    <>
      <PageHeader title={page} subtitle={descriptions[page]} connected={sync.connected} loading={sync.loading} />
      <WarningBanner message={sync.error || data.warning} />
      <div className="secondary-card">
        <div className="secondary-banner">
          <Activity size={26} />
          <div>
            <h2>{page === 'Pengaturan' ? 'Preferensi operasional' : `Daftar ${page.toLowerCase()}`}</h2>
            <p>{page === 'Pengaturan' ? 'Informasi sistem yang digunakan untuk memantau armada Anda.' : 'Data terbaru sesuai akses akun Anda.'}</p>
          </div>
        </div>
        <div className="simple-table-wrap">
          <table className="simple-table">
            <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
            <tbody>{rows.length ? rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`}>{row.map((value, cell) => <td key={`${cell}-${value}`}>{value}</td>)}</tr>
            )) : <tr><td colSpan="4">{sync.loading ? 'Memuat data...' : 'Belum ada data yang tersedia.'}</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand--light' : ''}`} aria-label="PM-TRAVEL"><span className="brand-icon"><Navigation size={23} strokeWidth={2.4} /></span><span>pm<span className="brand-word">travel</span><span className="brand-period">.</span></span></div>
}

function RouteIllustration() {
  return (
    <div className="route-illustration" role="img" aria-label="Ilustrasi koridor Tanjung Karang, Hajimena, Kotabumi">
      <div className="illustration-grid" />
      <svg className="route-drawing" viewBox="0 0 540 280" fill="none" aria-hidden="true">
        <path className="map-street" d="M-20 90 150 140 245 65 400 100 560 30M0 250 180 175 330 235 550 170M105-20 160 110 100 290M365-20 310 125 390 300" />
        <path d="M75 211C155 225 139 122 242 139S316 51 429 69" stroke="#d6f28d" strokeWidth="3" strokeDasharray="7 9" strokeLinecap="round" />
        <circle cx="75" cy="211" r="16" fill="#d6f28d" fillOpacity=".13" /><circle cx="75" cy="211" r="6" fill="#d6f28d" stroke="#234d3e" strokeWidth="3" />
        <circle cx="242" cy="139" r="15" fill="#d6f28d" fillOpacity=".13" /><circle cx="242" cy="139" r="6" fill="#d6f28d" stroke="#234d3e" strokeWidth="3" />
        <circle cx="429" cy="69" r="19" fill="#d6f28d" fillOpacity=".13" /><circle cx="429" cy="69" r="7" fill="#d6f28d" stroke="#234d3e" strokeWidth="3" />
        <text x="38" y="250">Tanjung Karang</text><text x="210" y="177">Hajimena</text><text x="399" y="109">Kotabumi</text>
      </svg>
      <div className="illustration-vehicle"><BusFront size={23} /></div>
      <div className="illustration-label"><span><Route size={14} />KORIDOR LAMPUNG</span><small>Ilustrasi perjalanan</small></div>
      <span className="map-compass" aria-hidden="true"><Navigation size={18} />N</span>
    </div>
  )
}

function LoginPage({ onLogin, busy, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event) => {
    event.preventDefault()
    if (!busy && email.trim() && password) onLogin(email.trim(), password)
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="login-story-title">
        <Brand light />
        <div className="login-story-content">
          <span className="story-tag"><i />TRAVEL MONITORING SYSTEM</span>
          <h1 id="login-story-title">Setiap perjalanan,<br />dalam <span>pantauan.</span></h1>
          <p>Lebih dekat dengan armada Anda. Pantau lokasi, ikuti perjalanan, dan kelola operasional dalam satu tempat.</p>
          <RouteIllustration />
          <div className="story-features"><span><Check size={15} />Lokasi kendaraan</span><span><Check size={15} />Status perjalanan</span><span><Check size={15} />Pembaruan otomatis</span></div>
        </div>
        <div className="login-story-footer"><span>Terhubung di setiap perjalanan.</span><span>Lampung, Indonesia <ArrowUpRight size={13} /></span></div>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="mobile-login-brand"><Brand /></div>
        <div className="login-card">
          <span className="login-welcome-icon"><LockKeyhole size={24} /></span>
          <p className="eyebrow">SELAMAT DATANG KEMBALI</p>
          <h2 id="login-title">Masuk ke ruang<br />operasional Anda.</h2>
          <p className="login-description">Gunakan akun admin atau operator untuk mulai memantau armada.</p>
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <div className="form-field"><label htmlFor="login-user">Alamat email</label><div className="input-wrap"><Mail size={18} /><input id="login-user" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" required aria-describedby={error ? 'login-error' : undefined} aria-invalid={error ? true : undefined} /></div></div>
              <div className="form-field"><label htmlFor="login-password">Kata sandi</label><div className="input-wrap"><LockKeyhole size={18} /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" required aria-describedby={error ? 'login-error' : undefined} aria-invalid={error ? true : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
              {error && <div id="login-error" className="login-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
              <button type="submit" className="login-submit">{busy ? <><LoaderCircle size={18} className="spin" />Sedang masuk...</> : <>Masuk ke dashboard<ArrowRight size={18} /></>}</button>
            </fieldset>
          </form>
          <div className="login-security"><ShieldCheck size={16} /><span>Akses aman khusus admin dan operator</span></div>
          <div className="login-help"><strong>Belum memiliki akses?</strong><p>Hubungi administrator untuk mendapatkan akun atau bantuan kata sandi.</p></div>
        </div>
        <footer className="login-form-footer">© {new Date().getFullYear()} PM-TRAVEL <span>Sistem Pemantauan Travel</span></footer>
      </section>
    </main>
  )
}

const emptyData = { vehicles: [], trips: [], targets: [], checkedAt: null, warning: '' }

function App() {
  const [token, setToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Semua')
  const [data, setData] = useState(emptyData)
  const [sync, setSync] = useState({ connected: false, loading: true, error: '' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        document.getElementById('navigation-toggle')?.focus()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [menuOpen])

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
            setProfile(null)
            setData(emptyData)
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
      const user = await getProfile(freshToken)
      setProfile(user)
      setPage('Dashboard')
      setMenuOpen(false)
      setSearch('')
      setFilter('Semua')
      setData(emptyData)
      setSync({ connected: false, loading: true, error: '' })
      setToken(freshToken)
    } catch (error) {
      setLoginError(error.status === 401 ? 'Email atau kata sandi belum sesuai. Silakan coba lagi.' : error.message)
    } finally {
      setLoginBusy(false)
    }
  }

  const navigate = (nextPage) => { setPage(nextPage); setMenuOpen(false) }

  if (!token) return <LoginPage onLogin={handleLogin} busy={loginBusy} error={loginError} />

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Langsung ke konten</a>
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className="topbar-region"><MapPin size={14} />Lampung, Indonesia</span>
          <button type="button" className="icon-button" aria-label="Bantuan" onClick={() => navigate('Pengaturan')}><CircleHelp size={20} /></button>
          <span className="header-divider" />
          <div className="user-chip"><span className="avatar">{(profile?.email ?? 'P').slice(0, 1).toUpperCase()}</span><span><strong>{profile?.role === 'admin' ? 'Administrator' : 'Operator'}</strong><small title={profile?.email}>{profile?.email}</small></span></div>
          <button className="logout-button" type="button" aria-label="Keluar dari akun" onClick={() => { setToken(null); setProfile(null); setData(emptyData); setLoginError(''); setMenuOpen(false) }}><LogOut size={16} /> Keluar</button>
          <button id="navigation-toggle" type="button" className="mobile-menu-button" aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>

      <div className="workspace">
        {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
        <aside id="main-navigation" className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar-intro"><span>WORKSPACE</span><strong>Ruang operasional</strong></div>
          <div className="sidebar-label">MENU UTAMA</div>
          <nav aria-label="Navigasi utama">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => navigate(name)}
                className={`nav-item ${page === name ? 'nav-item--active' : ''}`}
                aria-current={page === name ? 'page' : undefined}
              ><Icon size={19} /><span>{name}</span></button>
            ))}
          </nav>
          <div className="sidebar-corridor"><span><Route size={15} />KORIDOR LAMPUNG</span><strong>Tanjung Karang</strong><i /><strong>Hajimena</strong><i /><strong>Kotabumi</strong><small>Terhubung di setiap perjalanan.</small></div>
          <div className="sidebar-bottom">
            <div className="sidebar-status"><span className={`live-dot ${sync.connected ? '' : 'live-dot--offline'}`} /><div><strong>{sync.loading ? 'Menghubungkan...' : sync.connected ? 'Sistem terhubung' : 'Koneksi terputus'}</strong><small>Pembaruan otomatis · 5 detik</small></div></div>
            <div className="sidebar-footer">Satu ruang. Semua perjalanan.<br /><span>PM-TRAVEL · Lampung, Indonesia</span></div>
          </div>
        </aside>

        <main className="main-area" id="main-content" tabIndex={-1}>
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
            <span>© {new Date().getFullYear()} PM-TRAVEL · Sistem Pemantauan Travel</span>
            <span><ShieldCheck size={12} />Ruang operasional armada</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
