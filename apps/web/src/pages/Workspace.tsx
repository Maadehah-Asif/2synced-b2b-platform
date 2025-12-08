import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Workspace(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string, email: string, fullName?: string } | null>(null)
  const [memberships, setMemberships] = useState<Array<{ id: string, workspaceId: string, role: string }>>([])

  useEffect(() => {
    async function load(){
      const token = localStorage.getItem('token')
      if(!token){ window.location.hash = '#/login'; return }

      try{
        const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        if(!res.ok){
          // token likely invalid
          localStorage.removeItem('token')
          window.location.hash = '#/login'
          return
        }
        const data = await res.json()
        setUser(data.user)
        setMemberships(data.memberships || [])
      }catch(err:any){
        console.error('Workspace load failed', err)
        setError('Failed to load your account')
      }finally{ setLoading(false) }
    }
    load()
  }, [])

  function handleLogout(){
    localStorage.removeItem('token')
    window.location.hash = '#/login'
  }

  if(loading) return (<div style={{padding:24}}>Loading your account…</div>)
  if(error) return (<div style={{padding:24}}>{error}</div>)

  return (
    <div style={{padding:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Welcome{user?.fullName ? `, ${user.fullName}` : ''}</h2>
        <div>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <section style={{marginTop:18}}>
        <h3>Your memberships</h3>
        {memberships.length === 0 ? (
          <p>You are not a member of any workspace yet.</p>
        ) : (
          <ul>
            {memberships.map(m => (
              <li key={m.id}>Workspace: {m.workspaceId} — Role: {m.role}</li>
            ))}
          </ul>
        )}
      </section>

      <section style={{marginTop:18}}>
        <h3>Quick actions</h3>
        <p>Placeholder workspace content. Replace with your real dashboard.</p>
      </section>
    </div>
  )
}
