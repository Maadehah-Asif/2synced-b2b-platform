import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import {
  runAttribution,
  listRuns,
  getRunSummary,
  previewDealsCount,
  fetchCampaignSummaries,
  ApiError,
} from './services/attributionRuns';
import type {
  AttributionRunRecord,
  RunSummaryResponse,
  RunAttributionRequest,
  RunAttributionResponse,
  CampaignOption,
  AttributionFilterSummary,
  AttributionExcludedSummary,
} from './services/attributionRuns';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import '../m06/module6.css';

type RunConfig = RunAttributionRequest;
type StatusFilter = 'closedWon' | 'closedWonLost';
type MessageState = { type: 'info' | 'error'; text: string } | null;

const modelOptions = [
  {
    value: 'first_touch' as const,
    label: 'First-touch',
    description: 'Assigns 100% credit to the first campaign touch in the journey.',
  },
  {
    value: 'last_touch' as const,
    label: 'Last-touch',
    description: 'Assigns 100% credit to the final campaign touch before the deal closes.',
  },
  {
    value: 'linear' as const,
    label: 'Linear',
    description: 'Splits credit equally across every campaign touch in the journey.',
  },
];

const statusOptions = [
  {
    value: 'closedWon' as const,
    label: 'Closed won only',
    description: 'Ignore closed-lost deals so results focus on revenue you secured.',
  },
  {
    value: 'closedWonLost' as const,
    label: 'Closed won + lost',
    description: 'Include all closed deals to compare how touches influenced lost deals.',
  },
];

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'ads', label: 'Ads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'other', label: 'Other' },
];

const CHANNEL_LABEL_MAP = CHANNEL_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return currencyFormatter.format(value);
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0';
  return integerFormatter.format(value);
}

function formatInputDate(date: Date) {
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

function modelLabel(model: 'first_touch' | 'last_touch' | 'linear') {
  const match = modelOptions.find(opt => opt.value === model);
  return match ? match.label : model;
}

function formatTimestamp(input?: string) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function createDefaultConfig(): RunConfig {
  const now = new Date();
  const to = formatInputDate(now);
  const from = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
  return {
    model_type: 'linear',
    date_from: formatInputDate(from),
    date_to: to,
    closedWonOnly: true,
    includeArchived: false,
    requiredChannels: [],
    requiredCampaignIds: [],
  };
}

function mapError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'no_deals_in_window':
        return 'No deals found for this date range. Try expanding the window or lowering filters.';
      case 'run_in_progress':
        return 'Another attribution run is already in progress. Please wait for it to finish.';
      case 'run_not_found':
        return 'We could not find that attribution run. It may have been deleted.';
      case 'projectId_required':
        return 'Workspace context is missing. Please reopen the workspace and try again.';
      case 'no_deals_after_filters': {
        const detail = (err.details as { excludedByFilters?: AttributionExcludedSummary } | undefined)?.excludedByFilters;
        if (detail) {
          const parts: string[] = [];
          if (detail.channels) parts.push(`${detail.channels} without required channels`);
          if (detail.campaigns) parts.push(`${detail.campaigns} without required campaigns`);
          if (detail.noTouches) parts.push(`${detail.noTouches} without any qualifying touches`);
          if (parts.length) {
            return `No deals match these advanced filters (${parts.join(', ')}). Try relaxing the channel or campaign requirements.`;
          }
        }
        return 'No deals match these advanced filters. Try relaxing the channel or campaign requirements.';
      }
      default:
        return err.message || 'The request failed. Please try again.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected error. Please retry in a moment.';
}

