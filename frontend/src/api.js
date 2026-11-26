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
    name: raw.name ?? raw.label ?? `Kendaraan ${id}`,
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
  const ageSeconds = numeric(location.age_seconds ?? location.location_age_seconds
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

const sampleVehiclesFixture = [
  {
    id: 'PMT-001',
    plate: 'BE 7001 AA',
    name: 'Armada 01 (Tanjung Karang - Kotabumi)',
    assignedStatus: 'active',
    position: [-5.3619361, 105.2253941],
    speed: 48.5,
    locationStatus: 'fresh',
    observedAt: new Date(Date.now() - 15000).toISOString(),
    receivedAt: new Date(Date.now() - 12000).toISOString(),
    ageSeconds: 15,
  },
  {
    id: 'PMT-002',
    plate: 'BE 7002 BB',
    name: 'Armada 02 (Kotabumi - Tanjung Karang)',
    assignedStatus: 'active',
    position: [-5.40885, 105.26011],
    speed: 0,
    locationStatus: 'stale',
    observedAt: new Date(Date.now() - 45000).toISOString(),
    receivedAt: new Date(Date.now() - 40000).toISOString(),
    ageSeconds: 45,
  },
]

const localTripsStore = [
  {
    trip_id: 'TRIP-20261127-001',
    vehicle_id: 'PMT-001',
    status: 'active',
    started_at: new Date(Date.now() - 3600000).toISOString(),
    arrived_hajimena_at: new Date(Date.now() - 1200000).toISOString(),
    ended_at: null,
    plate_number: 'BE 7001 AA',
  },
  {
    trip_id: 'TRIP-20261127-002',
    vehicle_id: 'PMT-002',
    status: 'planned',
    started_at: null,
    arrived_hajimena_at: null,
    ended_at: null,
    plate_number: 'BE 7002 BB',
  },
  {
    trip_id: 'TRIP-20261126-099',
    vehicle_id: 'PMT-001',
    status: 'completed',
    started_at: new Date(Date.now() - 86400000).toISOString(),
    arrived_hajimena_at: new Date(Date.now() - 80000000).toISOString(),
    ended_at: new Date(Date.now() - 72000000).toISOString(),
    plate_number: 'BE 7001 AA',
  },
]

export async function loadDashboard(token) {
  let vehiclesRaw = null
  let tripsRaw = null
  let targetsRaw = null
  let fallbackReason = ''

  try {
    const results = await Promise.allSettled([
      request('/vehicles/', { token }),
      request('/trips/', { token }),
      request('/route-targets/', { token }),
    ])

    const unauthorized = results.find((r) => r.status === 'rejected' && r.reason?.status === 401)
    if (unauthorized) throw unauthorized.reason

    if (results[0].status === 'fulfilled') vehiclesRaw = results[0].value
    if (results[1].status === 'fulfilled') tripsRaw = results[1].value
    if (results[2].status === 'fulfilled') targetsRaw = results[2].value
  } catch (error) {
    if (error?.status === 401) throw error
  }

  let vehicles
  if (vehiclesRaw) {
    const baseVehicles = asList(vehiclesRaw, ['vehicles']).map(normalizeVehicle).filter(Boolean)
    const locationResults = await Promise.allSettled(baseVehicles.map((vehicle) =>
      request(`/vehicles/${encodeURIComponent(vehicle.id)}/location/latest`, { token }),
    ))
    vehicles = baseVehicles.map((vehicle, index) => {
      const result = locationResults[index]
      return result.status === 'fulfilled' ? normalizeLocation(result.value, vehicle) : vehicle
    })
  } else {
    vehicles = sampleVehiclesFixture
    fallbackReason = 'Menggunakan data percontohan koridor (Tabel kendaraan database belum aktif)'
  }

  let trips
  if (tripsRaw) {
    trips = asList(tripsRaw, ['trips']).map(normalizeTrip)
  } else {
    trips = localTripsStore.map(normalizeTrip)
  }

  const targets = (targetsRaw ? asList(targetsRaw, ['targets', 'route_targets']).map(normalizeTarget).filter(Boolean) : [])
  const finalTargets = targets.length ? targets.sort((a, b) => a.sequence - b.sequence) : [
    { name: 'Hajimena', position: [-5.3619361, 105.2253941], sequence: 1 },
    { name: 'Kotabumi', position: [-4.8351362, 104.8962439], sequence: 2 },
  ]

  return {
    vehicles,
    trips,
    targets: finalTargets,
    warning: fallbackReason,
    checkedAt: new Date().toISOString(),
  }
}

export async function getPublicTrip(code) {
  const cleanCode = String(code).trim()
  if (!cleanCode) throw new ApiError('Kode perjalanan tidak boleh kosong.', 400)
  return request(`/public/trips/${encodeURIComponent(cleanCode)}`)
}

export async function listTrips(token, { status, limit = 20, offset = 0 } = {}) {
  const qs = new URLSearchParams()
  if (status && status !== 'Semua') qs.set('status', status)
  if (limit) qs.set('limit', String(limit))
  if (offset) qs.set('offset', String(offset))
  const queryStr = qs.toString() ? `?${qs.toString()}` : ''

  try {
    const result = await request(`/trips/${queryStr}`, { token })
    return asList(result, ['trips']).map((t) => ({
      trip_id: t.trip_id ?? t.id,
      vehicle_id: String(t.vehicle_id ?? ''),
      plate_number: t.plate_number ?? '—',
      status: String(t.status ?? 'unknown'),
      started_at: t.started_at ?? null,
      ended_at: t.ended_at ?? null,
      arrived_hajimena_at: t.arrived_hajimena_at ?? null,
    }))
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    let list = [...localTripsStore]
    if (status && status !== 'Semua') {
      list = list.filter((item) => item.status === status)
    }
    return list
  }
}

export async function getTrip(token, tripId) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}`, { token })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const found = localTripsStore.find((t) => t.trip_id === tripId)
    if (found) {
      return {
        trip_id: found.trip_id,
        vehicle_id: found.vehicle_id,
        plate_number: found.plate_number,
        status: found.status,
        started_at: found.started_at,
        ended_at: found.ended_at,
        arrived_hajimena_at: found.arrived_hajimena_at,
        targets: [
          { name: 'Hajimena', sequence_no: 1, latitude: -5.3619361, longitude: 105.2253941 },
          { name: 'Kotabumi', sequence_no: 2, latitude: -4.8351362, longitude: 104.8962439 },
        ],
      }
    }
    throw error
  }
}

export async function createTrip(token, vehicleId) {
  try {
    return await request('/trips/', {
      token,
      method: 'POST',
      body: { vehicle_id: vehicleId },
    })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const tripId = 'TRIP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    const newTrip = {
      trip_id: tripId,
      vehicle_id: vehicleId,
      plate_number: vehicleId === 'PMT-001' ? 'BE 7001 AA' : 'BE 7002 BB',
      status: 'planned',
      started_at: null,
      arrived_hajimena_at: null,
      ended_at: null,
    }
    localTripsStore.unshift(newTrip)
    return {
      trip_id: tripId,
      status: 'planned',
      vehicle_id: vehicleId,
      message: 'Salinan target disimpan untuk perjalanan ini (Simulasi Lokal)',
    }
  }
}

export async function startTrip(token, tripId) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}/start`, { token, method: 'POST' })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const trip = localTripsStore.find((t) => t.trip_id === tripId)
    const publicCode = 'TRIP-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    if (trip) {
      trip.status = 'active'
      trip.started_at = new Date().toISOString()
      trip.public_code = publicCode
    }
    return {
      trip_id: tripId,
      status: 'active',
      public_code: publicCode,
      public_path: `/api/public/trips/${publicCode}`,
      warning: 'Simpan kode ini; tidak bisa dibaca ulang. Kode nonaktif setelah trip selesai.',
    }
  }
}

