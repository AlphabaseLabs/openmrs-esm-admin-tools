import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithSwr } from '@tools/test-helpers';
import { useConfig, useSession } from '@openmrs/esm-framework';
import OverviewComponent from './overview.component';
import { mockReports, mockSession } from '@mocks/index';
import { useReports, useReportDefinitions, useReportDesigns, useLocations, runReport } from './reports.resource';
import RunReportForm from './run-report/run-report-form.component';
import { PROVIDER_FINANCIAL_STATEMENT_UUID } from '../constants';

// Mock dependencies
vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
  useSession: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
  isDesktop: vi.fn(() => true),
  userHasAccess: vi.fn(() => true),
  PageHeader: vi.fn(({ children }) => <div>{children}</div>),
  PageHeaderContent: vi.fn(({ illustration, title }) => (
    <div>
      {illustration}
      <h1>{title}</h1>
    </div>
  )),
  navigate: vi.fn(),
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
  getGlobalStore: vi.fn(() => ({
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

const mockUseReports = vi.mocked(useReports);

vi.mock('./reports.resource', () => ({
  useReports: vi.fn(),
  downloadReport: vi.fn(),
  downloadMultipleReports: vi.fn(),
  preserveReport: vi.fn(),
  useReportDefinitions: vi.fn(),
  useReportDesigns: vi.fn(),
  useLocations: vi.fn(),
  runReport: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseConfig = vi.mocked(useConfig);

describe('OverviewComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('should show View button for Web Preview reports', async () => {
    mockUseConfig.mockReturnValue({
      webPreviewViewReportUrl: 'https://example.com/view/{reportRequestUuid}',
    });

    mockUseReports.mockReturnValue({
      reports: mockReports,
      reportsTotalCount: mockReports.length,
      error: null,
      isValidating: false,
      mutateReports: vi.fn(),
    });

    renderWithSwr(<OverviewComponent />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();

    const expectedColumnHeaders = [
      /report name/i,
      /status/i,
      /requested by/i,
      /requested on/i,
      /output format/i,
      /actions/i,
    ];

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    const allRows = screen.getAllByRole('row');
    expect(allRows.length).toBe(6);
    expect(screen.getAllByText('OPD/IPD Report')).toHaveLength(3);
    expect(screen.getAllByText('13-Nov-2025')).toHaveLength(2);

    const viewButtons = screen.queryAllByRole('button', { name: 'View' });
    expect(viewButtons.length).toBe(1);
  });

  it('should show Download button when webPreviewViewReportUrl is NOT configured', async () => {
    mockUseConfig.mockReturnValue({
      webPreviewViewReportUrl: '', // No URL configured
    });

    mockUseReports.mockReturnValue({
      reports: mockReports,
      reportsTotalCount: mockReports.length,
      error: null,
      isValidating: false,
      mutateReports: vi.fn(),
    });

    renderWithSwr(<OverviewComponent />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    // Validate table headers
    const expectedColumnHeaders = [
      /report name/i,
      /status/i,
      /requested by/i,
      /requested on/i,
      /output format/i,
      /actions/i,
    ];

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    // Validate row contents - when webPreviewViewReportUrl is NOT configured:
    // - Failed reports should show Delete button only
    // - Completed reports should show Download button instead of View button
    const allRows = screen.getAllByRole('row');
    expect(allRows.length).toBe(6);
    expect(screen.getAllByText('OPD/IPD Report')).toHaveLength(3);
    expect(screen.getAllByText('13-Nov-2025')).toHaveLength(2);

    const downloadButtons = screen.getAllByRole('button', { name: 'Download' });
    expect(downloadButtons.length).toBe(2);

    const viewButtons = screen.queryAllByRole('button', { name: 'View' });
    expect(viewButtons).toHaveLength(0);
  });

  it('offers Print only for completed or preserved PDF reports', () => {
    mockUseConfig.mockReturnValue({ webPreviewViewReportUrl: '' });
    const reports = [
      ['COMPLETED', 'PDF'],
      ['SAVED', 'PDF'],
      ['FAILED', 'PDF'],
      ['REQUESTED', 'PDF'],
      ['COMPLETED', 'CSV'],
    ].map(([status, outputFormat], index) => ({ ...mockReports[0], id: `report-${index}`, status, outputFormat }));
    mockUseReports.mockReturnValue({ reports, reportsTotalCount: reports.length, mutateReports: vi.fn() });
    renderWithSwr(<OverviewComponent />);
    expect(screen.getAllByRole('button', { name: 'Print report' })).toHaveLength(2);
  });
});

describe('RunReportForm defaults and submission', () => {
  beforeEach(() => {
    vi.mocked(useLocations).mockReturnValue({ locations: [] });
    vi.mocked(useReportDefinitions).mockReturnValue({
      reportDefinitions: [
        {
          uuid: PROVIDER_FINANCIAL_STATEMENT_UUID,
          name: 'Provider Financial Statement',
          description: '',
          parameters: [{ name: 'currency', label: 'Currency', type: 'java.lang.String', required: true }],
        },
      ],
    });
    vi.mocked(useReportDesigns).mockReturnValue({
      reportDesigns: [
        { uuid: 'pdf', name: 'PDF' },
        { uuid: 'csv', name: 'CSV' },
      ],
      error: undefined,
      isValidating: false,
      mutateReportDesigns: vi.fn(),
    });
    vi.mocked(runReport).mockReset();
  });

  it('defaults to PKR and PDF without overriding a later format choice or an explicit clear', () => {
    const { rerender } = renderWithSwr(<RunReportForm closePanel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Report'), { target: { value: PROVIDER_FINANCIAL_STATEMENT_UUID } });
    expect(screen.getByLabelText('Currency')).toHaveValue('PKR');
    expect(screen.getByLabelText('Output format')).toHaveValue('pdf');
    fireEvent.change(screen.getByLabelText('Output format'), { target: { value: 'csv' } });
    rerender(<RunReportForm closePanel={vi.fn()} />);
    expect(screen.getByLabelText('Output format')).toHaveValue('csv');
    fireEvent.change(screen.getByLabelText('Output format'), { target: { value: '' } });
    expect(screen.getByLabelText('Output format')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  });

  it('guards invalid and duplicate submissions', () => {
    vi.mocked(runReport).mockImplementation(() => new Promise(() => {}));
    renderWithSwr(<RunReportForm closePanel={vi.fn()} />);
    const run = screen.getByRole('button', { name: 'Run' });
    fireEvent.submit(run);
    expect(runReport).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Report'), { target: { value: PROVIDER_FINANCIAL_STATEMENT_UUID } });
    fireEvent.submit(run);
    fireEvent.submit(run);
    expect(runReport).toHaveBeenCalledTimes(1);
    expect(runReport).toHaveBeenCalledWith(
      expect.objectContaining({
        renderingMode: { argument: 'pdf' },
        reportDefinition: {
          parameterizable: { uuid: PROVIDER_FINANCIAL_STATEMENT_UUID },
          parameterMappings: { currency: 'PKR' },
        },
      }),
    );
  });
});
