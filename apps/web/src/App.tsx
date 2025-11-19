import { useEffect, useState } from 'react'
import './App.css'
import Login from './modules/core/auth/Login'
import Signup from './modules/core/auth/Signup'
import Landing from './modules/core/landing/Landing'
import CreateWorkspace from './modules/core/landing/CreateWorkspace'
import JoinWorkspace from './modules/core/landing/JoinWorkspace'
import WorkspacesList from './modules/core/landing/WorkspacesList'
import WorkspaceDetail from './modules/core/landing/WorkspaceDetail'
import WorkspaceMembers from './modules/core/landing/WorkspaceMembers'
import Profile from './modules/core/profile/Profile'
import Upload from './modules/m01/Upload'
import UploadPreview from './modules/m01/UploadPreview'
import MergedList from './modules/m01/MergedList'
import LeadsList from './modules/m01/LeadsList'
import MergeCSV from './modules/m01/MergeCSV'

function App() {
  const [route, setRoute] = useState<string>(window.location.hash || '#/login')

  useEffect(() => {
    function onHashChange() {
      setRoute(window.location.hash || '#/login')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Core auth + landing routes
  if (route.startsWith('#/login')) return <Login />
  if (route.startsWith('#/signup')) return <Signup />
  if (route.startsWith('#/landing')) return <Landing />
  if (route.startsWith('#/profile')) return <Profile />

  // Workspace & landing sub-routes
  if (route.startsWith('#/create-workspace')) return <CreateWorkspace />
  if (route.startsWith('#/join-workspace')) return <JoinWorkspace />
  if (route.startsWith('#/workspace/') && route.includes('/members')) return <WorkspaceMembers />
  if (route.startsWith('#/workspace/')) return <WorkspaceDetail />
  if (route.startsWith('#/workspaces')) return <WorkspacesList />

  // Existing m01 routes
  if (route.startsWith('#/m01/merge-columns')) return <MergeCSV />
  if (route.startsWith('#/m01/leads/preview')) return <UploadPreview />
  if (route.startsWith('#/m01/merged')) return <MergedList />
  if (route.startsWith('#/m01/leads')) return <LeadsList />
  if (route.startsWith('#/m01/upload')) return <Upload />

  // Fallback
  return <Login />
}

export default App
