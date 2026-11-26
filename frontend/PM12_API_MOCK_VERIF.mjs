// Pengujian mock kontrak dasar; TIDAK menghubungi FastAPI atau database asli.
import assert from 'node:assert/strict'
import {
  arriveHajimena, cancelTrip, completeTrip, createTrip,
  getProfile, getPublicTrip, getTrip, getTripPositions,
  listTrips, loadDashboard, login, startTrip,
} from './src/api.js'

const fakeJSON = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
})

globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url, 'http://localhost:5173')
  const path = parsed.pathname
  if (path === '/api/auth/login') {
    const input = JSON.parse(options.body)
    assert.equal(input.email, 'operator@example.com')
    assert.equal(input.password, 'password-mock')
    return fakeJSON({ access_token: 'TOKEN-MOCK' })
  }
  if (path.startsWith('/api/public/trips/')) {
    const code = path.split('/').pop()
    if (code === 'KODE-AKTIF-123') {
      return fakeJSON({
        status: 'active',
        started_at: '2026-11-26T00:00:00Z',
        position: { latitude: -5.345, longitude: 105.241, speed_kmh: 15, location_status: 'fresh', gps_status: 'valid' },
        targets: [{ sequence_no: 1, name: 'Hajimena', latitude: -5.36, longitude: 105.22, eta: { status: 'unavailable', reason: 'PM_15_not_integrated' } }],
        distance: { traveled_gps_segments_m: 1200, unit: 'meter' },
      })
    }
    return fakeJSON({ detail: 'Kode perjalanan tidak berlaku' }, 404)
  }

  assert.equal(options.headers.Authorization, 'Bearer TOKEN-MOCK')
  if (path === '/api/auth/me') return fakeJSON({ email: 'operator@example.com', role: 'operator' })
  if (path === '/api/vehicles/') return fakeJSON({ vehicles: [{ vehicle_id: 'PMT-001', plate_number: 'QA-001' }] })
  if (path === '/api/trips/' && options.method === 'POST') {
    const input = JSON.parse(options.body)
    assert.equal(input.vehicle_id, 'PMT-001')
    return fakeJSON({ trip_id: 'TRIP-NEW', vehicle_id: 'PMT-001', status: 'planned', message: 'Salinan target disimpan' }, 201)
  }
  if (path === '/api/trips/') {
    return fakeJSON({
      trips: [
        { trip_id: 'TRIP-1', vehicle_id: 'PMT-001', plate_number: 'QA-001', status: 'active', eta: { status: 'unavailable' } },
        { trip_id: 'TRIP-PLANNED', vehicle_id: 'PMT-001', plate_number: 'QA-001', status: 'planned' },
      ],
    })
  }
  if (path === '/api/trips/TRIP-PLANNED/start' && options.method === 'POST') {
    return fakeJSON({ trip_id: 'TRIP-PLANNED', status: 'active', public_code: 'CODE-SECRET-999', public_path: '/api/public/trips/CODE-SECRET-999', warning: 'Simpan kode ini' })
  }
  if (path === '/api/trips/TRIP-1/arrive-hajimena' && options.method === 'POST') {
    return fakeJSON({ trip_id: 'TRIP-1', status: 'active', arrived_hajimena_at: '2026-11-26T01:00:00Z', message: 'Trip tetap aktif menuju Kotabumi' })
  }
  if (path === '/api/trips/TRIP-1/complete' && options.method === 'POST') {
    return fakeJSON({ trip_id: 'TRIP-1', status: 'completed', ended_at: '2026-11-26T02:00:00Z' })
  }
  if (path === '/api/trips/TRIP-PLANNED/cancel' && options.method === 'POST') {
    return fakeJSON({ trip_id: 'TRIP-PLANNED', status: 'canceled', ended_at: '2026-11-26T00:30:00Z' })
  }
  if (path === '/api/trips/TRIP-1') {
    return fakeJSON({
      trip_id: 'TRIP-1',
      vehicle_id: 'PMT-001',
      plate_number: 'QA-001',
      status: 'active',
      position: { latitude: -5.345, longitude: 105.241, speed_kmh: 10, location_status: 'fresh', gps_status: 'valid' },
      targets: [
        { target_id: 1, sequence_no: 1, name: 'Hajimena', remaining_straight_line_m: 2500, eta: { status: 'unavailable', reason: 'PM_15_not_integrated' } },
        { target_id: 2, sequence_no: 2, name: 'Kotabumi', remaining_straight_line_m: 65000, eta: { status: 'unavailable', reason: 'PM_15_not_integrated' } },
      ],
      distance: { traveled_gps_segments_m: 1500, traveled_points: 3, unit: 'meter' },
    })
  }
  if (path === '/api/trips/TRIP-1/positions') {
    return fakeJSON([
      { id: 1, observed_at: '2026-11-26T00:01:00Z', received_at: '2026-11-26T00:01:01Z', latitude: -5.345, longitude: 105.241, speed_kmh: 12, gps_valid: true, satellites: 9, hdop: 1.1 },
    ])
  }
  if (path === '/api/route-targets/') return fakeJSON({ targets: [{ name: 'Hajimena', sequence_no: 1, latitude: -5.36, longitude: 105.22 }] })
  if (path === '/api/vehicles/PMT-001/location/latest') return fakeJSON({
    vehicle_id: 'PMT-001',
    data_age_seconds: 14,
    location_status: 'fresh',
    location: { latitude: -5.345335, longitude: 105.241597, speed_kmh: 12.5, observed_at: '2026-11-07T00:00:00Z' },
  })
  throw new Error(`Endpoint tidak diharapkan: ${path}`)
}

const token = await login('operator@example.com', 'password-mock')
assert.equal(token, 'TOKEN-MOCK')
const profile = await getProfile(token)
assert.equal(profile.role, 'operator')
const data = await loadDashboard(token)
assert.equal(data.vehicles.length, 1)
assert.deepEqual(data.vehicles[0].position, [-5.345335, 105.241597])
assert.equal(data.vehicles[0].locationStatus, 'fresh')
assert.equal(data.vehicles[0].speed, 12.5)
assert.equal(data.vehicles[0].ageSeconds, 14)
assert.equal(data.trips[0].status, 'active')
assert.equal(data.targets[0].name, 'Hajimena')

// Uji fungsi trip operator
const trips = await listTrips(token)
assert.equal(trips.length, 2)
const created = await createTrip(token, 'PMT-001')
assert.equal(created.trip_id, 'TRIP-NEW')
const started = await startTrip(token, 'TRIP-PLANNED')
assert.equal(started.public_code, 'CODE-SECRET-999')
const arrived = await arriveHajimena(token, 'TRIP-1')
assert.equal(arrived.message, 'Trip tetap aktif menuju Kotabumi')
const completed = await completeTrip(token, 'TRIP-1')
assert.equal(completed.status, 'completed')
const canceled = await cancelTrip(token, 'TRIP-PLANNED')
assert.equal(canceled.status, 'canceled')
const detail = await getTrip(token, 'TRIP-1')
assert.equal(detail.trip_id, 'TRIP-1')
assert.equal(detail.targets.length, 2)
const positions = await getTripPositions(token, 'TRIP-1')
assert.equal(positions.length, 1)

// Uji penumpang publik
const publicTrip = await getPublicTrip('KODE-AKTIF-123')
assert.equal(publicTrip.status, 'active')
await assert.rejects(async () => {
  await getPublicTrip('KODE-SALAH')
}, /Kode perjalanan tidak berlaku/)

console.log('LULUS: login mock, kendaraan, GPS age, trip CRUD, lifecycle operator, dan publik penumpang.')

