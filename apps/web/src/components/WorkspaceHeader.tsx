import { useEffect, useState } from 'react';
import '../styles/components.css';
import { getWorkspaceIdFromHash } from '../utils/workspace';

export default function WorkspaceHeader(){
  const workspaceId = getWorkspaceIdFromHash();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function go(path: string){
    if (!workspaceId) return;
    window.location.hash = path.replace(':workspaceId', workspaceId);
  }

  function modulePath(mod: number){
    if (!workspaceId) return '#/landing';
    if (mod === 1) return `#/workspace/${workspaceId}/m01`;
    return `#/workspace/${workspaceId}/m0${mod}`;
  }

  useEffect(() => {
    function handleClick(e: MouseEvent){
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.dropdown')) return;
      setOpenMenu(null);
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 72, left: 0, right: 0, height: 56, background: 'var(--header-secondary)', zIndex: 1900, boxShadow: '0 6px 18px rgba(4,12,24,0.06)' }}>
      <div className="header-row" style={{ height: '100%', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="flex gap-12 align-center">
            <button className="btn-ghost-translucent btn-sm" onClick={() => go(`#/workspace/${workspaceId}`)} style={{ color: '#fff' }}>Overview</button>
            {/* Module navigation moved to workspace cards — keep only Members here */}
            <button className="btn-ghost-translucent btn-sm" onClick={() => go(`#/workspace/${workspaceId}/members`)} style={{ color: '#fff' }}>Members</button>
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}
