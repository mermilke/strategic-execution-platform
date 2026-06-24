import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '../../../../lib/database.types'

// users UPDATE is locked to the row's owner by RLS (so a report can't edit
// anyone else), which means a manager can't set another report's start_week from
// the client. This admin-gated route does it server-side with the service-role
// key, the same shape as the reset-password route, instead of loosening the
// users policy.

// Monday (ISO week start) of a YYYY-MM-DD, so a picked date snaps to its week.
function mondayOf(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0 Sun .. 6 Sat
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  try {
    const { userId, date } = await request.json()
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    // Empty/null clears the start week; a present value must be a valid date.
    const startWeek = date ? mondayOf(String(date)) : null
    if (date && !startWeek) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Authorize the caller as a manager/admin via their session.
    const cookieStore = await cookies()
    const supabaseSSR = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() } } }
    )
    const { data: { user } } = await supabaseSSR.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { data: profile } = await supabaseSSR.from('users').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabaseAdmin.from('users').update({ start_week: startWeek }).eq('id', userId)
    if (error) {
      console.error('start-week update error:', error)
      return NextResponse.json({ error: 'Could not save start week' }, { status: 500 })
    }
    return NextResponse.json({ success: true, start_week: startWeek })
  } catch (err) {
    console.error('Admin start-week error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
