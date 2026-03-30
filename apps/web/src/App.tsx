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
import Module3Home from './modules/m03/Module3Home';
import ConversationManualLog from './modules/m03/ConversationManualLog';
import ConversationUpload from './modules/m03/ConversationUpload';
import ConversationExplorer from './modules/m03/ConversationExplorer';
import ConversationThreadDetail from './modules/m03/ConversationThreadDetail';
import DealHealthBoard from './modules/m03/DealHealthBoard';
import FollowUpsPage from './modules/m03/FollowUpsPage';
import AnalyticsPage from './modules/m03/AnalyticsPage';
import OrgTimelinePage from './modules/m03/OrgTimelinePage';
import Module3Companies from './modules/m03/Module3Companies';
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

  // ===================== MODULE 3 ROUTES =====================
  // Order matters: more specific routes first
  if (route.startsWith('#/workspace/') && route.includes('/m03/conversations/')) {
    return <ConversationThreadDetail />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/deal-health')) {
    return <DealHealthBoard />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/follow-ups')) {
    return <FollowUpsPage />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/analytics')) {
    return <AnalyticsPage />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/explorer')) {
    return <ConversationExplorer />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/org-timeline')) {
    return <OrgTimelinePage />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/companies')) {
    return <Module3Companies />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/upload')) {
    return <ConversationUpload />;
  }
  if (route.startsWith('#/workspace/') && route.includes('/m03/manual-log')) {
    return <ConversationManualLog />;
  }
  // Module 3 workspace home (must be last, after all /m03/ routes)
  if (route.startsWith('#/workspace/') && route.includes('/m03') && !route.includes('/m03/')) {
    return <Module3Home />;
  }
  // ===========================================================

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
