import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import {
  ApiError, arriveHajimena, cancelTrip, completeTrip, createTrip, getTrip,
  getTripPositions, listTrips, loadDashboard, startTrip,
} from '../src/api.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

function mockDashboard({ vehicles = [{ vehicle_id: 'real-device-vehicle', plate_number: 'ACTUAL', display_name: 'Perangkat lapangan' }], locationStatus = 'fresh', locationFailure, vehiclesFailure, targetFailure } = {}) {
  globalThis.fetch = async (url) => {
    const path = new URL(url, 'http://localhost').pathname
    if (path === '/api/vehicles/') return vehiclesFailure ? json({ detail: 'Server bermasalah' }, vehiclesFailure) : json(vehicles)
    if (path === '/api/trips/') return json([])
    if (path === '/api/route-targets/') return targetFailure ? json({ detail: 'Target tidak tersedia' }, targetFailure) : json([])
    if (path.endsWith('/location/latest')) return locationFailure ? json({ detail: 'Lokasi tidak tersedia' }, locationFailure) : json({
      latitude: -5.34, longitude: 105.24, speed_kmh: 25,
      observed_at: '2026-11-26T00:00:00Z', received_at: '2026-11-26T00:00:01Z',
      last_seen_at: '2026-11-26T00:00:02Z', data_age_seconds: 90000,
      location_status: locationStatus, gps_status: 'valid',
    })
    throw new Error('Unexpected endpoint')
  }
}

test('dashboard rejects unavailable required API instead of inventing vehicles', async () => {
  mockDashboard({ vehiclesFailure: 503 })
  await assert.rejects(() => loadDashboard('token'), (error) => error instanceof ApiError && error.status === 503)
})

test('failed reads and trip actions never simulate successful operations', async () => {
  globalThis.fetch = async () => json({ detail: 'Server bermasalah' }, 503)
  for (const action of [
    () => listTrips('token'), () => getTrip('token', 'PMT-001'),
    () => getTripPositions('token', 'PMT-001'), () => createTrip('token', 'PMT-001'),
    () => startTrip('token', 'PMT-001'), () => arriveHajimena('token', 'PMT-001'),
    () => completeTrip('token', 'PMT-001'), () => cancelTrip('token', 'PMT-001'),
  ]) await assert.rejects(action, (error) => error instanceof ApiError && error.status === 503)
})

test('business conflicts propagate instead of returning a fabricated public code', async () => {
  globalThis.fetch = async () => json({ detail: 'Kendaraan sudah memiliki trip aktif' }, 409)
  await assert.rejects(() => startTrip('token', 'existing-trip'), (error) => error.status === 409)
})

test('location endpoint authentication failures are not swallowed', async () => {
  for (const status of [401, 403]) {
    mockDashboard({ locationFailure: status })
    await assert.rejects(() => loadDashboard('token'), (error) => error.status === status)
  }
})

test('partial location failure is visible and never creates coordinates', async () => {
  mockDashboard({ locationFailure: 503 })
  const data = await loadDashboard('token')
  assert.equal(data.vehicles[0].position, null)
  assert.match(data.warning, /posisi|lokasi/i)
})

test('old GPS data remains old and the dashboard explains its freshness', async () => {
  mockDashboard({ locationStatus: 'no_update' })
  const data = await loadDashboard('token')
  assert.equal(data.vehicles[0].locationStatus, 'no_update')
  assert.equal(data.vehicles[0].ageSeconds, 90000)
  assert.equal(data.vehicles[0].name, 'Perangkat lapangan')
  assert.equal(data.vehicles[0].lastSeenAt, '2026-11-26T00:00:02Z')
  assert.match(data.warning, /GPS terkini/)
})

test('an empty fleet stays empty and target failures are reported', async () => {
  mockDashboard({ vehicles: [], targetFailure: 503 })
  const data = await loadDashboard('token')
  assert.deepEqual(data.vehicles, [])
  assert.deepEqual(data.trips, [])
  assert.match(data.warning, /target/i)
})
