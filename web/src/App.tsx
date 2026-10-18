import { useEffect, useState } from 'react'
import Shell from './Shell'
import Login from './pages/Login'
import Mfa from './pages/Mfa'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import ActivityDetail from './pages/ActivityDetail'
import Sleep from './pages/Sleep'
import Body from './pages/Body'
import Workouts from './pages/Workouts'

// A handful of routes don't need a router library.
export function navigate(to: string) {
  history.pushState(null, '', to)
  dispatchEvent(new PopStateEvent('popstate'))
  scrollTo(0, 0)
}

function page(path: string) {
  const activity = path.match(/^\/activities\/(\d+)$/)
  if (activity) return <ActivityDetail id={activity[1]} />
  switch (path) {
    case '/activities':
      return <Activities />
    case '/sleep':
      return <Sleep />
    case '/body':
      return <Body />
    case '/workouts':
      return <Workouts />
    default:
      return <Dashboard />
  }
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
  return <Shell path={path}>{page(path)}</Shell>
}
