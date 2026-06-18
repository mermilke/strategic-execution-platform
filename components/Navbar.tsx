'use client'
import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Navbar({ user, profile }: {
  user?: { email?: string | null } | null
  profile?: { role?: string | null; full_name?: string | null } | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  const [directReports, setDirectReports] = useState<Array<{ id: string; full_name: string | null }>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDashDropdown, setShowDashDropdown] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dashDropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isManager) return
    async function loadReports() {
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'direct_report')
        .order('full_name')
      setDirectReports(data || [])
    }
    loadReports()
  }, [isManager])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Navigate from the mobile menu and close it.
  function go(href: string) {
    setMobileOpen(false)
    router.push(href)
  }

  function handleDropdownEnter() {
    clearTimeout(dropdownTimeout.current ?? undefined)
    setShowDropdown(true)
  }

  function handleDropdownLeave() {
    dropdownTimeout.current = setTimeout(() => setShowDropdown(false), 150)
  }

  function handleDashDropdownEnter() {
    clearTimeout(dashDropdownTimeout.current ?? undefined)
    setShowDashDropdown(true)
  }

  function handleDashDropdownLeave() {
    dashDropdownTimeout.current = setTimeout(() => setShowDashDropdown(false), 150)
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 60,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(37, 99, 235,0.15)',
    }}>
      {/* Top brand line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #2563EB, #4F46E5)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}
          onClick={() => router.push('/dashboard')}
        >
          <img
            src="/icon.svg"
            alt="Strategic Execution Platform"
            style={{ height: 30, width: 30, objectFit: 'contain', borderRadius: 8 }}
          />
          <span style={{
            fontFamily: "'Poppins', 'DM Sans', sans-serif",
            fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#0F172A' }}>Strategic</span>
            <span style={{ color: '#2563EB' }}> Execution</span>
          </span>
        </div>

        {/* Divider + nav links (desktop only) */}
        <div className="nav-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ width: 1, height: 20, background: 'rgba(37, 99, 235,0.2)' }} />

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {isManager ? (
            <div
              style={{ position: 'relative' }}
              onMouseEnter={handleDashDropdownEnter}
              onMouseLeave={handleDashDropdownLeave}
              onFocus={handleDashDropdownEnter}
              onBlur={handleDashDropdownLeave}
              onKeyDown={e => { if (e.key === 'Escape') setShowDashDropdown(false) }}
            >
              <NavLink href="/dashboard" active={pathname === '/dashboard'} router={router}
                hasPopup expanded={showDashDropdown}>
                Dashboard
              </NavLink>
              {showDashDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(37, 99, 235,0.2)',
                  borderRadius: 8,
                  padding: '4px 0',
                  minWidth: 150,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  zIndex: 100,
                }}>
                  {[['overview', 'Overview'], ['analytics', 'Analytics']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setShowDashDropdown(false)
                        router.push(`/dashboard?view=${key}`)
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', fontSize: 12,
                        background: 'transparent', border: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(37, 99, 235,0.1)'
                        e.currentTarget.style.color = '#2563EB'
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                    >
                      {key === 'analytics' ? '📊 ' : ''}{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink href="/dashboard" active={pathname === '/dashboard'} router={router}>
              My Dashboard
            </NavLink>
          )}
          {!isManager && (
            <NavLink href="/checkin" active={pathname === '/checkin'} router={router}>
              Weekly Check-in
            </NavLink>
          )}

          {/* 1:1 Notes with hover dropdown for manager */}
          {isManager ? (
            <div
              style={{ position: 'relative' }}
              onMouseEnter={handleDropdownEnter}
              onMouseLeave={handleDropdownLeave}
              onFocus={handleDropdownEnter}
              onBlur={handleDropdownLeave}
              onKeyDown={e => { if (e.key === 'Escape') setShowDropdown(false) }}
            >
              <NavLink href="/meeting" active={pathname === '/meeting'} router={router}
                hasPopup expanded={showDropdown}>
                1:1 Notes
              </NavLink>
              {showDropdown && directReports.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(37, 99, 235,0.2)',
                  borderRadius: 8,
                  padding: '4px 0',
                  minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  zIndex: 100,
                }}>
                  {directReports.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setShowDropdown(false)
                        router.push(`/meeting?userId=${r.id}`)
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', fontSize: 12,
                        background: 'transparent', border: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(37, 99, 235,0.1)'
                        e.currentTarget.style.color = '#2563EB'
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                    >
                      {r.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink href="/meeting" active={pathname === '/meeting'} router={router}>
              1:1 Notes
            </NavLink>
          )}

          {isManager && (
            <NavLink href="/admin" active={pathname === '/admin'} router={router}>
              Manage Team
            </NavLink>
          )}
        </div>
        </div>
      </div>

      {/* User + sign out (desktop only) */}
      <div className="nav-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {profile?.full_name || user?.email}
        </span>
        {isManager && (
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(37, 99, 235,0.1)', color: '#2563EB',
            border: '1px solid rgba(37, 99, 235,0.2)',
          }}>
            {profile?.role === 'admin' ? 'Admin' : 'Manager'}
          </span>
        )}
        <button onClick={handleSignOut} style={{
          fontSize: 12, padding: '6px 12px', borderRadius: 6,
          color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
          background: 'transparent', cursor: 'pointer', transition: 'all 0.2s',
          letterSpacing: '0.05em',
        }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          Sign out
        </button>
      </div>

      {/* Hamburger (mobile only) */}
      <button
        className="nav-mobile-only"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(o => !o)}
        style={{
          alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 8,
          background: mobileOpen ? 'rgba(37, 99, 235,0.1)' : 'transparent',
          border: '1px solid var(--border-subtle)', cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {mobileOpen
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
        </svg>
      </button>

      {/* Mobile dropdown panel */}
      {mobileOpen && (
        <div
          className="nav-mobile-only"
          style={{
            position: 'absolute', top: 60, left: 0, right: 0,
            flexDirection: 'column', alignItems: 'stretch', gap: 2,
            padding: 12,
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(37, 99, 235,0.15)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.08)',
          }}
        >
          {isManager ? (
            <>
              <MobileLink onClick={() => go('/dashboard')} active={pathname === '/dashboard'}>Dashboard</MobileLink>
              <MobileLink onClick={() => go('/dashboard?view=analytics')}>📊 Analytics</MobileLink>
              <MobileLink onClick={() => go('/meeting')} active={pathname === '/meeting'}>1:1 Notes</MobileLink>
              <MobileLink onClick={() => go('/admin')} active={pathname === '/admin'}>Manage Team</MobileLink>
            </>
          ) : (
            <>
              <MobileLink onClick={() => go('/dashboard')} active={pathname === '/dashboard'}>My Dashboard</MobileLink>
              <MobileLink onClick={() => go('/checkin')} active={pathname === '/checkin'}>Weekly Check-in</MobileLink>
              <MobileLink onClick={() => go('/meeting')} active={pathname === '/meeting'}>1:1 Notes</MobileLink>
            </>
          )}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile?.full_name || user?.email}</span>
            {isManager && (
              <span style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'rgba(37, 99, 235,0.1)', color: '#2563EB', border: '1px solid rgba(37, 99, 235,0.2)',
              }}>
                {profile?.role === 'admin' ? 'Admin' : 'Manager'}
              </span>
            )}
          </div>
          <MobileLink onClick={() => { setMobileOpen(false); handleSignOut() }}>Sign out</MobileLink>
        </div>
      )}
    </nav>
  )
}

