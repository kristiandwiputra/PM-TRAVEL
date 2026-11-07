// Pengujian mock kontrak dasar; TIDAK menghubungi FastAPI atau database asli.
import assert from 'node:assert/strict'
import { loadDashboard, login } from './src/api.js'

const fakeJSON = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
})

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url, 'http://localhost:5173').pathname
  if (path === '/api/auth/login') {
    const input = JSON.parse(options.body)
    assert.equal(input.username, 'operator')
    return fakeJSON({ access_token: 'TOKEN-MOCK' })
  }
  assert.equal(options.headers.Authorization, 'Bearer TOKEN-MOCK')
  if (path === '/api/vehicles/') return fakeJSON({ vehicles: [{ vehicle_id: 'PMT-001', plate_number: 'QA-001' }] })
  if (path === '/api/trips/') return fakeJSON({ trips: [{ trip_id: 'TRIP-1', vehicle_id: 'PMT-001', status: 'active', eta: { status: 'unavailable' } }] })
  if (path === '/api/route-targets/') return fakeJSON({ targets: [{ name: 'Hajimena', sequence_no: 1, latitude: -5.36, longitude: 105.22 }] })
  if (path === '/api/vehicles/PMT-001/location/latest') return fakeJSON({
    vehicle_id: 'PMT-001',
    location_status: 'fresh',
    location: { latitude: -5.345335, longitude: 105.241597, speed_kmh: 12.5, observed_at: '2026-11-07T00:00:00Z' },
  })
  throw new Error(`Endpoint tidak diharapkan: ${path}`)
}

const token = await login('operator', 'password-mock')
assert.equal(token, 'TOKEN-MOCK')
const data = await loadDashboard(token)
assert.equal(data.vehicles.length, 1)
assert.deepEqual(data.vehicles[0].position, [-5.345335, 105.241597])
assert.equal(data.vehicles[0].locationStatus, 'fresh')
assert.equal(data.vehicles[0].speed, 12.5)
assert.equal(data.trips[0].status, 'active')
assert.equal(data.targets[0].name, 'Hajimena')
console.log('LULUS: login mock, kendaraan, GPS, status, trip, target.')
