// PM_12: pembacaan kontrak PM_10, tanpa data GPS simulasi atau perubahan database.
// Browser memakai /api melalui proxy Vite (dev) / Nginx (produksi).
const API_PREFIX = '/api'
const TIMEOUT_MS = 10000

// Dashboard memeriksa API setiap 5 detik; GPS hanya berubah jika perangkat
// mengirim pesan baru. Permintaan ganda dicegah oleh flag inFlight di App.jsx.
export const REFRESH_INTERVAL_MS = 5000

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(result, status) {
  if (typeof result?.detail === 'string') return result.detail
  if (typeof result?.message === 'string') return result.message
  if (status === 401) return 'Sesi tidak berlaku. Silakan masuk kembali.'
  if (status === 403) return 'Akun tidak diizinkan membaca data ini.'
  return `Permintaan API gagal (HTTP ${status}).`
}

async function request(path, { token, method = 'GET', body, form = false } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: body === undefined ? undefined : form ? body.toString() : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let result = null
    if (text) {
      try {
        result = JSON.parse(text)
      } catch {
        if (response.ok) throw new ApiError('Backend mengembalikan data bukan JSON.', response.status)
      }
    }
    if (!response.ok) throw new ApiError(errorMessage(result, response.status), response.status)
    return result
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError('Backend tidak merespons dalam 10 detik.')
    if (error instanceof ApiError) throw error
    throw new ApiError('Tidak dapat menghubungi backend. Periksa FastAPI dan proxy Vite.')
  } finally {
    clearTimeout(timeout)
  }
}

export async function login(email, password) {
  // Sesuai OpenAPI PM_10: LoginRequest = { email, password } (application/json).
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  const token = response?.access_token ?? response?.token
  if (typeof token !== 'string' || !token) {
    throw new ApiError('Respons login tidak memuat access_token. Periksa kontrak PM_10.')
  }
  return token
}

export function getProfile(token) {
  return request('/auth/me', { token })
}

function asList(value, names) {
  if (Array.isArray(value)) return value
  for (const name of [...names, 'items', 'results', 'data']) {
    if (Array.isArray(value?.[name])) return value[name]
  }
  return []
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function coordinateOf(value) {
  if (value == null) return null
  if (Array.isArray(value)) {
    if (value.length < 2) return null
    const latitude = numeric(value[0])
    const longitude = numeric(value[1])
    return latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180 ? [latitude, longitude] : null
  }
  let latitude = numeric(value.latitude ?? value.lat)
  let longitude = numeric(value.longitude ?? value.lng ?? value.lon)
  if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    longitude ??= numeric(value.coordinates[0])
    latitude ??= numeric(value.coordinates[1])
  }
  if (latitude === null || longitude === null) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return [latitude, longitude]
}

function normalizeVehicle(raw) {
  const id = raw.vehicle_id ?? raw.id ?? raw.device_id
  if (id === null || id === undefined) return null
  return {
    id: String(id),
    deviceId: raw.device_id ?? null,
    plate: raw.plate_number ?? raw.license_plate ?? raw.plate ?? raw.registration_number ?? 'Belum ada plat',
    name: raw.display_name ?? raw.name ?? raw.label ?? `Kendaraan ${id}`,
    assignedStatus: raw.status ?? null,
    position: null,
    speed: null,
    locationStatus: 'no_location',
    observedAt: null,
    receivedAt: null,
    ageSeconds: null,
  }
}

function normalizeLocation(raw, vehicle) {
  const outer = raw ?? {}
  const candidate = outer.latest_location ?? outer.location ?? outer.last_location
    ?? outer.position ?? outer.last_valid_position ?? outer
  const location = typeof candidate === 'object' && candidate !== null ? candidate : outer
  const position = coordinateOf(location) ?? coordinateOf(location.position)
    ?? coordinateOf(outer) ?? coordinateOf(outer.position)
  const observedAt = location.observed_at ?? location.last_observed_at
    ?? outer.observed_at ?? outer.last_observed_at ?? null
  const receivedAt = location.received_at ?? location.last_seen
    ?? outer.received_at ?? outer.last_seen ?? null
  const ageSeconds = numeric(location.data_age_seconds ?? outer.data_age_seconds
    ?? location.age_seconds ?? location.location_age_seconds
    ?? outer.age_seconds ?? outer.location_age_seconds)
  const backendStatus = location.location_status ?? outer.location_status
  let locationStatus = backendStatus ?? 'no_location'

  // Kontrak menyebut usia dihitung dari observed_at (bukan waktu pesan diterima).
  if (!backendStatus && position && observedAt) {
    const ageFromGps = (Date.now() - new Date(observedAt).getTime()) / 1000
    if (Number.isFinite(ageFromGps) && ageFromGps >= 0) {
      locationStatus = ageFromGps <= 30 ? 'fresh' : ageFromGps <= 60 ? 'stale' : 'no_update'
    } else {
      locationStatus = 'invalid_timestamp'
    }
  }
  if (!position) locationStatus = 'no_location'

  return {
    ...vehicle,
    position,
    speed: numeric(location.speed_kmh ?? location.speed ?? outer.speed_kmh),
    observedAt,
    receivedAt,
    lastSeenAt: location.last_seen_at ?? outer.last_seen_at ?? location.last_seen ?? outer.last_seen ?? receivedAt,
    gpsStatus: location.gps_status ?? outer.gps_status ?? 'no_data',
    ageSeconds,
    locationStatus,
  }
}

