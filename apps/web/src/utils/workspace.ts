import { useEffect, useState } from 'react';

export function getWorkspaceIdFromHash(): string | null {
  const hash = window.location.hash || '';
  // preferred path form: #/workspace/<id>/... or #/workspace/<id>
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  if (m) return m[1];
  // fallback: older query-style ?workspace=<id> or hash fragments like ...?workspace=<id>
  const m2 = hash.match(/workspace=([a-f0-9\-]+)/i);
  return m2 ? m2[1] : null;
}

type UseWorkspaceIdOptions = {
  redirectToWorkspaces?: boolean;
};

export function useWorkspaceId(options?: UseWorkspaceIdOptions): string | null {
  const { redirectToWorkspaces = false } = options || {};
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => getWorkspaceIdFromHash());

  useEffect(() => {
    const syncWorkspace = () => {
      const wid = getWorkspaceIdFromHash();
      if (!wid && redirectToWorkspaces && window.location.hash !== '#/workspaces') {
        window.location.hash = '#/workspaces';
      }
      setWorkspaceId(wid);
    };

    syncWorkspace();
    window.addEventListener('hashchange', syncWorkspace);
    return () => window.removeEventListener('hashchange', syncWorkspace);
  }, [redirectToWorkspaces]);

  return workspaceId;
}

export default getWorkspaceIdFromHash;