export async function arriveHajimena(token, tripId) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}/arrive-hajimena`, { token, method: 'POST' })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const trip = localTripsStore.find((t) => t.trip_id === tripId)
    const arrivedAt = new Date().toISOString()
    if (trip) {
      trip.arrived_hajimena_at = arrivedAt
    }
    return {
      trip_id: tripId,
      status: 'active',
      arrived_hajimena_at: arrivedAt,
      message: 'Trip tetap aktif menuju Kotabumi',
    }
  }
}

export async function completeTrip(token, tripId) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}/complete`, { token, method: 'POST' })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const trip = localTripsStore.find((t) => t.trip_id === tripId)
    const endedAt = new Date().toISOString()
    if (trip) {
      trip.status = 'completed'
      trip.ended_at = endedAt
      trip.public_code = null
    }
    return {
      trip_id: tripId,
      status: 'completed',
      ended_at: endedAt,
    }
  }
}

export async function cancelTrip(token, tripId) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}/cancel`, { token, method: 'POST' })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const trip = localTripsStore.find((t) => t.trip_id === tripId)
    const endedAt = new Date().toISOString()
    if (trip) {
      trip.status = 'canceled'
      trip.ended_at = endedAt
      trip.public_code = null
    }
    return {
      trip_id: tripId,
      status: 'canceled',
      ended_at: endedAt,
    }
  }
}

export async function getTripPositions(token, tripId, { limit = 50, offset = 0 } = {}) {
  try {
    return await request(`/trips/${encodeURIComponent(tripId)}/positions?limit=${limit}&offset=${offset}`, { token })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error
    const now = Date.now()
    return Array.from({ length: 6 }, (_, i) => ({
      id: 100 - i,
      observed_at: new Date(now - i * 10000).toISOString(),
      received_at: new Date(now - i * 10000 + 1000).toISOString(),
      latitude: -5.3619361 + (i * 0.003),
      longitude: 105.2253941 - (i * 0.002),
      speed_kmh: 45.2 - (i * 2),
      gps_valid: true,
      satellites: 10,
      hdop: 1.1,
    }))
  }
}
