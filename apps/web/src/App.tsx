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
import Module6Dropdown from './modules/m06/Module6Dropdown'
import Element1Page from './modules/m06/Element1Page'
import Module6Home from './modules/m06/Module6Home'
import Module1Home from './modules/m01/Module1Home'
import Element2Page from './modules/m06/Element2Page'
import RoiDashboard from './modules/m06/RoiDashboard'
import Element4Page from './modules/m06/Element4Page'
import CampaignManager from './modules/m06/CampaignManager'
import ViewCampaigns from './modules/m06/ViewCampaigns'
import CampaignTouchInput from './modules/m06/CampaignTouchInput'
import CampaignTouchViewer from './modules/m06/CampaignTouchViewer'
import DealInput from './modules/m06/DealInput'
import DealViewer from './modules/m06/DealViewer'
import JourneyPreview from './modules/m06/JourneyPreview'
import RunAttributionScreen from './modules/m06/RunAttributionScreen'
import AllocationDashboard from './modules/m06/AllocationDashboard'
import RoiCalculation from './modules/m06/RoiCalculation'
import Module7Home from './modules/m07/Module7Home'
import FunnelHealthPage from './modules/m07/FunnelHealthPage'
import LeakagePredictionPage from './modules/m07/LeakagePredictionPage'
import FatigueMonitorPage from './modules/m07/FatigueMonitorPage'
import RecommendationsPage from './modules/m07/recommendations/RecommendationsPage'

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
  // ROI routes: check roi-calc before roi dashboard to avoid substring clashes
  if (route.startsWith('#/workspace/') && route.includes('/m06/roi-calc')) return <RoiCalculation />
  if (route.startsWith('#/workspace/') && route.includes('/m06/roi')) return <RoiDashboard />
  if (route.startsWith('#/workspace/') && route.includes('/m06/element3')) return <RoiDashboard />
  if (route.startsWith('#/workspace/') && route.includes('/m06/element2')) return <Element2Page />
  if (route.startsWith('#/workspace/') && route.includes('/m06/element1')) return <Element1Page />
  // Module 6 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m06') && !route.includes('/m06/')) return <Module6Home />
  if (route.startsWith('#/workspace/') && route.includes('/m06/campaigns/manage')) return <CampaignManager />
  if (route.startsWith('#/workspace/') && route.includes('/m06/campaigns')) return <ViewCampaigns />
  if (route.startsWith('#/workspace/') && route.includes('/m06/touches/input')) return <CampaignTouchInput />
  if (route.startsWith('#/workspace/') && route.includes('/m06/touches')) return <CampaignTouchViewer />
  if (route.startsWith('#/workspace/') && route.includes('/m06/deals/input')) return <DealInput />
  if (route.startsWith('#/workspace/') && route.includes('/m06/deals')) return <DealViewer />
  if (route.startsWith('#/workspace/') && route.includes('/m06/journeys')) return <JourneyPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m06/run-attribution')) return <RunAttributionScreen />
  if (route.startsWith('#/workspace/') && route.includes('/m06/allocation')) return <AllocationDashboard />
  if (route.startsWith('#/workspace/') && route.includes('/m06/element4')) return <Element4Page />
  if (route.startsWith('#/workspace/') && route.includes('/m06/')) return <Element1Page />
  // Module 7 workspace routes and home
  if (route.startsWith('#/workspace/') && route.includes('/module7/funnel-health')) return <FunnelHealthPage />
  if (route.startsWith('#/workspace/') && route.includes('/module7/leakage-prediction')) return <LeakagePredictionPage />
  if (route.startsWith('#/workspace/') && route.includes('/module7/fatigue-monitor')) return <FatigueMonitorPage />
  if (route.startsWith('#/workspace/') && route.includes('/module7/recommendations')) return <RecommendationsPage />
  if (route.startsWith('#/workspace/') && route.includes('/module7')) return <Module7Home />
  // Module 1 workspace routes and home
  if (route.startsWith('#/workspace/') && route.includes('/m01/merge-columns')) return <MergeCSV />
  if (route.startsWith('#/workspace/') && route.includes('/m01/leads/preview')) return <UploadPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m01/merged')) return <MergedList />
  if (route.startsWith('#/workspace/') && route.includes('/m01/leads')) return <LeadsList />
  if (route.startsWith('#/workspace/') && route.includes('/m01/upload')) return <Upload />
  // Module 1 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m01') && !route.includes('/m01/')) return <Module1Home />
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
      <Module6Dropdown />
      <Login />
    </>
  )
}

export default App
