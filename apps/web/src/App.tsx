import { useEffect, useState } from 'react';
import Login from './modules/core/auth/Login';
import Signup from './modules/core/auth/Signup';
import Landing from './modules/core/landing/Landing';
import CreateWorkspace from './modules/core/landing/CreateWorkspace';
import JoinWorkspace from './modules/core/landing/JoinWorkspace';
import Profile from './modules/core/profile/Profile';
import WorkspacesList from './modules/core/landing/WorkspacesList';
import WorkspaceDetail from './modules/core/landing/WorkspaceDetail';
import Upload from './modules/m01/Upload';
import './components/Layout';
import './App.css';

function App() {
  const [route, setRoute] = useState<string>(() => window.location.hash || "#/login");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/login");
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Render pages — individual pages will use Layout when needed.
  if (route.startsWith('#/signup')) return <Signup/>;
  if (route.startsWith('#/login')) return <Login/>;
  if (route.startsWith('#/landing')) return <Landing/>;
  if (route.startsWith('#/create-workspace')) return <CreateWorkspace/>;
  if (route.startsWith('#/join-workspace')) return <JoinWorkspace/>;
  if (route.startsWith('#/profile')) return <Profile/>;
  if (route.startsWith('#/workspaces')) return <WorkspacesList/>;
  if (route.startsWith('#/workspace/')) return <WorkspaceDetail/>;
  if (route.startsWith('#/m01/upload')) return <Upload/>;
  return <Login/>;
}

export default App;
