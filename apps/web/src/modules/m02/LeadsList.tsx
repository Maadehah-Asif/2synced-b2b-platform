import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function LeadsListM02() {
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt_desc' | 'createdAt_asc' | 'name_asc' | 'name_desc'>('createdAt_desc');
  const [message, setMessage] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<null | (() => void)>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [mergedOptions, setMergedOptions] = useState<any[]>([]);
  const [selMerged, setSelMerged] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  const darkBlue = "#0f4258";

  // --- UNIVERSAL SMALL SIZES (NO OVERFLOW) ---
  const inputStyle = {
    height: 34,
    width: 160,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 13
  };

  const selectStyle = {
    height: 34,
    width: 160,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 13
  };

  const btnStyle = {
    height: 34,
    minWidth: 95,
    background: darkBlue,
    color: "white",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer"
  };

  const smallBtn = {
    ...btnStyle
  };

  useEffect(() => {
    fetchList();
    fetchMerged();
  }, [workspace, sort]);

  const setPreviewReturn = () => {
    try {
      sessionStorage.setItem('m02_preview_return', window.location.hash || '');
    } catch (e) {}
  };

  async function fetchList() {
    if (!workspace) {
      setMessage('Workspace required');
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/m01/leads?workspace=${workspace}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      );
      const j = await res.json();
      if (j?.ok) setItems(j.items || []);
      else setMessage(j?.error || 'failed to load');
    } catch (e) {
      setMessage('network error');
    }
  }

  async function fetchMerged() {
    if (!workspace) return;
    try {
      const res = await fetch(`${API_URL}/m01/merges?workspace=${workspace}&sort=createdAt_desc`);
      const j = await res.json();
      if (j?.ok) setMergedOptions(j.items || []);
    } catch (e) {}
  }

  async function createLeads() {
    if (!workspace) return setMessage('Workspace required');
    if (!selMerged) return setMessage('Select a merged CSV');

    setRetryAction(null);
    setCreating(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/m01/leads/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ workspace, mergedId: selMerged, name: newName, moduleKey: 'm02' })
      });
      const j = await res.json();
      if (j?.ok) {
        setNewName('');
        setSelMerged('');
        await fetchList();
      } else {
        setMessage(j?.error || 'failed to generate');
        setRetryAction(() => createLeads);
      }
    } catch (e) {
      setMessage('network error');
      setRetryAction(() => createLeads);
    }
    setCreating(false);
  }

  const sorted = useMemo(() => items, [items]);

  return (
    <Layout>
      <div className="p-20">

        {/* HEADER */}
        <div className="mb-12" style={{ display: "flex", alignItems: "center" }}>
          <ModuleBackButton toSuffix="/m02" />
          <h2 style={{ margin: 0 }}>Module 02 - Leads Code CSVs</h2>
        </div>

        {/* ONE SINGLE ROW – ALL 6 ITEMS – NO OVERFLOW */}
        <div
          className="card p-12"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "nowrap",
            overflow: "hidden"
          }}
        >
          {/* LEFT SIDE */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              placeholder="Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
            />

            <select
              value={selMerged}
              onChange={(e) => setSelMerged(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select merged CSV...</option>
              {mergedOptions.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name || m.filename}
                </option>
              ))}
            </select>

            <button style={btnStyle} disabled={creating || !selMerged} onClick={createLeads}>
              {creating ? "Creating..." : "Create"}
            </button>
          </div>

          {/* RIGHT SIDE */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              placeholder="Search name or filename"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={inputStyle}
            />

            <button style={smallBtn} onClick={fetchList}>Search</button>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              style={selectStyle}
            >
              <option value="createdAt_desc">Newest first</option>
              <option value="createdAt_asc">Oldest first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </select>
          </div>
        </div>

        {/* ERRORS */}
        {message && (
          <div className="mt-8 muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{message}</span>
            {retryAction && (
              <button style={smallBtn} onClick={retryAction}>Retry</button>
            )}
          </div>
        )}

        {/* LIST */}
        <ul className="mt-12">
          {sorted.map((m) => (
            <li key={m._id} className="list-item">
              <div className="meta">
                <strong>{m.name || m.filename}</strong> — {new Date(m.createdAt).toLocaleString()}
              </div>

              <div style={{ marginTop: 6 }}>
                <button
                  style={{ ...smallBtn, marginRight: 6 }}
                  onClick={() => {
                    setPreviewReturn();
                    if (workspace) window.location.hash = `#/workspace/${workspace}/m02/leads/preview/${m._id}`;
                    else window.location.hash = `#/m02/leads/preview/${m._id}`;
                  }}
                >
                  Preview
                </button>

                <button
                  style={{ ...smallBtn, marginRight: 6 }}
                  onClick={async () => {
                    const res = await fetch(`${API_URL}/m01/leads/${m._id}?workspace=${workspace}`);
                    const j = await res.json();
                    if (j?.ok) setDetails(j.item);
                    else setMessage("failed to load details");
                  }}
                >
                  Details
                </button>

                <button
                  style={smallBtn}
                  onClick={async () => {
                    if (!workspace) return setMessage("Workspace required");
                    try {
                      const res = await fetch(`${API_URL}/m01/leads/${m._id}/download?workspace=${workspace}`);
                      if (!res.ok) return setMessage("download failed");

                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${m.name || m.filename || "leads"}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch (e) {
                      setMessage("download failed");
                    }
                  }}
                >
                  CSV
                </button>
              </div>
            </li>
          ))}
        </ul>

      </div>
    </Layout>
  );
}
