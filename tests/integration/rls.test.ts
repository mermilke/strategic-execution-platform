// Integration tests for row-level security. These exercise the real Postgres
// policies against a local Supabase stack: they create users in different roles,
// sign in as each, and assert what each can and cannot read or write. This is
// coverage that unit tests cannot provide, since RLS is enforced in the database.
//
// Run with: npm run test:integration (requires `npx supabase start` first).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, resetDb, createUser, signInAs, type TestUser } from './helpers'

const WEEK = '2026-06-01'

let admin: SupabaseClient
let manager: TestUser, dr1: TestUser, dr2: TestUser
// Fixture rows are read back from the service-role client, which carries no schema generic.
let obj1: any, sub1: any, obj2: any, sub2: any
let managerClient: SupabaseClient, drClient1: SupabaseClient, drClient2: SupabaseClient

beforeAll(async () => {
  admin = adminClient()
  await resetDb(admin)

  manager = await createUser(admin, 'manager', 'Manager One')
  dr1 = await createUser(admin, 'direct_report', 'Report One')
  dr2 = await createUser(admin, 'direct_report', 'Report Two')

  // Fixtures are built with the service role, which bypasses RLS. dr1 owns one
  // objective/sub/check-in; dr2 owns another, so we can prove cross-report isolation.
  ;({ data: obj1 } = await admin.from('strategic_objectives')
    .insert({ owner_id: dr1.id, title: 'Report One objective' }).select().single())
  ;({ data: sub1 } = await admin.from('sub_objectives')
    .insert({ objective_id: obj1.id, title: 'Report One sub' }).select().single())
  ;({ data: obj2 } = await admin.from('strategic_objectives')
    .insert({ owner_id: dr2.id, title: 'Report Two objective' }).select().single())
  ;({ data: sub2 } = await admin.from('sub_objectives')
    .insert({ objective_id: obj2.id, title: 'Report Two sub' }).select().single())

  await admin.from('weekly_checkins')
    .insert({ sub_objective_id: sub1.id, submitted_by: dr1.id, week_start: WEEK, status: 'on_track' })
  await admin.from('weekly_checkins')
    .insert({ sub_objective_id: sub2.id, submitted_by: dr2.id, week_start: WEEK, status: 'on_track' })

  managerClient = await signInAs(manager.email)
  drClient1 = await signInAs(dr1.email)
  drClient2 = await signInAs(dr2.email)
}, 120000)

afterAll(async () => {
  if (admin) await resetDb(admin)
})

describe('strategic_objectives RLS', () => {
  it('a manager sees every objective', async () => {
    const { data, error } = await managerClient.from('strategic_objectives').select('id')
    expect(error).toBeNull()
    expect(data!.map((o: any) => o.id).sort()).toEqual([obj1.id, obj2.id].sort())
  })

  it('a direct report sees only objectives they own', async () => {
    const { data, error } = await drClient1.from('strategic_objectives').select('id')
    expect(error).toBeNull()
    expect(data!.map((o: any) => o.id)).toEqual([obj1.id])
  })
})

describe('sub_objectives RLS', () => {
  it('a direct report sees only sub-objectives under their own objectives', async () => {
    const { data, error } = await drClient1.from('sub_objectives').select('id')
    expect(error).toBeNull()
    expect(data!.map((s: any) => s.id)).toEqual([sub1.id])
  })
})

describe('weekly_checkins RLS', () => {
  it('a manager sees every check-in', async () => {
    const { data, error } = await managerClient.from('weekly_checkins').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('a direct report sees only their own check-ins', async () => {
    const { data, error } = await drClient1.from('weekly_checkins').select('id, submitted_by')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data!.every((c: any) => c.submitted_by === dr1.id)).toBe(true)
  })

  it('a report cannot submit a check-in attributed to another user', async () => {
    const { error } = await drClient1.from('weekly_checkins').insert({
      sub_objective_id: sub1.id, submitted_by: dr2.id, week_start: '2026-06-08', status: 'on_track',
    })
    expect(error).not.toBeNull()
  })

  it('a report cannot submit a check-in on a sub-objective they do not own', async () => {
    const { error } = await drClient1.from('weekly_checkins').insert({
      sub_objective_id: sub2.id, submitted_by: dr1.id, week_start: '2026-06-08', status: 'on_track',
    })
    expect(error).not.toBeNull()
  })

  it('a report can submit a check-in on their own sub-objective', async () => {
    const { error } = await drClient1.from('weekly_checkins').insert({
      sub_objective_id: sub1.id, submitted_by: dr1.id, week_start: '2026-06-15', status: 'on_track',
    })
    expect(error).toBeNull()
  })

  it('a report can edit the status on their own check-in', async () => {
    const { error } = await drClient1.from('weekly_checkins')
      .update({ status: 'at_risk' })
      .eq('submitted_by', dr1.id).eq('sub_objective_id', sub1.id).eq('week_start', WEEK)
    expect(error).toBeNull()
    const { data } = await admin.from('weekly_checkins').select('status')
      .eq('sub_objective_id', sub1.id).eq('week_start', WEEK).single()
    expect(data!.status).toBe('at_risk')
  })

  it('a report cannot re-point their own check-in onto a sub-objective they do not own', async () => {
    // USING lets them target their own row, but WITH CHECK must reject moving it
    // onto sub2 (owned by dr2), so the update raises rather than silently succeeding.
    const { error } = await drClient1.from('weekly_checkins')
      .update({ sub_objective_id: sub2.id })
      .eq('submitted_by', dr1.id).eq('sub_objective_id', sub1.id).eq('week_start', WEEK)
    expect(error).not.toBeNull()
    const { data } = await admin.from('weekly_checkins').select('sub_objective_id')
      .eq('submitted_by', dr1.id).eq('week_start', WEEK).single()
    expect(data!.sub_objective_id).toBe(sub1.id)
  })

  it('a report cannot modify another report\'s check-in', async () => {
    // dr2's row is hidden from dr1 by USING, so PostgREST matches zero rows and
    // returns no error; prove nothing changed by reading back with the service role.
    const { error } = await drClient1.from('weekly_checkins')
      .update({ status: 'off_track' })
      .eq('sub_objective_id', sub2.id).eq('week_start', WEEK)
    expect(error).toBeNull()
    const { data } = await admin.from('weekly_checkins').select('status')
      .eq('sub_objective_id', sub2.id).eq('week_start', WEEK).single()
    expect(data!.status).toBe('on_track')
  })
})

describe('users RLS', () => {
  it('a manager reads the whole team (the dashboard needs it)', async () => {
    const { data, error } = await managerClient.from('users').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
  })

  it('a direct report reads only their own row, not the rest of the team', async () => {
    const { data, error } = await drClient1.from('users').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(dr1.id)
  })

  it('a direct report cannot promote themselves to admin', async () => {
    const { error } = await drClient1.from('users').update({ role: 'admin' }).eq('id', dr1.id)
    expect(error).not.toBeNull()
    // confirm the role really did not change, read back with the service role
    const { data } = await admin.from('users').select('role').eq('id', dr1.id).single()
    expect(data!.role).toBe('direct_report')
  })

  it('a direct report can still update a non-role field on their own row', async () => {
    const { error } = await drClient1.from('users').update({ full_name: 'Report One Renamed' }).eq('id', dr1.id)
    expect(error).toBeNull()
    const { data } = await admin.from('users').select('full_name').eq('id', dr1.id).single()
    expect(data!.full_name).toBe('Report One Renamed')
  })
})
