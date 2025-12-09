import { useState, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface FunnelHealthResponse {
  kpis: {
    totalActiveLeads: number;
    stageCounts: { stage: string; count: number }[];
    overallConversionRate: number;
    worstLeakageTransition: { fromStage: string; toStage: string; leakageRate: number } | null;
    averageTimePerStageDays: { stage: string; avgDays: number }[];
  };
  funnelFlow: {
    sankeyNodes: { id: string; label: string }[];
    sankeyLinks: { source: string; target: string; value: number }[];
    funnelStages: { stage: string; count: number }[];
  };
  stageMetrics: {
    stage: string;
    avgTimeDays: number | null;
    medianTimeDays: number | null;
    percentStuck: number;
    dropOffToLostPercent: number;
    hasIncompletePaths: boolean;
  }[];
  leakageHeatmap: {
    stages: string[];
    matrix: number[][];
  };
  exportUrls: { csv: string; pdf: string };
}

export interface FunnelHealthFilters {
  from?: string;
  to?: string;
  stages?: string[];
  campaignId?: string;
  ownerId?: string;
}

interface UseFunnelHealthState {
  data: FunnelHealthResponse | null;
  loading: boolean;
  error: string | null;
  validationErrors: Record<string, string>;
}

/**
 * Validates date format (ISO 8601)
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates the date range
 */
function validateDateRange(from: string | undefined, to: string | undefined): Record<string, string> {
  const errors: Record<string, string> = {};

  if (from && !isValidDate(from)) {
    errors.from = 'Invalid start date format (use YYYY-MM-DD)';
  }
  if (to && !isValidDate(to)) {
    errors.to = 'Invalid end date format (use YYYY-MM-DD)';
  }

  if (from && to && isValidDate(from) && isValidDate(to)) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (fromDate > toDate) {
      errors.dateRange = 'Start date must be before end date';
    }
  }

  return errors;
}

/**
 * Custom hook for fetching funnel health data
 */
export function useFunnelHealth(workspaceId: string | null, filters: FunnelHealthFilters = {}) {
  const [state, setState] = useState<UseFunnelHealthState>({
    data: null,
    loading: false,
    error: null,
    validationErrors: {},
  });

  const fetchData = useCallback(async () => {
    // Validate workspaceId
    if (!workspaceId) {
      setState((prev) => ({
        ...prev,
        error: 'Workspace ID is missing. Redirecting...',
        validationErrors: { workspaceId: 'Workspace ID is required' },
      }));
      return;
    }

    // Validate date range
    const dateErrors = validateDateRange(filters.from, filters.to);
    if (Object.keys(dateErrors).length > 0) {
      setState((prev) => ({
        ...prev,
        validationErrors: dateErrors,
        error: null,
        data: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      validationErrors: {},
    }));

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Build query params
      const params = new URLSearchParams({
        workspaceId,
      });

      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.stages && filters.stages.length > 0) {
        params.append('stages', filters.stages.join(','));
      }
      if (filters.campaignId) params.append('campaignId', filters.campaignId);
      if (filters.ownerId) params.append('ownerId', filters.ownerId);

      const response = await window.fetch(`${API_URL}/m07/funnel-health?${params.toString()}`,
       {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: FunnelHealthResponse = await response.json();
      setState((prev) => ({
        ...prev,
        data,
        loading: false,
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load funnel health data',
        data: null,
      }));
    }
  }, [workspaceId, filters]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Auto-fetch when workspaceId or filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    fetch: fetchData,
    refetch,
  };
}