export default function RunAttributionScreen() {
  const [projectId, setProjectId] = useState<string | null>(() => getWorkspaceIdFromHash());
  const [config, setConfig] = useState<RunConfig>(() => createDefaultConfig());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('closedWon');
  const [running, setRunning] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [runs, setRuns] = useState<AttributionRunRecord[]>([]);
  const [summary, setSummary] = useState<RunSummaryResponse | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [storedDefaultRunId, setStoredDefaultRunId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [openAllocDealId, setOpenAllocDealId] = useState<string | null>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewExclusions, setPreviewExclusions] = useState<AttributionExcludedSummary | null>(null);

  const activeRunStorageKey = useMemo(() => (projectId ? `m06::activeRunId::${projectId}` : null), [projectId]);
  const activeRunIdRef = useRef<string | null>(null);
  const summaryRef = useRef<RunSummaryResponse | null>(null);

  const selectedChannels = useMemo(
    () => CHANNEL_OPTIONS.map(option => option.value).filter(value => (config.requiredChannels || []).includes(value)),
    [config.requiredChannels]
  );

  const selectedCampaignIds = useMemo(() => config.requiredCampaignIds || [], [config.requiredCampaignIds]);

  const filteredCampaignOptions = useMemo(() => {
    if (!campaignSearch.trim()) return campaignOptions;
    const needle = campaignSearch.trim().toLowerCase();
    return campaignOptions.filter(option => option.name.toLowerCase().includes(needle));
  }, [campaignOptions, campaignSearch]);

  const selectedCampaignOptions = useMemo(
    () => campaignOptions.filter(option => selectedCampaignIds.includes(option.id)),
    [campaignOptions, selectedCampaignIds]
  );

  const campaignNameLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const option of campaignOptions) map[option.id] = option.name;
    return map;
  }, [campaignOptions]);

  const hasAdvancedFilters = selectedChannels.length > 0 || selectedCampaignIds.length > 0;
  const activeAdvancedCount = selectedChannels.length + selectedCampaignIds.length;

  const previewExclusionSummary = useMemo(() => {
    if (!previewExclusions) return '';
    const parts: string[] = [];
    if (previewExclusions.channels) parts.push(`${previewExclusions.channels} lacking required channels`);
    if (previewExclusions.campaigns) parts.push(`${previewExclusions.campaigns} lacking required campaigns`);
    if (previewExclusions.noTouches) parts.push(`${previewExclusions.noTouches} without touches`);
    return parts.join(', ');
  }, [previewExclusions]);

  const showLegacySummary = false;

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    const syncWorkspace = () => {
      const wid = getWorkspaceIdFromHash();
      if (!wid) {
        setProjectId(null);
        if (window.location.hash !== '#/workspaces') {
          window.location.hash = '#/workspaces';
        }
        return;
      }
      setProjectId(wid);
    };

    syncWorkspace();
    window.addEventListener('hashchange', syncWorkspace);
    return () => {
      window.removeEventListener('hashchange', syncWorkspace);
    };
  }, []);

  useEffect(() => {
    if (activeRunStorageKey) {
      setStoredDefaultRunId(localStorage.getItem(activeRunStorageKey));
    } else {
      setStoredDefaultRunId(null);
    }
  }, [activeRunStorageKey]);

  useEffect(() => {
    if (!advancedOpen && (selectedChannels.length > 0 || selectedCampaignIds.length > 0)) {
      setAdvancedOpen(true);
    }
  }, [advancedOpen, selectedCampaignIds.length, selectedChannels.length]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setCampaignsLoading(true);
    setCampaignError(null);
    fetchCampaignSummaries(projectId)
      .then(options => {
        if (cancelled) return;
        setCampaignOptions(options);
      })
      .catch(err => {
        if (cancelled) return;
        setCampaignOptions([]);
        setCampaignError(mapError(err));
      })
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const fetchSummaryForRun = useCallback(async (pid: string, runId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) setSummaryLoading(true);
    try {
      const data = await getRunSummary(pid, runId);
      setSummary(data);
      summaryRef.current = data;
      setOpenAllocDealId(null);
    } catch (err) {
      setSummary(null);
      summaryRef.current = null;
      setMessage({ type: 'error', text: mapError(err) });
    } finally {
      if (!options?.silent) setSummaryLoading(false);
    }
  }, []);

  const refreshRuns = useCallback(
    async (pid: string, opts?: { preferRunId?: string; silent?: boolean; skipIfSummaryMatches?: boolean }) => {
      if (!opts?.silent) setRunsLoading(true);
      try {
        const response = await listRuns(pid);
        const runList = response?.runs || [];
        setRuns(runList);

        if (activeRunStorageKey) {
          setStoredDefaultRunId(localStorage.getItem(activeRunStorageKey));
        }

        const candidateOrder = [
          opts?.preferRunId,
          activeRunIdRef.current,
          activeRunStorageKey ? localStorage.getItem(activeRunStorageKey) : null,
          runList.length ? runList[0]._id : null,
        ];

        const resolved = candidateOrder.find(id => id && runList.some(r => r._id === id)) || null;

        if (resolved) {
          if (resolved !== activeRunIdRef.current) {
            setActiveRunId(resolved);
            activeRunIdRef.current = resolved;
          }

          const shouldSkip = opts?.skipIfSummaryMatches && summaryRef.current?.run.id === resolved;
          if (!shouldSkip) {
            await fetchSummaryForRun(pid, resolved, { silent: opts?.silent });
          }
        } else {
          setActiveRunId(null);
          activeRunIdRef.current = null;
          setSummary(null);
          summaryRef.current = null;
        }
      } catch (err) {
        setMessage({ type: 'error', text: mapError(err) });
      } finally {
        if (!opts?.silent) setRunsLoading(false);
      }
    },
    [activeRunStorageKey, fetchSummaryForRun]
  );

  const toggleChannel = useCallback((channel: string) => {
    setAdvancedOpen(true);
    setConfig(prev => {
      const current = new Set(prev.requiredChannels || []);
      if (current.has(channel)) current.delete(channel); else current.add(channel);
      const ordered = CHANNEL_OPTIONS.map(option => option.value).filter(value => current.has(value));
      return { ...prev, requiredChannels: ordered };
    });
  }, []);

  const toggleCampaign = useCallback((campaignId: string) => {
    setAdvancedOpen(true);
    setConfig(prev => {
      const current = new Set(prev.requiredCampaignIds || []);
      if (current.has(campaignId)) current.delete(campaignId); else current.add(campaignId);
      const ordered = campaignOptions.map(option => option.id).filter(id => current.has(id));
      return { ...prev, requiredCampaignIds: ordered };
    });
  }, [campaignOptions]);

  const clearAdvancedFilters = useCallback(() => {
    setConfig(prev => ({ ...prev, requiredChannels: [], requiredCampaignIds: [] }));
    setPreviewExclusions(null);
    setPreviewError(null);
    setCampaignSearch('');
  }, []);

  useEffect(() => {
    if (!projectId) return;
    refreshRuns(projectId, { silent: true, skipIfSummaryMatches: true });
  }, [projectId, refreshRuns]);

  useEffect(() => {
    if (!projectId) return;
    if (!config.date_from || !config.date_to) {
      setPreviewCount(null);
      setPreviewExclusions(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    const fromDate = new Date(config.date_from);
    const toDate = new Date(config.date_to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate.getTime() > toDate.getTime()) {
      setPreviewCount(null);
      setPreviewExclusions(null);
      setPreviewLoading(false);
      setPreviewError('Adjust the analysis window to preview matching deals.');
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const preview = await previewDealsCount(projectId, config);
        if (cancelled) return;
        setPreviewCount(preview.total);
        setPreviewExclusions(preview.excluded_by_filters || null);
      } catch (err) {
        if (cancelled) return;
        setPreviewCount(null);
        setPreviewExclusions(null);
        setPreviewError(mapError(err));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [projectId, config]);

  const validate = useCallback((): string | null => {
    if (!config.model_type) return 'Select an attribution model.';
    if (!config.date_from || !config.date_to) return 'Select a date range.';
    if (new Date(config.date_from).getTime() > new Date(config.date_to).getTime()) return 'Start date must be before end date.';
    if (config.minAmount !== undefined && config.minAmount !== null && config.minAmount < 0) return 'Minimum amount cannot be negative.';
    return null;
  }, [config]);

  const onRun = useCallback(async () => {
    const validation = validate();
    if (validation) {
      setMessage({ type: 'error', text: validation });
      return;
    }

    if (!projectId) {
      setMessage({ type: 'error', text: 'Workspace context missing. Please reopen the workspace and try again.' });
      return;
    }

    setMessage(null);
    try {
      const preview = await previewDealsCount(projectId, config);
      setPreviewCount(preview.total);
      setPreviewExclusions(preview.excluded_by_filters || null);
      setPreviewError(null);
      if (!preview.total) {
        setMessage({ type: 'error', text: 'No deals match this date range and filters. Adjust the window or advanced filters and try again.' });
        return;
      }
    } catch (err) {
      const readable = mapError(err);
      setPreviewError(readable);
      setPreviewLoading(false);
      setMessage({ type: 'error', text: readable });
      return;
    }

    setRunning(true);
    try {
      const response = (await runAttribution(projectId, config)) as RunAttributionResponse;
      const newRunId = response?.runId || response?.runName || null;
      if (newRunId) {
        setActiveRunId(newRunId);
        activeRunIdRef.current = newRunId;
        await fetchSummaryForRun(projectId, newRunId);
        await refreshRuns(projectId, { preferRunId: newRunId, silent: true, skipIfSummaryMatches: true });
        setSummaryOpen(true);
      } else {
        await refreshRuns(projectId, { silent: true });
      }
      setMessage({ type: 'info', text: 'Attribution run completed successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: mapError(err) });
    } finally {
      setRunning(false);
    }
  }, [config, fetchSummaryForRun, projectId, refreshRuns, validate]);

  const handleSelectRun = useCallback(
    async (runId: string) => {
      if (!projectId || runId === activeRunIdRef.current) return;
      setMessage(null);
      setOpenAllocDealId(null);
      setActiveRunId(runId);
      activeRunIdRef.current = runId;
      await fetchSummaryForRun(projectId, runId);
    },
    [fetchSummaryForRun, projectId]
  );

  const openSummaryForRun = useCallback(
    async (runId: string) => {
      if (!projectId) return;
      setMessage(null);
      setOpenAllocDealId(null);
      if (runId !== activeRunIdRef.current) {
        setActiveRunId(runId);
        activeRunIdRef.current = runId;
        await fetchSummaryForRun(projectId, runId);
      }
      setSummaryOpen(true);
    },
    [fetchSummaryForRun, projectId]
  );

  const goToROI = useCallback(() => {
    if (!activeRunIdRef.current || !projectId) return;
    window.location.hash = `#/workspace/${projectId}/m06/roi?runId=${encodeURIComponent(activeRunIdRef.current)}`;
  }, [projectId]);

  const markRunAsDefault = useCallback(() => {
    if (!activeRunStorageKey || !activeRunIdRef.current) return;
    localStorage.setItem(activeRunStorageKey, activeRunIdRef.current);
    setStoredDefaultRunId(activeRunIdRef.current);
    setMessage({ type: 'info', text: 'Marked this run as the default for ROI dashboards.' });
  }, [activeRunStorageKey]);

  const resetFilters = useCallback(() => {
    const next = createDefaultConfig();
    setConfig(next);
    setStatusFilter('closedWon');
    setAdvancedOpen(false);
    setCampaignSearch('');
    setPreviewCount(null);
    setPreviewError(null);
    setPreviewExclusions(null);
  }, []);

  useEffect(() => {
    setConfig(prev => ({ ...prev, closedWonOnly: statusFilter === 'closedWon' }));
  }, [statusFilter]);

  const renderMessage = () => {
    if (!message) return null;
    return (
      <div className={`alert-banner ${message.type}`}>
        <span>{message.text}</span>
        <div className="actions">
          <button className="btn-ghost btn-sm" type="button" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      </div>
    );
  };

  const renderSummaryContent = (summaryData: RunSummaryResponse) => (
    <>
      <div className="summary-metrics">
        <div className="summary-card">
          <h5>Deals processed</h5>
          <div className="value">{formatNumber(summaryData.run.deal_count)}</div>
        </div>
        <div className="summary-card">
          <h5>With journeys</h5>
          <div className="value">{formatNumber(summaryData.run.deals_with_journeys)}</div>
        </div>
        <div className="summary-card">
          <h5>Without journeys</h5>
          <div className="value">{formatNumber(summaryData.run.deals_without_journeys)}</div>
        </div>
        <div className="summary-card">
          <h5>Total revenue</h5>
          <div className="value">{formatCurrency(summaryData.run.total_revenue)}</div>
        </div>
        <div className="summary-card">
          <h5>Attributed revenue</h5>
          <div className="value">{formatCurrency(summaryData.run.attributed_revenue)}</div>
        </div>
        <div className="summary-card">
          <h5>Unattributed revenue</h5>
          <div className="value">{formatCurrency(summaryData.run.unattributed_revenue)}</div>
        </div>
        <div className="summary-card">
          <h5>Campaigns credited</h5>
          <div className="value">{formatNumber(summaryData.run.campaigns_with_credit)}</div>
        </div>
        <div className="summary-card">
          <h5>Touches used</h5>
          <div className="value">{formatNumber(summaryData.run.touches_used)}</div>
        </div>
      </div>

      {(() => {
        const filters = summaryData.run.filters;
        if (!filters) return null;
        const channels = filters.requiredChannels || [];
        const campaigns = filters.requiredCampaignIds || [];
        if (!channels.length && !campaigns.length) return null;
        return (
          <div className="summary-filter-row">
            <strong>Filters applied:</strong>
            {channels.length ? (
              <div className="chip-group">
                {channels.map(channel => (
                  <span key={channel} className="chip active muted">{CHANNEL_LABEL_MAP[channel] || channel}</span>
                ))}
              </div>
            ) : null}
            {campaigns.length ? (
              <div className="chip-group">
                {campaigns.map(id => (
                  <span key={id} className="chip active muted">{campaignNameLookup[id] || id}</span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })()}

      {summaryData.run.excluded_by_filters ? (
        <div className="summary-filter-row subtle">
          <span>Excluded by filters: </span>
          <span className="preview-detail">
            {(() => {
              const excluded = summaryData.run.excluded_by_filters;
              if (!excluded) return '—';
              const parts: string[] = [];
              if (excluded.channels) parts.push(`${excluded.channels} lacking channels`);
              if (excluded.campaigns) parts.push(`${excluded.campaigns} lacking campaigns`);
              if (excluded.noTouches) parts.push(`${excluded.noTouches} without touches`);
              return parts.join(', ') || '—';
            })()}
          </span>
        </div>
      ) : null}

      {summaryData.run.deals_without_journeys ? (
        <div className="alert-banner info" style={{ marginTop: 16 }}>
          <span>
            {summaryData.run.deals_without_journeys} deals ({formatCurrency(summaryData.run.unattributed_revenue)}) had no qualifying touches and remain unattributed.
          </span>
          <div className="actions">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                if (!projectId) return;
                const params = new URLSearchParams();
                if (summaryData.run.date_from) params.set('from', summaryData.run.date_from.slice(0, 10));
                if (summaryData.run.date_to) params.set('to', summaryData.run.date_to.slice(0, 10));
                window.location.hash = `#/workspace/${projectId}/m06/journeys?${params.toString()}`;
              }}
            >
              Review in Journey Preview
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Top campaigns</h4>
        {summaryData.campaigns.length ? (
          <div className="allocation-table">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Attributed revenue</th>
                  <th>Deals</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.campaigns.map(c => (
                  <tr key={String(c.campaign_id)}>
                    <td>{String(c.campaign_id)}</td>
                    <td>{formatCurrency(c.revenue)}</td>
                    <td>{formatNumber(c.deal_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#4d4f67' }}>No campaigns received credit in this run.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Sample allocation preview</h4>
        {summaryData.samples.length ? (
          <div className="allocation-table">
            <table>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Lead</th>
                  <th>Amount</th>
                  <th>Allocation</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.samples.map(sample => {
                  const sampleId = String(sample._id);
                  const isOpen = openAllocDealId === sampleId;
                  const baseAmount = sample.deal_amount ?? sample.total ?? 0;
                  return (
                    <React.Fragment key={sampleId}>
                      <tr>
                        <td>{sampleId}</td>
                        <td>{sample.lead_id ? String(sample.lead_id) : '—'}</td>
                        <td>{formatCurrency(baseAmount)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => setOpenAllocDealId(isOpen ? null : sampleId)}
                          >
                            {isOpen ? 'Hide allocation' : 'View allocation'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={4}>
                            <div className="allocation-subtable">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Campaign</th>
                                    <th>Revenue share</th>
                                    <th>% of deal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sample.items.map((item, idx) => {
                                    const share = Number(item.share || 0);
                                    const pct = baseAmount > 0 ? ((share / baseAmount) * 100) : 0;
                                    return (
                                      <tr key={idx}>
                                        <td>{String(item.campaign_id)}</td>
                                        <td>{formatCurrency(share)}</td>
                                        <td>{pct.toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {summaryData.unattributed_sample && (
                  <tr>
                    <td colSpan={4}>
                      Deal {String(summaryData.unattributed_sample.deal_id)} closed with {formatCurrency(summaryData.unattributed_sample.revenue)} but had no qualifying touches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#4d4f67' }}>No attributed deals to preview yet. Run attribution to populate samples.</div>
        )}
      </div>
    </>
  );

  return (
    <Layout>
      <main className="page-root m06-page">
      <div style={{ marginTop: 8 }}>
        <ModuleBackButton toSuffix="/m06" />
      </div>

      <section className="m06-hero">
        <div className="m06-hero-inner">
          <div className="m06-pill">Run Attribution</div>
          <h1>Attribution Run Builder</h1>
          <div className="m06-hero-copy">
            Configure the attribution model, choose the analysis window, optionally narrow the journey scope, then run and review a fresh attribution summary for this workspace.
          </div>
        </div>
      </section>

      {renderMessage()}

      <div className="run-attribution-grid surface">
        <section className="run-attribution-main">
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div className="m06-section-label">Configuration</div>
                <h2 style={{ margin: '12px 0 0 0' }}>Build an attribution run</h2>
              </div>
              <button className="btn-ghost btn-sm" type="button" onClick={resetFilters}>Reset window</button>
            </div>
            <div className="card-body">
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Attribution model</h4>
                <div className="m06-helper" style={{ marginBottom: 12 }}>
                  Choose how revenue credit should be assigned across the touches in each deal journey.
                </div>
                <div className="run-config-options">
                  {modelOptions.map(option => {
                    const active = config.model_type === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`run-config-option ${active ? 'active' : ''}`}
                        onClick={() => setConfig(prev => ({ ...prev, model_type: option.value }))}
                      >
                        <h4>{option.label}</h4>
                        <p>{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Analysis window</h4>
                <div className="m06-helper" style={{ marginBottom: 12 }}>
                  Limit the run to a specific deal-close period and optionally exclude very small deals.
                </div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>From</span>
                    <input className="input" type="date" value={config.date_from} onChange={e => setConfig(prev => ({ ...prev, date_from: e.target.value }))} />
                  </label>
                  <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>To</span>
                    <input className="input" type="date" value={config.date_to} onChange={e => setConfig(prev => ({ ...prev, date_to: e.target.value }))} />
                  </label>
                  <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Minimum deal amount</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="Optional"
                      value={config.minAmount ?? ''}
                      onChange={e => {
                        const next = e.target.value;
                        setConfig(prev => ({ ...prev, minAmount: next ? Number(next) : undefined }));
                      }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#4d4f67' }}>Deal filters</h4>
                <div className="m06-helper" style={{ marginBottom: 12 }}>
                  Decide whether the run should focus only on won revenue or also include lost deals for comparison.
                </div>
                <div className="run-config-options">
                  {statusOptions.map(option => {
                    const active = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`run-config-option ${active ? 'active' : ''}`}
                        onClick={() => setStatusFilter(option.value)}
                      >
                        <h4>{option.label}</h4>
                        <p>{option.description}</p>
                      </button>
                    );
                  })}
                </div>

                <label className="label" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(config.includeArchived)}
                    onChange={e => setConfig(prev => ({ ...prev, includeArchived: e.target.checked }))}
                  />
                  Include archived deals
                </label>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="advanced-toggle-row">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setAdvancedOpen(open => !open)}
                  >
                    {advancedOpen ? 'Hide advanced filters' : 'Show advanced filters'}
                  </button>
                  {hasAdvancedFilters ? (
                    <span className="advanced-active-count">{activeAdvancedCount} active</span>
                  ) : (
                    <span className="advanced-hint">Optional filters</span>
                  )}
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={clearAdvancedFilters}
                    disabled={!hasAdvancedFilters}
                  >
                    Clear
                  </button>
                </div>

                {advancedOpen && (
                  <div className="advanced-panel">
                    <div className="advanced-section">
                      <h5>Require channels</h5>
                      <p className="advanced-note">Only include deals whose journeys contain at least one of these channels.</p>
                      <div className="chip-group">
                        {CHANNEL_OPTIONS.map(option => {
                          const selected = selectedChannels.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`chip ${selected ? 'active' : ''}`}
                              onClick={() => toggleChannel(option.value)}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="advanced-section">
                      <h5>Require campaigns</h5>
                      <p className="advanced-note">Ensure the journey includes at least one of these campaigns.</p>
                      <label className="advanced-search">
                        <span>Search campaigns</span>
                        <input
                          className="input"
                          type="text"
                          placeholder="Start typing to filter"
                          value={campaignSearch}
                          onChange={e => setCampaignSearch(e.target.value)}
                        />
                      </label>
                      <div className="advanced-campaign-list">
                        {campaignsLoading ? (
                          <div>Loading campaigns…</div>
                        ) : campaignError ? (
                          <div className="advanced-error">{campaignError}</div>
                        ) : filteredCampaignOptions.length ? (
                          filteredCampaignOptions.map(option => {
                            const selected = selectedCampaignIds.includes(option.id);
                            return (
                              <label key={option.id} className={`advanced-campaign-option ${selected ? 'active' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleCampaign(option.id)}
                                />
                                <span>
                                  {option.name}
                                  {option.channel ? ` · ${option.channel}` : ''}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div>No campaigns match that search.</div>
                        )}
                      </div>
                      {selectedCampaignOptions.length ? (
                        <div className="advanced-selected">
                          <span>Selected:</span>
                          <div className="chip-group">
                            {selectedCampaignOptions.map(option => (
                              <button
                                key={option.id}
                                type="button"
                                className="chip active"
                                onClick={() => toggleCampaign(option.id)}
                              >
                                {option.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className={`preview-summary ${previewError ? 'error' : ''}`}>
                  {previewLoading ? (
                    <span>Checking matching deals…</span>
                  ) : previewError ? (
                    <span className="preview-error-text">{previewError}</span>
                  ) : (
                    <span>{previewCount !== null ? `${formatNumber(previewCount)} matching deals` : 'Matching deals pending'}</span>
                  )}
                  {previewExclusionSummary && !previewError ? (
                    <span className="preview-detail">Excluded: {previewExclusionSummary}</span>
                  ) : null}
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
                <button className="btn-primary" type="button" disabled={running} onClick={onRun}>
                  {running ? 'Running attribution…' : 'Run Attribution'}
                </button>
              </div>
            </div>
          </div>

          {showLegacySummary && summaryLoading && (
            <div className="card">
              <div className="card-body">Loading summary…</div>
            </div>
          )}

          {showLegacySummary && !summaryLoading && summary && (
            <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div className="m06-section-label">Summary</div>
                <h3 style={{ margin: '12px 0 0 0' }}>Summary for {modelLabel(summary!.run.model_type)}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost btn-sm"
                    type="button"
                    onClick={markRunAsDefault}
                    disabled={!activeRunIdRef.current || storedDefaultRunId === activeRunIdRef.current}
                  >
                    {storedDefaultRunId === activeRunIdRef.current ? 'ROI default' : 'Set as ROI default'}
                  </button>
                  <button className="btn-primary btn-sm" type="button" disabled={!activeRunIdRef.current} onClick={goToROI}>
                    Go to ROI for this run
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="summary-metrics">
                  <div className="summary-card">
                    <h5>Deals processed</h5>
                    <div className="value">{formatNumber(summary!.run.deal_count)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>With journeys</h5>
                    <div className="value">{formatNumber(summary!.run.deals_with_journeys)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Without journeys</h5>
                    <div className="value">{formatNumber(summary!.run.deals_without_journeys)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Total revenue</h5>
                    <div className="value">{formatCurrency(summary!.run.total_revenue)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Attributed revenue</h5>
                    <div className="value">{formatCurrency(summary!.run.attributed_revenue)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Unattributed revenue</h5>
                    <div className="value">{formatCurrency(summary!.run.unattributed_revenue)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Campaigns credited</h5>
                    <div className="value">{formatNumber(summary!.run.campaigns_with_credit)}</div>
                  </div>
                  <div className="summary-card">
                    <h5>Touches used</h5>
                    <div className="value">{formatNumber(summary!.run.touches_used)}</div>
                  </div>
                </div>

                {(() => {
                  const filters = summary!.run.filters;
                  if (!filters) return null;
                  const channels = filters?.requiredChannels || [];
                  const campaigns = filters?.requiredCampaignIds || [];
                  if (!channels.length && !campaigns.length) return null;
                  return (
                    <div className="summary-filter-row">
                      <strong>Filters applied:</strong>
                      {channels.length ? (
                        <div className="chip-group">
                          {channels.map(channel => (
                            <span key={channel} className="chip active muted">{CHANNEL_LABEL_MAP[channel] || channel}</span>
                          ))}
                        </div>
                      ) : null}
                      {campaigns.length ? (
                        <div className="chip-group">
                          {campaigns.map(id => (
                            <span key={id} className="chip active muted">{campaignNameLookup[id] || id}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {summary!.run.excluded_by_filters ? (
                  <div className="summary-filter-row subtle">
                    <span>Excluded by filters: </span>
                    <span className="preview-detail">
                      {(() => {
                        const excluded = summary!.run.excluded_by_filters;
                        if (!excluded) return '—';
                        const parts: string[] = [];
                        if (excluded?.channels) parts.push(`${excluded?.channels} lacking channels`);
                        if (excluded?.campaigns) parts.push(`${excluded?.campaigns} lacking campaigns`);
                        if (excluded?.noTouches) parts.push(`${excluded?.noTouches} without touches`);
                        return parts.join(', ') || '—';
                      })()}
                    </span>
                  </div>
                ) : null}

                {summary!.run.deals_without_journeys ? (
                  <div className="alert-banner info" style={{ marginTop: 16 }}>
                    <span>
                      {summary!.run.deals_without_journeys} deals ({formatCurrency(summary!.run.unattributed_revenue)}) had no qualifying touches and remain unattributed.
                    </span>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => {
                          if (!projectId) return;
                          const params = new URLSearchParams();
                          if (summary!.run.date_from) params.set('from', summary!.run.date_from.slice(0, 10));
                          if (summary!.run.date_to) params.set('to', summary!.run.date_to.slice(0, 10));
                          window.location.hash = `#/workspace/${projectId}/m06/journeys?${params.toString()}`;
                        }}
                      >
                        Review in Journey Preview
                      </button>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: 18 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>Top campaigns</h4>
                  {summary!.campaigns.length ? (
                    <div className="allocation-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Campaign</th>
                            <th>Attributed revenue</th>
                            <th>Deals</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary!.campaigns.map(c => (
                            <tr key={String(c.campaign_id)}>
                              <td>{String(c.campaign_id)}</td>
                              <td>{formatCurrency(c.revenue)}</td>
                              <td>{formatNumber(c.deal_count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#4d4f67' }}>No campaigns received credit in this run.</div>
                  )}
                </div>

                <div style={{ marginTop: 18 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>Sample allocation preview</h4>
                  {summary!.samples.length ? (
                    <div className="allocation-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Deal</th>
                            <th>Lead</th>
                            <th>Amount</th>
                            <th>Allocation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary!.samples.map(sample => {
                            const sampleId = String(sample._id);
                            const isOpen = openAllocDealId === sampleId;
                            const baseAmount = sample.deal_amount ?? sample.total ?? 0;
                            return (
                              <React.Fragment key={sampleId}>
                                <tr>
                                  <td>{sampleId}</td>
                                  <td>{sample.lead_id ? String(sample.lead_id) : '—'}</td>
                                  <td>{formatCurrency(baseAmount)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn-primary btn-sm"
                                      onClick={() => setOpenAllocDealId(isOpen ? null : sampleId)}
                                    >
                                      {isOpen ? 'Hide allocation' : 'View allocation'}
                                    </button>
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr>
                                    <td colSpan={4}>
                                      <div className="allocation-subtable">
                                        <table>
                                          <thead>
                                            <tr>
                                              <th>Campaign</th>
                                              <th>Revenue share</th>
                                              <th>% of deal</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sample.items.map((item, idx) => {
                                              const share = Number(item.share || 0);
                                              const pct = baseAmount > 0 ? ((share / baseAmount) * 100) : 0;
                                              return (
                                                <tr key={idx}>
                                                  <td>{String(item.campaign_id)}</td>
                                                  <td>{formatCurrency(share)}</td>
                                                  <td>{pct.toFixed(1)}%</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {summary!.unattributed_sample && (
                            <tr>
                              <td colSpan={4}>
                                Deal {String(summary!.unattributed_sample!.deal_id)} closed with {formatCurrency(summary!.unattributed_sample!.revenue)} but had no qualifying touches.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#4d4f67' }}>No attributed deals to preview yet. Run attribution to populate samples.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showLegacySummary && !summaryLoading && !summary && (
            <div className="card">
              <div className="card-body" style={{ color: '#4d4f67' }}>
                Select a run from the history panel to see its summary, or run a new attribution above.
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body" style={{ color: '#4d4f67' }}>
              Open saved attribution summaries from the history panel. The page body stays focused on configuration and run history now.
            </div>
          </div>
        </section>

        <aside className="run-attribution-side">
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div className="m06-section-label">History</div>
                <h3 style={{ margin: '12px 0 0 0' }}>Attribution runs</h3>
              </div>
              <button className="btn-ghost btn-sm" type="button" onClick={() => projectId && refreshRuns(projectId)}>Refresh</button>
            </div>
            <div className="card-body">
              {runsLoading && <div style={{ fontSize: 13, color: '#4d4f67' }}>Loading runs…</div>}
              {!runsLoading && !runs.length && <div style={{ fontSize: 13, color: '#4d4f67' }}>No runs yet. Run attribution to build history.</div>}

              <div className="run-history-list">
                {runs.map(run => {
                  const runId = String(run._id);
                  const isActive = activeRunIdRef.current === runId;
                  const isDefault = storedDefaultRunId === runId;
                  const statusClass = run.status === 'error' ? 'error' : run.status === 'running' ? 'running' : 'success';
                  return (
                    <div
                      key={runId}
                      className={`run-history-card ${isActive ? 'active' : ''}`}
                    >
                      <h4>{modelLabel(run.model_type)} · {run.date_from?.slice(0, 10) || '—'} → {run.date_to?.slice(0, 10) || '—'}</h4>
                      <div className="run-history-meta">
                        <span>{formatNumber(run.deal_count)} deals</span>
                        <span>{formatCurrency(run.attributed_revenue)} attributed</span>
                      </div>
                      {(() => {
                        const filters = (run.meta as { filters?: AttributionFilterSummary } | null | undefined)?.filters;
                        if (!filters) return null;
                        const channels = filters.requiredChannels || [];
                        const campaigns = filters.requiredCampaignIds || [];
                        if (!channels.length && !campaigns.length) return null;
                        return (
                          <div className="run-history-filters">
                            {channels.length ? (
                              <span>Channels: {channels.map(ch => CHANNEL_LABEL_MAP[ch] || ch).join(', ')}</span>
                            ) : null}
                            {campaigns.length ? (
                              <span>Campaigns: {campaigns.map(id => campaignNameLookup[id] || id).join(', ')}</span>
                            ) : null}
                          </div>
                        );
                      })()}
                      <div className="run-history-footer">
                        <div className="run-history-statuses">
                          <span className={`status-pill ${statusClass}`}>{run.status}</span>
                          {isDefault && <span className="status-pill default">ROI default</span>}
                          <span>{formatTimestamp(run.timestamp)}</span>
                        </div>
                        <div className="run-history-actions">
                          <button className="btn-ghost btn-sm" type="button" onClick={() => void handleSelectRun(runId)}>
                            Select
                          </button>
                          <button className="btn-primary btn-sm" type="button" onClick={() => void openSummaryForRun(runId)}>
                            View Summary
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {summaryOpen ? (
        <div className="fullscreen-overlay" onClick={() => setSummaryOpen(false)}>
          <div className="fullscreen-panel m06-summary-panel" onClick={e => e.stopPropagation()}>
            <div className="fullscreen-header">
              <div>
                <div className="m06-section-label">Summary</div>
                <h3 style={{ margin: '10px 0 0 0' }}>
                  {summaryLoading ? 'Loading run summary…' : summary ? `Summary for ${modelLabel(summary.run.model_type)}` : 'Run summary'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn-ghost btn-sm"
                  type="button"
                  onClick={markRunAsDefault}
                  disabled={!activeRunIdRef.current || storedDefaultRunId === activeRunIdRef.current || summaryLoading || !summary}
                >
                  {storedDefaultRunId === activeRunIdRef.current ? 'ROI default' : 'Set as ROI default'}
                </button>
                <button className="btn-primary btn-sm" type="button" disabled={!activeRunIdRef.current || summaryLoading || !summary} onClick={goToROI}>
                  Go to ROI
                </button>
                <button className="btn-ghost btn-sm" type="button" onClick={() => setSummaryOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="fullscreen-body">
              <div className="m06-summary-panel-body">
                {summaryLoading ? (
                  <div className="card">
                    <div className="card-body">Loading summary…</div>
                  </div>
                ) : summary ? (
                  renderSummaryContent(summary)
                ) : (
                  <div className="card">
                    <div className="card-body" style={{ color: '#4d4f67' }}>
                      No summary is available for this run yet.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </main>
    </Layout>
  );
}
