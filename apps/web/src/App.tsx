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
import Module6Main from './modules/m06/Module6Main'
import Module6Home from './modules/m06/Module6Home'
import Module1Home from './modules/m01/Module1Home'
import Module2Home from './modules/m02/Module2Home'
import Module7Home from './modules/m07/Module7Home'
import LeadAddUpload from './modules/m07/LeadAddUpload'
import LeadList from './modules/m07/LeadList'
import LeadDetail from './modules/m07/LeadDetail'
import StageAddUpload from './modules/m07/StageAddUpload'
import StageList from './modules/m07/StageList'
import StageDetail from './modules/m07/StageDetail'
import InteractionAddUpload from './modules/m07/InteractionAddUpload'
import InteractionList from './modules/m07/InteractionList'
import InteractionDetail from './modules/m07/InteractionDetail'
import RoiDashboard from './modules/m06/RoiDashboard'
import CampaignManager from './modules/m06/CampaignManager'
import ViewCampaigns from './modules/m06/ViewCampaigns'
import CampaignTouchInput from './modules/m06/CampaignTouchInput'
import CampaignTouchViewer from './modules/m06/CampaignTouchViewer'
import Module6Leads from './modules/m06/Module6Leads'
import DealInput from './modules/m06/DealInput'
import DealViewer from './modules/m06/DealViewer'
import JourneyPreview from './modules/m06/JourneyPreview'
import RunAttributionScreen from './modules/m06/RunAttributionScreen'
import AllocationDashboard from './modules/m06/AllocationDashboard'
import RoiCalculation from './modules/m06/RoiCalculation'
import GenerateIntent from './modules/m02/GenerateIntent'
import Prioritization from './modules/m02/Prioritization'
import IntentForecast from './modules/m02/IntentForecast'
import UploadM02 from './modules/m02/Upload'
import UploadPreviewM02 from './modules/m02/UploadPreview'
import MergedListM02 from './modules/m02/MergedList'
import LeadsListM02 from './modules/m02/LeadsList'
import MergeCSVM02 from './modules/m02/MergeCSV'
import ForecastPage from './modules/m06/ForecastPage'
import UploadWizardM02 from './modules/m02/UploadWizard'

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
  if (route.startsWith('#/workspace/') && route.includes('/m06/element1')) return <Module6Main />
  if (route.startsWith('#/workspace/') && route.includes('/m06/forecast')) return <ForecastPage />
  // Module 6 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m06') && !route.includes('/m06/')) return <Module6Home />
  if (route.startsWith('#/workspace/') && route.includes('/m06/campaigns/manage')) return <CampaignManager />
  if (route.startsWith('#/workspace/') && route.includes('/m06/campaigns')) return <ViewCampaigns />
  if (route.startsWith('#/workspace/') && route.includes('/m06/touches/input')) return <CampaignTouchInput />
  if (route.startsWith('#/workspace/') && route.includes('/m06/touches')) return <CampaignTouchViewer />
  if (route.startsWith('#/workspace/') && route.includes('/m06/leads')) return <Module6Leads />
  if (route.startsWith('#/workspace/') && route.includes('/m06/deals/input')) return <DealInput />
  if (route.startsWith('#/workspace/') && route.includes('/m06/deals')) return <DealViewer />
  if (route.startsWith('#/workspace/') && route.includes('/m06/journeys')) return <JourneyPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m06/run-attribution')) return <RunAttributionScreen />
  if (route.startsWith('#/workspace/') && route.includes('/m06/allocation')) return <AllocationDashboard />
  if (route.startsWith('#/workspace/') && route.includes('/m06/')) return <Module6Main />
  // Module 1 workspace routes and home
  if (route.startsWith('#/workspace/') && route.includes('/m01/upload/preview')) return <UploadPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m01/merged/preview')) return <UploadPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m01/leads/preview')) return <UploadPreview />
  if (route.startsWith('#/workspace/') && route.includes('/m01/merge-columns')) return <MergeCSV />
  if (route.startsWith('#/workspace/') && route.includes('/m01/merged')) return <MergedList />
  if (route.startsWith('#/workspace/') && route.includes('/m01/leads')) return <LeadsList />
  if (route.startsWith('#/workspace/') && route.includes('/m01/upload')) return <Upload />
  // Module 02 routes (duplicate Module 1 flows + intent features)
  if (route.startsWith('#/workspace/') && route.includes('/m02/upload/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/merged/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/leads/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/merge-columns')) return <MergeCSVM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/merged')) return <MergedListM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/leads')) return <LeadsListM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/upload')) return <UploadM02 />
  if (route.startsWith('#/workspace/') && route.includes('/m02/generate')) return <GenerateIntent />
  if (route.startsWith('#/workspace/') && route.includes('/m02/prioritization')) return <Prioritization />
  if (route.startsWith('#/workspace/') && route.includes('/m02/intent-forecast')) return <IntentForecast />
  if (route.startsWith('#/workspace/') && route.includes('/m02/upload-wizard')) return <UploadWizardM02 />
  // Module 2 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m02') && !route.includes('/m02/')) return <Module2Home />
  // Module 7 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m07') && !route.includes('/m07/')) return <Module7Home />
  // More specific m07 routes first so upload/list resolve before detail
  if (route.startsWith('#/workspace/') && route.includes('/m07/leads/upload')) return <LeadAddUpload />
  if (route.startsWith('#/workspace/') && route.includes('/m07/leads') && !route.includes('/m07/leads/')) return <LeadList />
  if (route.startsWith('#/workspace/') && route.includes('/m07/leads/')) return <LeadDetail />
  // m07 stage history routes
  if (route.startsWith('#/workspace/') && route.includes('/m07/stages/upload')) return <StageAddUpload />
  if (route.startsWith('#/workspace/') && route.includes('/m07/stages') && !route.includes('/m07/stages/')) return <StageList />
  if (route.startsWith('#/workspace/') && route.includes('/m07/stages/')) return <StageDetail />
  // m07 interaction routes
  if (route.startsWith('#/workspace/') && route.includes('/m07/interactions/upload')) return <InteractionAddUpload />
  if (route.startsWith('#/workspace/') && route.includes('/m07/interactions') && !route.includes('/m07/interactions/')) return <InteractionList />
  if (route.startsWith('#/workspace/') && route.includes('/m07/interactions/')) return <InteractionDetail />
  if (route.startsWith('#/m07/leads/')) return <LeadDetail />
  if (route.startsWith('#/m07/leads')) return <LeadList />
  if (route.startsWith('#/m07/leads/upload')) return <LeadAddUpload />
  if (route.startsWith('#/m07/stages/upload')) return <StageAddUpload />
  if (route.startsWith('#/m07/stages/') ) return <StageDetail />
  if (route.startsWith('#/m07/stages')) return <StageList />
  // Module 1 workspace home (no trailing slash)
  if (route.startsWith('#/workspace/') && route.includes('/m01') && !route.includes('/m01/')) return <Module1Home />
  if (route.startsWith('#/workspace/')) return <WorkspaceDetail />
  if (route.startsWith('#/workspaces')) return <WorkspacesList />

  // Existing m01 routes
  // Module 02 (non-workspace)
  if (route.startsWith('#/m02/upload/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/m02/merged/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/m02/leads/preview')) return <UploadPreviewM02 />
  if (route.startsWith('#/m02/merge-columns')) return <MergeCSVM02 />
  if (route.startsWith('#/m02/merged')) return <MergedListM02 />
  if (route.startsWith('#/m02/leads')) return <LeadsListM02 />
  if (route.startsWith('#/m02/upload')) return <UploadM02 />
  // Module 01 (non-workspace)
  if (route.startsWith('#/m01/upload/preview')) return <UploadPreview />
  if (route.startsWith('#/m01/merged/preview')) return <UploadPreview />
  if (route.startsWith('#/m01/leads/preview')) return <UploadPreview />
  if (route.startsWith('#/m01/merge-columns')) return <MergeCSV />
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
