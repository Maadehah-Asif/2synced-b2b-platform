import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { useEffect, useState, type CSSProperties } from 'react';
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

/* THEME STYLES */


const btnPrimary: CSSProperties = {
  background: '#0f4258',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  height: 40,
  width: 140,         // ← ADD THIS
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const btnGhost: CSSProperties = {
  background: 'transparent',
  border: '1px solid #0f4258',
  color: '#0f4258',
  padding: '8px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  height: 40,
  width: 140,         // ← ADD THIS
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};


const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d0d0d0',
  fontSize: 13,
  height: 40,
  boxSizing: 'border-box'
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

  /* Load Campaigns */
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
    return () => { ignore = true; };
  }, [workspaceId, mode]);

  /* Load Leads */
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
    return () => { ignore = true; };
  }, [workspaceId, mode]);

  /* Load Touches */
  async function load() {
    if (!workspaceId || !selectedEntityId) {
      setRows([]);
      return;
    }
    setLoading(true);

    const common = {
      includeArchived: showArchived,
      type: filterType || undefined,
      channel: filterChannel || undefined,
      workspaceId
    };

    let data: any = [];
    if (mode === 'campaign') {
      data = await listTouchesByCampaign({ campaignId: selectedEntityId, ...common } as any);
    } else {
      data = await listTouchesByLead({ leadId: selectedEntityId, ...common } as any);
    }

    let raw: any[] = [];
    if (Array.isArray(data)) raw = data;
    else if (data?.touches) raw = data.touches;

    const formatted: TouchRow[] = raw
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

  /* Editing helpers */

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

    if ((res as any).error) {
      setToast({ msg: 'Update failed', type: 'error' });
    } else {
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
        <ModuleBackButton toSuffix="" />

        <h2 style={{ marginTop: 16 }}>Campaign Touches</h2>
        <div style={{ fontSize: 12, color: '#555' }}>
          View & manage interaction events. Toggle mode to switch context.
        </div>

        {/* SINGLE CRM-STYLE CONTROL BAR */}
        <div
          style={{
            marginTop: 18,
            background: '#fff',
            padding: 12,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {/* Mode buttons */}
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

          {/* Entity select */}
          <div style={{ minWidth: 260, maxWidth: 360, flexShrink: 0 }}>
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

          {/* Type filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>Type</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            >
              <option value="">All</option>
              <option value="email_open">Email Open</option>
              <option value="email_click">Email Click</option>
              <option value="ad_click">Ad Click</option>
              <option value="webinar">Webinar</option>
              <option value="form_submit">Form Submit</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Channel filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>Channel</span>
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            >
              <option value="">All</option>
              <option value="email">Email</option>
              <option value="ads">Ads</option>
              <option value="linkedin">LinkedIn</option>
              <option value="webinar">Webinar</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Spacer */}
          <div style={{ flexGrow: 1 }} />

          {/* Show archived */}
          <label
            style={{
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>

          {/* Reload */}
          <button style={btnGhost} onClick={() => load()}>
            Reload
          </button>
        </div>

        {/* RESULTS TABLE */}
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
                  <th style={{ padding: 6, textAlign: 'left' }}>Lead</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Campaign</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Type</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Channel</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Touched At</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Status</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Metadata</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(r => {
                  const editing = editingRowId === r._id;

                  return (
                    <tr key={r._id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 6 }}>#{r.lead_id}</td>
                      <td style={{ padding: 6 }}>{r.campaign_name}</td>

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
