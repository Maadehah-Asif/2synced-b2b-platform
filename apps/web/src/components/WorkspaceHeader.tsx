import { useEffect, useState } from 'react';
import '../styles/components.css';

function getWorkspaceIdFromHash(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  if (m) return m[1];
  const m2 = hash.match(/workspace=([a-f0-9]+)/i);
  return m2 ? m2[1] : null;
}

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
    <div style={{ position: 'fixed', top: 64, left: 0, right: 0, height: 48, background: 'var(--primary-1)', borderBottom: '1px solid rgba(0,0,0,0.06)', zIndex: 1900 }}>
      <div className="header-row" style={{ height: '100%', padding: '0 16px' }}>
        <div className="flex gap-12 align-center">
          <button className="btn-ghost btn-sm" onClick={() => go(`#/workspace/${workspaceId}`)}>Overview</button>
          {/* Modules dropdowns */}
          <div className="dropdown">
            <button
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'm01' ? null : 'm01');
              }}
            >
              Module 1 ▾
            </button>
            {openMenu === 'm01' && (
              <div className="dropdown-menu dropdown-menu-light">
                <div
                  className="dropdown-item"
                  onClick={() => { setOpenMenu(null); go(`#/m01/upload?workspace=${workspaceId}`); }}
                >
                  Upload Leads
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => { setOpenMenu(null); go(`#/m01/merged?workspace=${workspaceId}`); }}
                >
                  View Merged CSVs
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => { setOpenMenu(null); go(`#/m01/leads?workspace=${workspaceId}`); }}
                >
                  View Leads Code CSVs
                </div>
              </div>
            )}
          </div>
          {[2,3,4,5,6].map(mod => (
            <button
              key={mod}
              className="btn-ghost btn-sm"
              onClick={() => go(modulePath(mod))}
            >
              Module {mod}
            </button>
          ))}
          <div className="dropdown">
            <button
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'm07' ? null : 'm07');
              }}
            >
              Module 7 ▾
            </button>
            {openMenu === 'm07' && (
              <div className="dropdown-menu dropdown-menu-light">
                <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/element1`); }}>Element 1</div>
                <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/element2`); }}>Element 2</div>
                <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/element3`); }}>Element 3</div>
                <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/element4`); }}>Element 4</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/campaigns`); }}>Campaigns</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/campaigns/manage`); }}>Add Campaign</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/touches`); }}>Campaign Touches</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/touches/input`); }}>Add Touches</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/deals`); }}>Deals</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/deals/input`); }}>Add Deals</div>
                  <div className="dropdown-item" onClick={() => { setOpenMenu(null); go(`#/workspace/${workspaceId}/m07/journeys`); }}>Journey Preview</div>
                {/* Import handled from Campaigns page — removed redundant menu item */}
              </div>
            )}
          </div>
          {[8,9].map(mod => (
            <button
              key={mod}
              className="btn-ghost btn-sm"
              onClick={() => go(modulePath(mod))}
            >
              Module {mod}
            </button>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => go(`#/workspace/${workspaceId}/members`)}>Members</button>
        </div>
      </div>
    </div>
  );
}
