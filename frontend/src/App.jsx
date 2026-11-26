import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Ban, BusFront, Check, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Clock3,
  Compass, Copy, Eye, EyeOff, FileText, Gauge, LayoutDashboard, ListFilter, LoaderCircle, LockKeyhole, LogOut, Mail, MapPin,
  Menu, Navigation, Play, Plus, RadioTower, RefreshCw, Route, Search, Settings2, ShieldAlert, ShieldCheck, WifiOff, X, Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ApiError, arriveHajimena, cancelTrip, completeTrip, createTrip, getProfile,
  getPublicTrip, getTrip, getTripPositions, listTrips, loadDashboard, login,
  REFRESH_INTERVAL_MS, startTrip,
} from './api'
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
    <motion.div
      className={`stat-card stat-card--${tone}`}
      whileHover={{ y: -4, boxShadow: '0 8px 20px -4px rgba(34, 62, 40, 0.12)' }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
    >
      <div className="stat-top">
        <span className={`stat-icon stat-icon--${tone}`}><Icon size={21} /></span>
        <span className="stat-caption">RINGKASAN</span>
      </div>
      <strong>{value}</strong>
      <span className="stat-label">{label}</span>
      <small>{detail}</small>
    </motion.div>
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
          <motion.button
            key={vehicle.id}
            type="button"
            className={`vehicle-item ${selectedId === vehicle.id ? 'vehicle-item--selected' : ''}`}
            aria-pressed={selectedId === vehicle.id}
            onClick={() => onSelect(vehicle.id)}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <span className={`vehicle-dot vehicle-dot--${statusTone(vehicle.locationStatus)}`} aria-hidden="true" />
            <span className="vehicle-info">
              <strong>{vehicle.plate}</strong>
              <small>{vehicle.id} • {statusText[vehicle.locationStatus] ?? vehicle.locationStatus}</small>
              <small>{formatSpeed(vehicle.speed)}</small>
            </span>
            <ChevronDown className="vehicle-chevron" size={16} />
          </motion.button>
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

function FloatingPill({ selectedVehicle, onCenter }) {
  const [expanded, setExpanded] = useState(false)

  const status = selectedVehicle?.locationStatus ?? 'no_location'
  const tone = statusTone(status)
  const plate = selectedVehicle?.plate ?? 'PMT-001'
  const speed = selectedVehicle?.speed
  const speedText = speed !== null && speed !== undefined
    ? `${Number(speed).toFixed(1)} km/jam`
    : 'Diam / Parkir'

  const observedAtText = selectedVehicle?.observedAt
    ? formatTime(selectedVehicle.observedAt)
    : 'Belum ada data GPS'

  const positionText = selectedVehicle?.position
    ? `${selectedVehicle.position[0].toFixed(5)}, ${selectedVehicle.position[1].toFixed(5)}`
    : 'Koordinat belum fix'

  return (
    <div className="floating-pill-wrapper">
      <motion.div
        className="floating-pill"
        onClick={() => setExpanded((prev) => !prev)}
        initial={{ opacity: 0, y: -15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Status telemetri IoT kendaraan"
      >
        <span className={`hallmark-pulse-wrapper hallmark-pulse--${tone}`}>
          <motion.span
            className="hallmark-pulse-ring"
            animate={{
              scale: [1, 1.9, 1],
              opacity: [0.75, 0, 0.75],
            }}
            transition={{
              duration: status === 'fresh' ? 2 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <span className="hallmark-pulse-dot" />
        </span>

        <span className="floating-pill-plate">
          <BusFront size={13} />
          {plate}
        </span>

        <span className="floating-pill-divider" aria-hidden="true" />

        <span className="floating-pill-speed">
          <Zap size={12} />
          {speedText}
        </span>

        <span className="floating-pill-divider" aria-hidden="true" />

        <span className="floating-pill-status">
          {statusText[status] ?? status}
        </span>

        <span className="floating-pill-toggle" aria-hidden="true">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="floating-pill-card"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="floating-card-header">
              <div>
                <strong>Telemetri IoT &bull; {plate}</strong>
                <small>Pengiriman ESP32 per 10 detik</small>
              </div>
              <StatusPill tone={tone}>
                {statusText[status] ?? status}
              </StatusPill>
            </div>

            <div className="floating-card-grid">
              <div className="floating-card-item">
                <span>Kecepatan</span>
                <strong>{speedText}</strong>
              </div>
              <div className="floating-card-item">
                <span>Usia GPS</span>
                <strong>{selectedVehicle?.ageSeconds !== null && selectedVehicle?.ageSeconds !== undefined ? `${selectedVehicle.ageSeconds} detik` : '—'}</strong>
              </div>
              <div className="floating-card-item">
                <span>Koordinat</span>
                <strong>{positionText}</strong>
              </div>
              <div className="floating-card-item">
                <span>Waktu GPS</span>
                <strong>{observedAtText}</strong>
              </div>
            </div>

            {selectedVehicle?.position && onCenter && (
              <button
                type="button"
                className="floating-card-action"
                onClick={(e) => {
                  e.stopPropagation()
                  onCenter()
                }}
              >
                <Compass size={14} /> Pusatkan di Peta
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AnimatedVehicleMarker({ vehicle, icon }) {
  const markerRef = useRef(null)
  const posRef = useRef({ lat: vehicle.position[0], lng: vehicle.position[1] })

  useEffect(() => {
    if (!markerRef.current || !vehicle.position) return

    const targetLat = vehicle.position[0]
    const targetLng = vehicle.position[1]

    if (posRef.current.lat !== targetLat || posRef.current.lng !== targetLng) {
      gsap.to(posRef.current, {
        lat: targetLat,
        lng: targetLng,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          if (markerRef.current) {
            markerRef.current.setLatLng([posRef.current.lat, posRef.current.lng])
          }
        },
      })
    }
  }, [vehicle.position])

  return (
    <Marker ref={markerRef} position={vehicle.position} icon={icon}>
      <Popup>
        <strong>{vehicle.plate}</strong>
        <p>{vehicle.name}</p>
        <small>{statusText[vehicle.locationStatus] ?? vehicle.locationStatus}</small>
        <p>{formatPosition(vehicle.position)}</p>
        <small>GPS: {formatTime(vehicle.observedAt)}</small>
      </Popup>
    </Marker>
  )
}

function LiveMap({ vehicles, selectedVehicle, focusKey, targets, onCenter, children }) {
  const [mapType, setMapType] = useState('m')
  const points = [routeOrigin, ...(targets.length ? targets : defaultTargets)]

  const tileConfig = {
    m: {
      name: 'Peta Jalan',
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
    y: {
      name: 'Satelit',
      url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
    p: {
      name: 'Medan',
      url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      maxZoom: 20,
    },
  }

  const activeTile = tileConfig[mapType] || tileConfig.m

  return (
    <div className="map-shell">
      <div className="map-canvas">
        <FloatingPill selectedVehicle={selectedVehicle} onCenter={onCenter} />
        
        <div className="map-layer-selector">
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'm' ? 'map-layer-btn--active' : ''}`}
            onClick={() => setMapType('m')}
            title="Tampilan Peta Jalan Google Maps (Warna jalan & tol)"
          >
            Peta Jalan
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'y' ? 'map-layer-btn--active' : ''}`}
            onClick={() => setMapType('y')}
            title="Tampilan Satelit & Jalan Google Maps"
          >
            Satelit
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'p' ? 'map-layer-btn--active' : ''}`}
            onClick={() => setMapType('p')}
            title="Tampilan Topografi & Kontur"
          >
            Medan
          </button>
        </div>

        <MapContainer
          center={[-5.17, 105.04]}
          zoom={10}
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={120}
          wheelDebounceTime={40}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          zoomAnimation={true}
          className="travel-map"
        >
          <TileLayer
            key={mapType}
            attribution="&copy; Google Maps"
            url={activeTile.url}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={activeTile.maxZoom}
          />
          <FitRoute points={points} />
          {points.map((point, index) => (
            <CircleMarker
              key={`${point.name}-${index}`}
              center={point.position}
              radius={index === 0 ? 8 : 7}
              pathOptions={{
                color: index === 0 ? '#c86b2f' : '#1e6b52',
                fillColor: index === 0 ? '#ff9a47' : '#4bb38c',
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>{point.name}</Tooltip>
              <Popup>{index === 0 ? 'Titik awal referensi' : 'Titik singgah rute'}: {point.name}</Popup>
            </CircleMarker>
          ))}
          {vehicles.filter((vehicle) => vehicle.position).map((vehicle) => (
            <AnimatedVehicleMarker key={vehicle.id} vehicle={vehicle} icon={vehicleIcon} />
          ))}
          {selectedVehicle?.position && <FocusMap position={selectedVehicle.position} focusKey={focusKey} />}
        </MapContainer>
        <div className="map-legend" aria-label="Legenda peta">
          <span><i className="legend-pin" /> Posisi kendaraan (Real-time)</span>
          <span><i className="legend-origin" /> Titik awal</span>
          <span><i className="legend-target" /> Titik singgah</span>
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
        subtitle="Pemantauan posisi armada dan telemetri IoT rute koridor Lampung."
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

      <div className="corridor-bar"><span><Route size={15} />KORIDOR LAMPUNG</span><div>Tanjung Karang <ArrowRight size={13} /> Hajimena <ArrowRight size={13} /> Kotabumi</div></div>
      <LiveMap
        vehicles={vehicles}
        selectedVehicle={selectedVehicle}
        focusKey={focusKey}
        targets={targets}
        onCenter={() => setFocusKey((key) => key + 1)}
      >
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

function BottomTabBar({ activePage, onNavigate }) {
  return (
    <nav className="bottom-tab-bar" aria-label="Navigasi cepat ponsel">
      {navigation.map(({ name, icon: Icon }) => {
        const isActive = activePage === name
        return (
          <motion.button
            key={name}
            type="button"
            className={`bottom-tab-item ${isActive ? 'bottom-tab-item--active' : ''}`}
            onClick={() => onNavigate(name)}
            whileTap={{ scale: 0.9 }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-tab-icon-wrap">
              <Icon size={19} />
              {isActive && (
                <motion.span
                  className="bottom-tab-pill-indicator"
                  layoutId="bottomTabIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
            </span>
            <span className="bottom-tab-label">{name}</span>
          </motion.button>
        )
      })}
    </nav>
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

function TripStatusPill({ status }) {
  if (status === 'active') return <StatusPill tone="mint">Berlangsung</StatusPill>
  if (status === 'planned') return <span className="status-pill status-pill--blue">Terjadwal</span>
  if (status === 'completed') return <span className="status-pill status-pill--mint">Selesai</span>
  if (status === 'canceled') return <span className="status-pill status-pill--slate">Dibatalkan</span>
  return <StatusPill tone="amber">{status}</StatusPill>
}

function TripDetailModal({ trip, token, onClose, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(trip)
  const [positions, setPositions] = useState([])
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    async function loadData() {
      try {
        const [tripData, posData] = await Promise.all([
          getTrip(token, trip.trip_id),
          getTripPositions(token, trip.trip_id).catch(() => []),
        ])
        if (active) {
          setDetail(tripData)
          setPositions(posData || [])
        }
      } catch (err) {
        if (active) {
          if (err.status === 403 || err.status === 404) {
            setError('Akses ditolak: Anda tidak memiliki izin atau kendaraan ini di luar kewenangan akun Anda (Otorisasi backend ditegakkan).')
          } else {
            setError(err.message || 'Gagal memuat detail perjalanan.')
          }
        }
      }
    }
    loadData()
    return () => { active = false }
  }, [trip.trip_id, token])

  const handleStart = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await startTrip(token, detail.trip_id)
      setSuccessInfo(res)
      setDetail((prev) => ({ ...prev, status: 'active', started_at: new Date().toISOString() }))
      onUpdated()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setError('Akses ditolak: Tidak dapat memulai perjalanan untuk kendaraan ini.')
      } else {
        setError(err.message || 'Gagal memulai perjalanan.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleArriveHajimena = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await arriveHajimena(token, detail.trip_id)
      setDetail((prev) => ({ ...prev, arrived_hajimena_at: res.arrived_hajimena_at }))
      onUpdated()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setError('Akses ditolak: Tidak dapat mencatat kedatangan Hajimena.')
      } else {
        setError(err.message || 'Gagal mencatat kedatangan Hajimena.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await completeTrip(token, detail.trip_id)
      setDetail((prev) => ({ ...prev, status: 'completed', ended_at: res.ended_at }))
      onUpdated()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setError('Akses ditolak: Tidak dapat menyelesaikan perjalanan.')
      } else {
        setError(err.message || 'Gagal menyelesaikan perjalanan.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan perjalanan ini?')) return
    setLoading(true)
    setError('')
    try {
      const res = await cancelTrip(token, detail.trip_id)
      setDetail((prev) => ({ ...prev, status: 'canceled', ended_at: res.ended_at }))
      onUpdated()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setError('Akses ditolak: Tidak dapat membatalkan perjalanan.')
      } else {
        setError(err.message || 'Gagal membatalkan perjalanan.')
      }
    } finally {
      setLoading(false)
    }
  }

  const copyPublicLink = (code) => {
    const url = `${window.location.origin}/?trip=${encodeURIComponent(code)}`
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="trip-modal-overlay" onClick={onClose}>
      <div className="trip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trip-modal-header">
          <h2>
            <FileText size={20} />
            <span>Detail & Kontrol Perjalanan</span>
          </h2>
          <button type="button" className="trip-modal-close" onClick={onClose} aria-label="Tutup modal">
            <X size={20} />
          </button>
        </div>

        <div className="trip-modal-body">
          {error && (
            <div className="access-denied-box">
              <ShieldAlert size={22} />
              <div>{error}</div>
            </div>
          )}

          {successInfo?.public_code && (
            <div className="public-token-callout">
              <div className="public-token-callout-header">
                <div>
                  <strong style={{ fontSize: '13px', color: '#17422c' }}>Kode Pelacakan Penumpang:</strong>
                  <div style={{ marginTop: '4px' }}>
                    <span className="public-token-code">{successInfo.public_code}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="public-token-copy-btn"
                  onClick={() => copyPublicLink(successInfo.public_code)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Tersalin!' : 'Salin Tautan'}</span>
                </button>
              </div>
              <p className="public-token-warning">
                Bagikan tautan pelacakan ini kepada penumpang. Kode ini hanya dibuat satu kali dan akan otomatis dicabut saat armada tiba & perjalanan diselesaikan di Kotabumi demi menjaga privasi.
              </p>
            </div>
          )}

          <div className="trip-info-grid">
            <div className="trip-info-item">
              <span>ID Perjalanan</span>
              <strong className="trip-id-cell">{detail.trip_id}</strong>
            </div>
            <div className="trip-info-item">
              <span>Kendaraan</span>
              <span className="trip-plate-badge">{detail.plate_number || trip.plate_number || '—'}</span>
            </div>
            <div className="trip-info-item">
              <span>Status Perjalanan</span>
              <div><TripStatusPill status={detail.status} /></div>
            </div>
            <div className="trip-info-item">
              <span>Waktu Mulai</span>
              <strong>{formatTime(detail.started_at)}</strong>
            </div>
            <div className="trip-info-item">
              <span>Kedatangan Hajimena</span>
              <strong>{detail.arrived_hajimena_at ? `Tiba: ${formatTime(detail.arrived_hajimena_at)}` : 'Belum tiba'}</strong>
            </div>
            <div className="trip-info-item">
              <span>Waktu Selesai (Kotabumi)</span>
              <strong>{formatTime(detail.ended_at)}</strong>
            </div>
          </div>

          <div className="trip-controls-card">
            <span className="trip-controls-title">Kontrol Alur Perjalanan (Operator)</span>
            <div className="trip-controls-actions">
              {detail.status === 'planned' && (
                <button
                  type="button"
                  className="trip-btn-action trip-btn-action--start"
                  onClick={handleStart}
                  disabled={loading}
                >
                  <Play size={15} />
                  <span>Mulai Perjalanan</span>
                </button>
              )}

              {detail.status === 'active' && !detail.arrived_hajimena_at && (
                <button
                  type="button"
                  className="trip-btn-action trip-btn-action--arrive"
                  onClick={handleArriveHajimena}
                  disabled={loading}
                >
                  <MapPin size={15} />
                  <span>Catat Tiba di Hajimena</span>
                </button>
              )}

              {detail.status === 'active' && detail.arrived_hajimena_at && (
                <button
                  type="button"
                  className="trip-btn-action trip-btn-action--complete"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  <CheckCircle2 size={15} />
                  <span>Selesaikan di Kotabumi (Akhiri Trip)</span>
                </button>
              )}

              {['planned', 'active'].includes(detail.status) && (
                <button
                  type="button"
                  className="trip-btn-action trip-btn-action--cancel"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <Ban size={15} />
                  <span>Batalkan</span>
                </button>
              )}

              {detail.status === 'completed' && (
                <span style={{ fontSize: '12px', color: '#276b42', fontWeight: 600 }}>
                  Perjalanan telah selesai di Kotabumi. Kode publik penumpang telah dinonaktifkan.
                </span>
              )}
            </div>
          </div>

          <div className="trip-modal-section">
            <h3 className="trip-modal-section-title">Riwayat Titik Telemetri GPS ({positions.length} titik)</h3>
            <div className="trip-table-wrap" style={{ maxHeight: '200px' }}>
              <table className="trip-positions-table">
                <thead>
                  <tr>
                    <th>Waktu Pengamatan (WIB)</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Kecepatan</th>
                    <th>Status GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length ? (
                    positions.map((pos, idx) => (
                      <tr key={pos.id ?? idx}>
                        <td>{formatTime(pos.observed_at)}</td>
                        <td>{pos.latitude != null ? Number(pos.latitude).toFixed(6) : '—'}</td>
                        <td>{pos.longitude != null ? Number(pos.longitude).toFixed(6) : '—'}</td>
                        <td>{pos.speed_kmh != null ? `${pos.speed_kmh} km/jam` : '—'}</td>
                        <td>
                          <StatusPill tone={pos.gps_valid ? 'mint' : 'rose'}>
                            {pos.gps_valid ? 'Valid' : 'Invalid'}
                          </StatusPill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#63796d' }}>
                        Belum ada riwayat koordinat GPS untuk perjalanan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateTripModal({ token, vehicles, onClose, onCreated }) {
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedVehicle) return
    setBusy(true)
    setError('')
    try {
      await createTrip(token, selectedVehicle)
      onCreated()
      onClose()
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setError('Akses ditolak: Anda tidak memiliki wewenang untuk kendaraan ini.')
      } else {
        setError(err.message || 'Gagal membuat perjalanan baru.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="trip-modal-overlay" onClick={onClose}>
      <div className="trip-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="trip-modal-header">
          <h2>
            <Plus size={20} />
            <span>Buat Perjalanan Baru</span>
          </h2>
          <button type="button" className="trip-modal-close" onClick={onClose} aria-label="Tutup modal">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="trip-modal-body">
          {error && (
            <div className="access-denied-box">
              <ShieldAlert size={20} />
              <div>{error}</div>
            </div>
          )}
          <div className="create-trip-form">
            <div className="create-trip-field">
              <label htmlFor="vehicle-select">Pilih Kendaraan Armada</label>
              <select
                id="vehicle-select"
                className="create-trip-select"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                disabled={busy}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} — {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="create-trip-field">
              <label>Rute & Koridor</label>
              <div style={{ fontSize: '13px', color: '#2b503e', background: '#f5faf3', padding: '10px 14px', borderRadius: '8px', border: '1px solid #dce8d6' }}>
                <strong>Koridor Lampung</strong>: Tanjung Karang ➔ Hajimena ➔ Kotabumi
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="outline-button" onClick={onClose} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="trip-create-btn" disabled={busy || !selectedVehicle}>
              {busy ? 'Menyimpan...' : 'Simpan Perjalanan (Planned)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TripManagementPage({ token, vehicles = [], onTripUpdated }) {
  const [trips, setTrips] = useState([])
  const [filter, setFilter] = useState('Semua')
  const [loading, setLoading] = useState(true)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [errorBanner, setErrorBanner] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setErrorBanner('')
      try {
        const data = await listTrips(token, { status: filter })
        if (active) setTrips(data)
      } catch (err) {
        if (active) {
          if (err.status === 403) {
            setErrorBanner('Akses ditolak: Akun Anda tidak memiliki hak membaca riwayat perjalanan ini.')
          } else {
            setErrorBanner(err.message || 'Gagal memuat daftar perjalanan.')
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [filter, token, refreshTrigger])

  const counts = useMemo(() => {
    return {
      Semua: trips.length,
      active: trips.filter((t) => t.status === 'active').length,
      planned: trips.filter((t) => t.status === 'planned').length,
      completed: trips.filter((t) => t.status === 'completed').length,
      canceled: trips.filter((t) => t.status === 'canceled').length,
    }
  }, [trips])

  return (
    <>
      <PageHeader
        title="Riwayat & Manajemen Perjalanan"
        subtitle="Pantau riwayat armada, kelola siklus trip, dan catat progres kedatangan koridor Lampung."
        connected={true}
        loading={loading}
      />
      {errorBanner && (
        <div className="access-denied-box" style={{ marginBottom: '18px' }}>
          <ShieldAlert size={20} />
          <div>{errorBanner}</div>
        </div>
      )}

      <div className="trip-management-card">
        <div className="trip-toolbar">
          <div className="trip-filter-tabs">
            {['Semua', 'active', 'planned', 'completed', 'canceled'].map((st) => {
              const label = {
                Semua: 'Semua',
                active: 'Berlangsung',
                planned: 'Terjadwal',
                completed: 'Selesai',
                canceled: 'Dibatalkan',
              }[st]
              return (
                <button
                  key={st}
                  type="button"
                  className={`trip-filter-tab ${filter === st ? 'trip-filter-tab--active' : ''}`}
                  onClick={() => setFilter(st)}
                >
                  <span>{label}</span>
                  {counts[st] != null && <span className="trip-filter-count">{counts[st]}</span>}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="trip-create-btn"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} />
            <span>Buat Trip Baru</span>
          </button>
        </div>

        <div className="trip-table-wrap">
          <table className="trip-table">
            <thead>
              <tr>
                <th scope="col">ID Perjalanan</th>
                <th scope="col">Kendaraan</th>
                <th scope="col">Status Perjalanan</th>
                <th scope="col">Progres Koridor</th>
                <th scope="col">Waktu Mulai</th>
                <th scope="col">Waktu Selesai</th>
                <th scope="col" style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && !trips.length ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#63796d' }}>
                    <LoaderCircle size={22} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Memuat riwayat perjalanan...</div>
                  </td>
                </tr>
              ) : trips.length ? (
                trips.map((trip) => {
                  const vehicleObj = vehicles.find((v) => v.id === trip.vehicle_id)
                  const plateText = trip.plate_number !== '—' ? trip.plate_number : vehicleObj?.plate || trip.vehicle_id || '—'
                  return (
                    <tr key={trip.trip_id}>
                      <td className="trip-id-cell">{trip.trip_id}</td>
                      <td>
                        <span className="trip-plate-badge">{plateText}</span>
                      </td>
                      <td>
                        <TripStatusPill status={trip.status} />
                      </td>
                      <td>
                        <div className="trip-corridor-flow">
                          <span>Tg. Karang</span>
                          <span className="trip-corridor-arrow">➔</span>
                          <strong style={{ color: trip.arrived_hajimena_at ? '#2d784c' : 'inherit' }}>
                            {trip.arrived_hajimena_at ? 'Hajimena (Tiba)' : 'Hajimena'}
                          </strong>
                          <span className="trip-corridor-arrow">➔</span>
                          <span>Kotabumi</span>
                        </div>
                      </td>
                      <td>{formatTime(trip.started_at)}</td>
                      <td>{formatTime(trip.ended_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="trip-detail-btn"
                          onClick={() => setSelectedTrip(trip)}
                        >
                          <Settings2 size={13} />
                          <span>Kelola / Detail</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#63796d' }}>
                    Tidak ada perjalanan yang sesuai dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          token={token}
          onClose={() => setSelectedTrip(null)}
          onUpdated={() => {
            setRefreshTrigger((k) => k + 1)
            onTripUpdated?.()
          }}
        />
      )}

      {showCreate && (
        <CreateTripModal
          token={token}
          vehicles={vehicles}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setRefreshTrigger((k) => k + 1)
            onTripUpdated?.()
          }}
        />
      )}
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

function PassengerTrackPage({ code, onBack }) {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusKey, setFocusKey] = useState(0)

  useEffect(() => {
    let active = true
    async function fetchTrip() {
      try {
        const result = await getPublicTrip(code)
        if (active) {
          setTrip(result)
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Kode perjalanan tidak berlaku atau perjalanan telah selesai.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchTrip()
    const timer = setInterval(fetchTrip, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [code])

  if (loading && !trip) {
    return (
      <div className="passenger-shell">
        <header className="passenger-topbar">
          <Brand />
          <button type="button" className="outline-button" onClick={onBack}>
            <LogOut size={15} /> Kembali
          </button>
        </header>
        <main className="passenger-main">
          <div className="empty-list" style={{ marginTop: '60px' }}>
            <LoaderCircle size={36} className="spin" />
            <strong>Menghubungkan ke perjalanan...</strong>
            <p>Mencari koordinat dan status perjalanan aktif.</p>
          </div>
        </main>
      </div>
    )
  }

  if (error && !trip) {
    return (
      <div className="passenger-shell">
        <header className="passenger-topbar">
          <Brand />
          <button type="button" className="outline-button" onClick={onBack}>
            <LogOut size={15} /> Masuk Akun
          </button>
        </header>
        <main className="passenger-main">
          <div className="passenger-error-card">
            <span className="passenger-error-icon">
              <AlertTriangle size={28} />
            </span>
            <h3>Perjalanan Tidak Tersedia</h3>
            <p>{error}</p>
            <button type="button" className="floating-card-action" onClick={onBack} style={{ marginTop: '10px' }}>
              Coba Kode Lain
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (trip?.status === 'completed' || trip?.status === 'canceled') {
    return (
      <div className="passenger-shell">
        <header className="passenger-topbar">
          <Brand />
          <button type="button" className="outline-button" onClick={onBack}>
            <LogOut size={15} /> Kembali
          </button>
        </header>
        <main className="passenger-main">
          <div className="passenger-error-card">
            <span className="passenger-error-icon" style={{ background: '#eaf5eb', color: '#276b42' }}>
              <CheckCircle2 size={28} />
            </span>
            <h3>Perjalanan Telah Selesai</h3>
            <p>
              Armada telah tiba di tujuan akhir (Kotabumi) dan perjalanan telah resmi diselesaikan. Sesuai kebijakan privasi, kode akses publik untuk perjalanan ini telah dinonaktifkan.
            </p>
            <button type="button" className="floating-card-action" onClick={onBack} style={{ marginTop: '10px' }}>
              Kembali ke Menu Utama
            </button>
          </div>
        </main>
      </div>
    )
  }

  const vehiclePosition = trip?.position?.latitude !== null && trip?.position?.latitude !== undefined
    && trip?.position?.longitude !== null && trip?.position?.longitude !== undefined
    ? [trip.position.latitude, trip.position.longitude]
    : null

  const vehicleObj = {
    id: 'passenger-active-trip',
    plate: 'Armada Travel',
    name: 'Kendaraan Perjalanan',
    speed: trip?.position?.speed_kmh,
    position: vehiclePosition,
    locationStatus: trip?.position?.location_status ?? 'no_location',
    observedAt: trip?.position?.observed_at,
    receivedAt: trip?.position?.received_at,
    ageSeconds: trip?.position?.data_age_seconds,
  }

  const targets = (trip?.targets ?? []).map((t) => ({
    name: t.name,
    position: [t.latitude, t.longitude],
    sequence: t.sequence_no,
    remainingMeters: t.remaining_straight_line_m,
    eta: t.eta,
  }))

  return (
    <div className="passenger-shell">
      <header className="passenger-topbar">
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="passenger-badge">
            <ShieldCheck size={14} /> MODE PENUMPANG
          </span>
          <button type="button" className="outline-button" onClick={onBack}>
            <LogOut size={15} /> Ganti Kode
          </button>
        </div>
      </header>

      <main className="passenger-main">
        <div className="passenger-hero">
          <h1>Pelacakan Perjalanan Langsung</h1>
          <p>
            Rute koridor Lampung &bull; Tanjung Karang ➔ Hajimena ➔ Kotabumi &bull; Data live dari alat IoT
          </p>
        </div>

        <div className="corridor-bar">
          <span><Route size={15} />STATUS PERJALANAN</span>
          <div>
            Status: <strong>{trip?.status === 'active' ? 'Sedang Berlangsung' : trip?.status}</strong>
            &bull; Waktu Berangkat: {formatTime(trip?.started_at)}
          </div>
        </div>

        <LiveMap
          vehicles={vehiclePosition ? [vehicleObj] : []}
          selectedVehicle={vehicleObj}
          focusKey={focusKey}
          targets={targets}
          onCenter={() => setFocusKey((k) => k + 1)}
        />

        <div className="passenger-targets-grid">
          {targets.map((target) => (
            <div key={target.name} className="passenger-target-card">
              <div className="passenger-target-header">
                <strong>Target: {target.name}</strong>
                <StatusPill tone={target.name === 'Hajimena' && trip?.arrived_hajimena_at ? 'mint' : 'amber'}>
                  {target.name === 'Hajimena' && trip?.arrived_hajimena_at ? 'Sudah Tiba' : 'Menuju Titik'}
                </StatusPill>
              </div>
              <div className="passenger-target-stats">
                <div className="passenger-target-stat">
                  <span>Sisa Jarak Garis Lurus</span>
                  <strong>
                    {target.remainingMeters !== null && target.remainingMeters !== undefined
                      ? `${(target.remainingMeters / 1000).toFixed(1)} km`
                      : '—'}
                  </strong>
                </div>
                <div className="passenger-target-stat">
                  <span>Estimasi Tiba (ETA)</span>
                  <strong>Belum tersedia (PM_15)</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function LoginPage({ onLogin, busy, error, onTrackTrip }) {
  const [mode, setMode] = useState('operator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tripCode, setTripCode] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (mode === 'operator') {
      if (!busy && email.trim() && password) onLogin(email.trim(), password)
    } else {
      if (tripCode.trim() && onTrackTrip) onTrackTrip(tripCode.trim())
    }
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
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              className={`login-tab-button ${mode === 'operator' ? 'login-tab-button--active' : ''}`}
              onClick={() => setMode('operator')}
            >
              <LockKeyhole size={14} /> Operator / Admin
            </button>
            <button
              type="button"
              className={`login-tab-button ${mode === 'passenger' ? 'login-tab-button--active' : ''}`}
              onClick={() => setMode('passenger')}
            >
              <Route size={14} /> Lacak Penumpang
            </button>
          </div>

          <span className="login-welcome-icon"><LockKeyhole size={24} /></span>
          <p className="eyebrow">{mode === 'operator' ? 'SELAMAT DATANG KEMBALI' : 'PELACAKAN PENUMPANG'}</p>
          <h2 id="login-title">
            {mode === 'operator' ? 'Masuk ke ruang operasional Anda.' : 'Lacak perjalanan tiket Anda.'}
          </h2>
          <p className="login-description">
            {mode === 'operator'
              ? 'Gunakan akun admin atau operator untuk mulai memantau armada.'
              : 'Masukkan kode perjalanan yang diberikan pihak travel tanpa perlu login.'}
          </p>

          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              {mode === 'operator' ? (
                <>
                  <div className="form-field"><label htmlFor="login-user">Alamat email</label><div className="input-wrap"><Mail size={18} /><input id="login-user" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" required aria-describedby={error ? 'login-error' : undefined} aria-invalid={error ? true : undefined} /></div></div>
                  <div className="form-field"><label htmlFor="login-password">Kata sandi</label><div className="input-wrap"><LockKeyhole size={18} /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" required aria-describedby={error ? 'login-error' : undefined} aria-invalid={error ? true : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                  {error && <div id="login-error" className="login-error" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>}
                  <button type="submit" className="login-submit">{busy ? <><LoaderCircle size={18} className="spin" />Sedang masuk...</> : <>Masuk ke dashboard<ArrowRight size={18} /></>}</button>
                </>
              ) : (
                <>
                  <div className="form-field"><label htmlFor="trip-code-input">Kode perjalanan unik</label><div className="input-wrap"><Route size={18} /><input id="trip-code-input" name="code" type="text" autoCapitalize="none" spellCheck={false} value={tripCode} onChange={(event) => setTripCode(event.target.value)} placeholder="Masukkan kode trip travel Anda..." required /></div></div>
                  <button type="submit" className="login-submit">Lacak Perjalanan Sekarang <ArrowRight size={18} /></button>
                </>
              )}
            </fieldset>
          </form>
          <div className="login-security"><ShieldCheck size={16} /><span>{mode === 'operator' ? 'Akses aman khusus admin dan operator' : 'Akses publik aman khusus perjalanan aktif'}</span></div>
          <div className="login-help">
            <strong>{mode === 'operator' ? 'Belum memiliki akses?' : 'Cara mendapatkan kode?'}</strong>
            <p>{mode === 'operator' ? 'Hubungi administrator untuk mendapatkan akun atau bantuan kata sandi.' : 'Kode perjalanan tertera pada struk pemesanan tiket atau dibagikan oleh operator travel Anda.'}</p>
          </div>
        </div>
        <footer className="login-form-footer">© {new Date().getFullYear()} PM-TRAVEL <span>Sistem Pemantauan Travel</span></footer>
      </section>
    </main>
  )
}

const emptyData = { vehicles: [], trips: [], targets: [], checkedAt: null, warning: '' }

function App() {
  const [passengerCode, setPassengerCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('trip') || params.get('code') || ''
  })
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

  if (passengerCode) {
    return (
      <PassengerTrackPage
        code={passengerCode}
        onBack={() => {
          setPassengerCode('')
          window.history.replaceState({}, '', window.location.pathname)
        }}
      />
    )
  }

  if (!token) {
    return (
      <LoginPage
        onLogin={handleLogin}
        busy={loginBusy}
        error={loginError}
        onTrackTrip={(code) => {
          setPassengerCode(code)
          window.history.replaceState({}, '', `?trip=${encodeURIComponent(code)}`)
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Langsung ke konten</a>
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
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
          <div className="sidebar-corridor"><span><Route size={15} />KORIDOR LAMPUNG</span><strong>Tanjung Karang</strong><i /><strong>Hajimena</strong><i /><strong>Kotabumi</strong></div>
          <div className="sidebar-bottom">
            <div className="sidebar-status"><span className={`live-dot ${sync.connected ? '' : 'live-dot--offline'}`} /><div><strong>{sync.loading ? 'Menghubungkan...' : sync.connected ? 'Sistem terhubung' : 'Koneksi terputus'}</strong><small>Pembaruan otomatis · 5 detik</small></div></div>
          </div>
        </aside>

        <main className="main-area" id="main-content" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
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
              ) : page === 'Perjalanan' ? (
                <TripManagementPage
                  token={token}
                  vehicles={data.vehicles}
                  onTripUpdated={() => setRefreshKey((key) => key + 1)}
                />
              ) : <SecondaryPage page={page} data={data} sync={sync} />}
            </motion.div>
          </AnimatePresence>
          <footer className="site-footer">
            <span>© {new Date().getFullYear()} PM-TRAVEL · Sistem Pemantauan Travel</span>
            <span><ShieldCheck size={12} />Ruang operasional armada</span>
          </footer>
        </main>
      </div>
      <BottomTabBar activePage={page} onNavigate={navigate} />
    </div>
  )
}

export default App