function normalizeTrip(raw) {
  const id = raw.trip_id ?? raw.id
  return {
    id: id === null || id === undefined ? '—' : String(id),
    vehicleId: raw.vehicle_id === null || raw.vehicle_id === undefined ? null : String(raw.vehicle_id),
    status: String(raw.status ?? 'unknown'),
    eta: raw.eta_prediction ?? raw.eta ?? null,
  }
}

function normalizeTarget(raw) {
  const pos = coordinateOf(raw.position ?? raw.location ?? raw)
  if (!pos) return null
  return {
    name: raw.name ?? raw.label ?? raw.target_name ?? `Target ${raw.sequence_no ?? ''}`,
    position: pos,
    sequence: numeric(raw.sequence_no) ?? 99,
  }
}

export async function loadDashboard(token) {
  const results = await Promise.allSettled([
    request('/vehicles/', { token }),
    request('/trips/', { token }),
    request('/route-targets/', { token }),
  ])
  const denied = results.find((result) => result.status === 'rejected'
    && [401, 403].includes(result.reason?.status))
  if (denied) throw denied.reason
  for (const result of results.slice(0, 2)) {
    if (result.status === 'rejected') throw result.reason
  }

  const warnings = []
  const baseVehicles = asList(results[0].value, ['vehicles']).map(normalizeVehicle).filter(Boolean)
  const locationResults = await Promise.allSettled(baseVehicles.map((vehicle) =>
    request('/vehicles/' + encodeURIComponent(vehicle.id) + '/location/latest', { token }),
  ))
  const deniedLocation = locationResults.find((result) => result.status === 'rejected'
    && [401, 403].includes(result.reason?.status))
  if (deniedLocation) throw deniedLocation.reason
  const vehicles = baseVehicles.map((vehicle, index) => {
    const result = locationResults[index]
    return result.status === 'fulfilled' ? normalizeLocation(result.value, vehicle)
      : { ...vehicle, locationStatus: 'unavailable' }
  }).sort((a, b) => (Date.parse(b.observedAt) || 0) - (Date.parse(a.observedAt) || 0))

  const failedLocations = locationResults.filter((result) => result.status === 'rejected')
  if (failedLocations.length) warnings.push(failedLocations.length + ' posisi kendaraan belum dapat dibaca dari server.')
  if (vehicles.length && !vehicles.some((vehicle) => vehicle.locationStatus === 'fresh')) {
    warnings.push('Belum ada posisi GPS terkini. Peta menampilkan posisi terakhir yang tersedia.')
  }
  if (results[2].status === 'rejected') warnings.push('Konfigurasi target belum dapat dibaca; peta memakai titik referensi koridor.')

  return {
    vehicles,
    trips: asList(results[1].value, ['trips']).map(normalizeTrip),
    targets: results[2].status === 'fulfilled'
      ? asList(results[2].value, ['targets', 'route_targets']).map(normalizeTarget).filter(Boolean)
        .sort((a, b) => a.sequence - b.sequence)
      : [],
    warning: warnings.join(' '),
    checkedAt: new Date().toISOString(),
  }
}

export async function getPublicTrip(code) {
  const cleanCode = String(code).trim()
  if (!cleanCode) throw new ApiError('Kode perjalanan tidak boleh kosong.', 400)
  return request('/public/trips/' + encodeURIComponent(cleanCode))
}

export async function listTrips(token, { status, limit = 20, offset = 0 } = {}) {
  const qs = new URLSearchParams()
  if (status && status !== 'Semua') qs.set('status', status)
  if (limit) qs.set('limit', String(limit))
  if (offset) qs.set('offset', String(offset))
  const result = await request('/trips/?' + qs.toString(), { token })
  return asList(result, ['trips']).map((trip) => ({
    trip_id: trip.trip_id ?? trip.id,
    vehicle_id: String(trip.vehicle_id ?? ''),
    plate_number: trip.plate_number ?? '—',
    status: String(trip.status ?? 'unknown'),
    started_at: trip.started_at ?? null,
    ended_at: trip.ended_at ?? null,
    arrived_hajimena_at: trip.arrived_hajimena_at ?? null,
  }))
}

export function getTrip(token, tripId) {
  return request('/trips/' + encodeURIComponent(tripId), { token })
}

export const getTripDetail = getTrip
export const getTrips = listTrips

export function createTrip(token, vehicleId) {
  return request('/trips/', { token, method: 'POST', body: { vehicle_id: vehicleId } })
}

export function startTrip(token, tripId) {
  return request('/trips/' + encodeURIComponent(tripId) + '/start', { token, method: 'POST' })
}

export function arriveHajimena(token, tripId) {
  return request('/trips/' + encodeURIComponent(tripId) + '/arrive-hajimena', { token, method: 'POST' })
}

export function completeTrip(token, tripId) {
  return request('/trips/' + encodeURIComponent(tripId) + '/complete', { token, method: 'POST' })
}

export function cancelTrip(token, tripId) {
  return request('/trips/' + encodeURIComponent(tripId) + '/cancel', { token, method: 'POST' })
}

export function getTripPositions(token, tripId, { limit = 50, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return request('/trips/' + encodeURIComponent(tripId) + '/positions?' + query.toString(), { token })
}
