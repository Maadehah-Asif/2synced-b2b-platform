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
import Module7Dropdown from './modules/m07/Module7Dropdown'
import Element1Page from './modules/m07/Element1Page'
import Element2Page from './modules/m07/Element2Page'

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
  if (route.startsWith('#/workspace/') && route.includes('/m07/element2')) return <Element2Page />
  if (route.startsWith('#/workspace/') && route.includes('/m07/element1')) return <Element1Page />
  if (route.startsWith('#/workspace/') && route.includes('/m07/')) return <Element1Page />
  if (route.startsWith('#/workspace/')) return <WorkspaceDetail />
  if (route.startsWith('#/workspaces')) return <WorkspacesList />

  // Existing m01 routes
  if (route.startsWith('#/m01/merge-columns')) return <MergeCSV />
  if (route.startsWith('#/m01/leads/preview')) return <UploadPreview />
  if (route.startsWith('#/m01/merged')) return <MergedList />
  if (route.startsWith('#/m01/leads')) return <LeadsList />
  if (route.startsWith('#/m01/upload')) return <Upload />

  // Fallback
  return (
    <>
      <Module7Dropdown />
      <Login />
    </>
  )
}

export default App
