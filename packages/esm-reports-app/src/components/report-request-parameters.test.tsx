import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';
import { renderWithSwr } from '@tools/test-helpers';
import ReportRequestParameters from './report-request-parameters.component';

describe('ReportRequestParameters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves provider UUIDs and displays readable status and dates', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { display: 'Dr. Aimen' } } as never);
    renderWithSwr(
      <ReportRequestParameters
        parameters={[
          { name: 'providerUuid', label: 'Provider', type: 'java.lang.String', value: 'provider-uuid' },
          { name: 'shareStatus', label: 'Shares', type: 'java.lang.String', value: 'PENDING' },
          { name: 'fromDate', label: 'Start date (inclusive)', type: 'java.util.Date', value: '2026-09-01' },
        ]}
      />,
    );
    expect(await screen.findByText('Dr. Aimen')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('01-Sep-2026')).toBeInTheDocument();
    expect(screen.queryByText('provider-uuid')).not.toBeInTheDocument();
    expect(openmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/provider/provider-uuid');
  });

  it('keeps other report parameters readable without provider lookups', () => {
    renderWithSwr(
      <ReportRequestParameters
        parameters={[
          { name: 'location', label: 'Location', type: 'org.openmrs.Location', value: { display: 'Main clinic' } },
          { name: 'includeVoided', label: 'Include voided', type: 'java.lang.Boolean', value: false },
        ]}
      />,
    );
    expect(screen.getByText('Main clinic')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('displays the combined share status', () => {
    renderWithSwr(
      <ReportRequestParameters
        parameters={[{ name: 'shareStatus', label: 'Shares', type: 'java.lang.String', value: 'ALL' }]}
      />,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows a fallback when provider access fails without breaking the report row', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Forbidden'));
    renderWithSwr(
      <ReportRequestParameters
        parameters={[
          { name: 'providerUuid', label: 'Provider', type: 'java.lang.String', value: 'restricted-provider' },
        ]}
      />,
    );
    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument();
  });

  it('stops showing loading when a successful provider lookup has no display name', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { display: '' } } as never);
    renderWithSwr(
      <ReportRequestParameters
        parameters={[{ name: 'providerUuid', label: 'Provider', type: 'java.lang.String', value: 'unnamed-provider' }]}
      />,
    );
    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Loading provider…')).not.toBeInTheDocument();
  });
});
