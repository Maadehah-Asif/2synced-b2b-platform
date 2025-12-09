import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState } from 'react';
import {
  listTouchesByCampaign,
  listTouchesByLead,
  updateTouch,
  archiveTouch,
  deleteTouchPermanent,
  searchCampaigns,
  searchLeads
} from './services/touches';
import { useWorkspaceId } from '../../utils/workspace';

interface TouchRow {
  _id: string;
  lead_id?: number;
  campaign_id?: number;
  campaign_name?: string;
  type: string;
  channel?: string;
  touched_at: string;
  status?: string;
  metadata?: any;
}

const btnPrimary: React.CSSProperties = {
  background: '#0f4258',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13
};

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #0f4258',
  color: '#0f4258',
  padding: '8px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d0d0d0',
  fontSize: 13
};

export default function CampaignTouchViewer() {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: true });

  const [mode, setMode] = useState<'campaign' | 'lead'>('campaign');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [campaignOptions, setCampaignOptions] = useState<any[]>([]);
  const [leadOptions, setLeadOptions] = useState<any[]>([]);
  const [rows, setRows] = useState<TouchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editChannel, setEditChannel] = useState('');
  const [editType, setEditType] = useState('');
  const [editTouchedAt, setEditTouchedAt] = useState('');
  const [editMetadata, setEditMetadata] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterChannel, setFilterChannel] = useState<string>('');

  // Load campaigns
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!workspaceId || mode !== 'campaign') {
        if (!ignore) setCampaignOptions([]);
        return;
      }
      const r = await searchCampaigns('');
      if (!ignore) setCampaignOptions(r.campaigns || []);
    }
    run();
    return () => {
      ignore = true;
    };
  }, [workspaceId, mode]);

  // Load leads
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!workspaceId || mode !== 'lead') {
        if (!ignore) setLeadOptions([]);
        return;
      }
      const r = await searchLeads('');
      if (!ignore) setLeadOptions(r.leads || []);
    }
    run();
    return () => {
      ignore = true;
    };
  }, [workspaceId, mode]);

  async function load() {
    if (!workspaceId || !selectedEntityId) {
      setRows([]);
      return;
    }
    setLoading(true);
    let data: any = [];

    const common = {
      includeArchived: showArchived,
      type: filterType || undefined,
      channel: filterChannel || undefined,
      workspaceId
    };

    if (mode === 'campaign') {
      data = await listTouchesByCampaign({ campaignId: selectedEntityId, ...common } as any);
    } else {
      data = await listTouchesByLead({ leadId: selectedEntityId, ...common } as any);
    }

    let raw: any[] = [];
    if (Array.isArray(data)) raw = data;
    else if (data?.touches) raw = data.touches;

    const formatted = raw
      .map((t: any) => ({
        _id: String(t._id || t.id || ''),
        lead_id: t.lead_id,
        campaign_id: t.campaign_id,
        campaign_name: t.campaign_name || t.campaignName,
        type: t.type,
        channel: t.channel,
        touched_at: t.touched_at || t.touchedAt,
        status: t.status,
        metadata: t.metadata
      }))
      .filter(t => t._id);

    setRows(formatted);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [selectedEntityId, showArchived, filterType, filterChannel, mode, workspaceId]);

  function beginEdit(r: TouchRow) {
    setEditingRowId(r._id);
    setEditChannel(r.channel || '');
    setEditType(r.type);
    setEditTouchedAt(r.touched_at.slice(0, 16));
    setEditMetadata(r.metadata ? JSON.stringify(r.metadata) : '');
  }

  async function saveEdit() {
    if (!editingRowId) return;
    let metadataObj: any = undefined;
    if (editMetadata.trim()) {
      try {
        metadataObj = JSON.parse(editMetadata);
      } catch {
        setToast({ msg: 'Metadata invalid JSON', type: 'error' });
        return;
      }
    }
    const res = await updateTouch(editingRowId, {
      channel: editChannel,
      type: editType,
      touched_at: editTouchedAt,
      metadata: metadataObj
    });
    if ((res as any).error) setToast({ msg: 'Update failed', type: 'error' });
    else {
      setToast({ msg: 'Updated', type: 'success' });
      setEditingRowId(null);
      load();
    }
  }

  async function doArchive(id: string) {
    const r = await archiveTouch(id);
    if ((r as any).error) setToast({ msg: 'Archive failed', type: 'error' });
    else {
      setToast({ msg: 'Archived', type: 'success' });
      load();
    }
  }

  async function doDelete(id: string) {
    if (!confirm('Permanent delete this touch?')) return;
    const r = await deleteTouchPermanent(id);
    if ((r as any).error) setToast({ msg: 'Delete failed', type: 'error' });
    else {
      setToast({ msg: 'Deleted', type: 'success' });
      load();
    }
  }

  return (
    <Layout>
      <main className="page-root">
        <ModuleBackButton toSuffix="/m06" />

        <h2 style={{ marginTop: 16 }}>Campaign Touches</h2>
        <div style={{ fontSize: 12, color: '#555' }}>
          View & manage interaction events. Toggle mode to switch context.
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button
            style={mode === 'campaign' ? btnPrimary : btnGhost}
            onClick={() => {
              setMode('campaign');
              setSelectedEntityId('');
            }}
          >
            By Campaign
          </button>

          <button
            style={mode === 'lead' ? btnPrimary : btnGhost}
            onClick={() => {
              setMode('lead');
              setSelectedEntityId('');
            }}
          >
            By Lead
          </button>
        </div>

        {/* SELECT BLOCK */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            {mode === 'campaign' ? 'Select Campaign' : 'Select Lead'}
          </div>

          <select
            style={inputStyle}
            value={selectedEntityId}
            onChange={e => setSelectedEntityId(e.target.value)}
          >
            <option value="">
              {mode === 'campaign' ? 'Choose a campaign' : 'Choose a lead'}
            </option>

            {mode === 'campaign'
              ? campaignOptions.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))
              : leadOptions.map(l => (
                  <option key={l._id} value={String(l._id)}>
                    #{l.lead_id} {l.name || ''}
                  </option>
                ))}
          </select>
        </div>

        {/* FILTER BAR */}
        <div
          style={{
            marginTop: 18,
            padding: 12,
            background: '#fff',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 18
          }}
        >
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            <span style={{ marginLeft: 6 }}>Show archived</span>
          </label>

          <div style={{ fontSize: 12 }}>Type:</div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="email_open">Email Open</option>
            <option value="email_click">Email Click</option>
            <option value="ad_click">Ad Click</option>
            <option value="webinar">Webinar</option>
            <option value="form_submit">Form Submit</option>
            <option value="other">Other</option>
          </select>

          <div style={{ fontSize: 12 }}>Channel:</div>
          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="email">Email</option>
            <option value="ads">Ads</option>
            <option value="linkedin">LinkedIn</option>
            <option value="webinar">Webinar</option>
            <option value="other">Other</option>
          </select>

          <button style={btnGhost} onClick={() => load()}>
            Reload
          </button>
        </div>

        {/* TABLE */}
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 8, padding: 12 }}>
          {loading && <div style={{ fontSize: 12 }}>Loading...</div>}

          {!loading && rows.length === 0 && (
            <div style={{ fontSize: 12 }}>
              {selectedEntityId
                ? 'No touches found for this selection.'
                : 'Select a campaign or lead above to see touches.'}
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 6 }}>Lead</th>
                  <th style={{ padding: 6 }}>Campaign</th>
                  <th style={{ padding: 6 }}>Type</th>
                  <th style={{ padding: 6 }}>Channel</th>
                  <th style={{ padding: 6 }}>Touched At</th>
                  <th style={{ padding: 6 }}>Status</th>
                  <th style={{ padding: 6 }}>Metadata</th>
                  <th style={{ padding: 6 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(r => {
                  const editing = editingRowId === r._id;

                  return (
                    <tr key={r._id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 6 }}>#{r.lead_id}</td>
                      <td style={{ padding: 6 }}>{r.campaign_name}</td>

                      {/* TYPE */}
                      <td style={{ padding: 6 }}>
                        {editing ? (
                          <select
                            value={editType}
                            onChange={e => setEditType(e.target.value)}
                            style={inputStyle}
                          >
                            <option value="email_open">Email Open</option>
                            <option value="email_click">Email Click</option>
                            <option value="ad_click">Ad Click</option>
                            <option value="webinar">Webinar</option>
                            <option value="form_submit">Form Submit</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          r.type
                        )}
                      </td>

                      {/* CHANNEL */}
                      <td style={{ padding: 6 }}>
                        {editing ? (
                          <select
                            value={editChannel}
                            onChange={e => setEditChannel(e.target.value)}
                            style={inputStyle}
                          >
                            <option value="email">Email</option>
                            <option value="ads">Ads</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="webinar">Webinar</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          r.channel
                        )}
                      </td>

                      {/* DATE */}
                      <td style={{ padding: 6 }}>
                        {editing ? (
                          <input
                            type="datetime-local"
                            value={editTouchedAt}
                            onChange={e => setEditTouchedAt(e.target.value)}
                            style={inputStyle}
                          />
                        ) : (
                          new Date(r.touched_at).toLocaleString()
                        )}
                      </td>

                      <td style={{ padding: 6 }}>{r.status || 'active'}</td>

                      {/* METADATA */}
                      <td style={{ padding: 6, maxWidth: 160 }}>
                        {editing ? (
                          <textarea
                            rows={2}
                            style={{ ...inputStyle, resize: 'none' }}
                            value={editMetadata}
                            onChange={e => setEditMetadata(e.target.value)}
                          />
                        ) : r.metadata ? (
                          JSON.stringify(r.metadata)
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: 6 }}>
                        {!editing ? (
                          <>
                            <button style={btnGhost} onClick={() => beginEdit(r)}>
                              Edit
                            </button>
                            <button style={btnGhost} onClick={() => doArchive(r._id)}>
                              Archive
                            </button>
                            <button
                              style={{ ...btnGhost, color: '#c33', borderColor: '#c33' }}
                              onClick={() => doDelete(r._id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button style={btnPrimary} onClick={saveEdit}>
                              Save
                            </button>
                            <button
                              style={{ ...btnGhost, marginLeft: 6 }}
                              onClick={() => setEditingRowId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* TOAST */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              right: 16,
              bottom: 16,
              background: toast.type === 'success' ? '#0a7' : '#c33',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 8
            }}
          >
            <div>{toast.msg}</div>
            <button
              style={{ ...btnGhost, background: '#fff', color: '#333', marginTop: 6 }}
              onClick={() => setToast(null)}
            >
              Close
            </button>
          </div>
        )}
      </main>
    </Layout>
  );
}