function MobileLink({ children, onClick, active }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '11px 12px', borderRadius: 8, fontSize: 15, border: 'none',
      background: active ? 'rgba(37, 99, 235,0.1)' : 'transparent',
      color: active ? '#2563EB' : 'var(--text-secondary)',
      fontWeight: active ? 600 : 400, cursor: 'pointer',
    }}>
      {children}
    </button>
  )
}

function NavLink({ href, active, children, router, hasPopup, expanded }: {
  href: string
  active: boolean
  children: ReactNode
  router: { push: (href: string) => void }
  hasPopup?: boolean
  expanded?: boolean
}) {
  return (
    <button onClick={() => router.push(href)}
      aria-haspopup={hasPopup || undefined}
      aria-expanded={hasPopup ? expanded : undefined}
      style={{
      padding: '6px 14px', borderRadius: 6, fontSize: 13, border: 'none',
      background: active ? 'rgba(37, 99, 235,0.12)' : 'transparent',
      color: active ? '#2563EB' : 'var(--text-muted)',
      borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
      cursor: 'pointer', transition: 'all 0.2s',
    }}
      onMouseOver={e => { if (!active) { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.background = 'rgba(37, 99, 235,0.06)' } }}
      onMouseOut={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' } }}
    >
      {children}
    </button>
  )
}
