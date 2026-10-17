import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Mfa from './pages/Mfa'
import Dashboard from './pages/Dashboard'

// Three routes don't need a router library.
export function navigate(to: string) {
  history.pushState(null, '', to)
  dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const onPop = () => setPath(location.pathname)
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  if (path === '/login') return <Login />
  if (path === '/mfa') return <Mfa />
  return <Dashboard />
}
