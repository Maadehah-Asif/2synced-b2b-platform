import { useState } from 'react';
import type { FunnelHealthFilters } from './useFunnelHealth';

interface FilterBarProps {
  onApplyFilters: (filters: FunnelHealthFilters) => void;
  loading?: boolean;
}

export function FilterBar({ onApplyFilters, loading = false }: FilterBarProps) {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [stages, setStages] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Common stages in B2B funnel
  const commonStages = ['Lead', 'MQL', 'SQL', 'Opportunity', 'Proposal', 'Negotiation', 'Won', 'Lost'];

  const validateFilters = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (from && !isValidDate(from)) {
      errors.from = 'Invalid date format (use YYYY-MM-DD)';
    }
    if (to && !isValidDate(to)) {
      errors.to = 'Invalid date format (use YYYY-MM-DD)';
    }

    if (from && to && isValidDate(from) && isValidDate(to)) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (fromDate > toDate) {
        errors.dateRange = 'Start date must be before end date';
      }
    }

    return errors;
  };

  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr) return true;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const handleApplyFilters = () => {
    const errors = validateFilters();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    onApplyFilters({
      from: from || undefined,
      to: to || undefined,
      stages: stages.length > 0 ? stages : undefined,
      campaignId: campaignId || undefined,
      ownerId: ownerId || undefined,
    });
  };

  const toggleStage = (stage: string) => {
    setStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        marginBottom: '24px',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
        Filters
      </h3>

      {/* Validation errors banner */}
      {Object.keys(validationErrors).length > 0 && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          {Object.values(validationErrors).join('; ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* From Date */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#555' }}>
            From Date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* To Date */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#555' }}>
            To Date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Campaign ID */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#555' }}>
            Campaign
          </label>
          <input
            type="text"
            placeholder="Campaign ID (optional)"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Owner ID */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#555' }}>
            Owner
          </label>
          <input
            type="text"
            placeholder="Owner ID (optional)"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Stage multiselect */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 500, color: '#555' }}>
          Stages (leave empty for all)
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {commonStages.map((stage) => (
            <button
              key={stage}
              onClick={() => toggleStage(stage)}
              style={{
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid #ddd',
                backgroundColor: stages.includes(stage) ? '#0A1A75' : 'white',
                color: stages.includes(stage) ? 'white' : '#555',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 200ms ease',
              }}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={handleApplyFilters}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0A1A75',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 200ms ease',
          }}
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>
    </div>
  );
}
