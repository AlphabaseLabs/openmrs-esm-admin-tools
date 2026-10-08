import React, { useCallback, useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  DataTable,
  InlineNotification,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Calendar, Download, Play, Printer, Renew, Save, TrashCan, View } from '@carbon/react/icons';
import {
  downloadMultipleReports,
  downloadReport,
  preserveReport,
  useReports,
  type ReportModel,
} from './reports.resource';
import {
  isDesktop,
  navigate,
  PageHeader,
  PageHeaderContent,
  showModal,
  showSnackbar,
  useConfig,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { closeOverlay, launchOverlay } from '../hooks/useOverlay';
import Overlay from './overlay.component';
import ReportOverviewButton from './report-overview-button.component';
import ReportStatus from './report-status.component';
import RunReportForm from './run-report/run-report-form.component';
import { COMPLETED, RAN_REPORT_STATUSES, SAVED } from './report-statuses-constants';
import { DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZES } from './pagination-constants';
import { PRIVILEGE_SYSTEM_DEVELOPER } from '../constants';
import styles from './reports.scss';
import { type ConfigObject } from '../config-schema';
import ReportsPictogram from './reports-pictogram.component';
import ReportRequestParameters from './report-request-parameters.component';
import { downloadReportFile, printReportFile } from '../utils/report-files';

const OverviewComponent: React.FC = () => {
  const { t } = useTranslation();
  const currentSession = useSession();
  const { webPreviewViewReportUrl } = useConfig<ConfigObject>();

  const [checkedReportUuidsArray, setCheckedReportUuidsArray] = useState<string[]>([]);
  const [printingReportUuid, setPrintingReportUuid] = useState<string | null>(null);
  const printInProgress = useRef(false);

  const tableHeaders = useMemo(
    () => [
      { key: 'reportName', header: t('reportName', 'Report name') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'requestedBy', header: t('requestedBy', 'Requested by') },
      { key: 'requestedOn', header: t('requestedOn', 'Requested on') },
      { key: 'outputFormat', header: t('outputFormat', 'Output format') },
      { key: 'parameters', header: t('parameters', 'Parameters') },
      { key: 'actions', header: t('actions', 'Actions') },
    ],
    [t],
  );

  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE_NUMBER);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { reports, reportsTotalCount, mutateReports, error, isValidating } = useReports(
    RAN_REPORT_STATUSES.join(','),
    currentPage,
    pageSize,
  );
  const reportsById = useMemo(
    () => new Map<string, ReportModel>(reports.map((report) => [report.id, report])),
    [reports],
  );

  const selectedReportUuids = checkedReportUuidsArray.filter(
    (uuid) => reportsById.get(uuid) && [COMPLETED, SAVED].includes(reportsById.get(uuid).status),
  );

  const layout = useLayoutType();

  function getReportStatus(row) {
    return row?.cells.find((cell) => cell.info?.header === 'status')?.value;
  }

  function getReportOutputFormat(row) {
    return row?.cells.find((cell) => cell.info?.header === 'outputFormat')?.value;
  }

  function shouldShowDownloadButton(row) {
    const outputFormat = getReportOutputFormat(row);
    const status = getReportStatus(row);
    const isWebPreviewWithUrl = outputFormat === 'Web Preview' && webPreviewViewReportUrl;

    // Don't show download button for web preview when we have a view URL
    if (isWebPreviewWithUrl) {
      return false;
    }

    return status === COMPLETED || status === SAVED;
  }

  function shouldShowViewButton(row) {
    const outputFormat = getReportOutputFormat(row);
    const status = getReportStatus(row);

    return outputFormat === 'Web Preview' && webPreviewViewReportUrl && (status === COMPLETED || status === SAVED);
  }

  function isCurrentUserTheSameAsReportRequestedByUser(reportRequestUuid: string) {
    const report = reportsById.get(reportRequestUuid);
    const requestedByUserUuid = report?.requestedByUserUuid;
    const currentUserUuid = currentSession?.user?.uuid;

    return Boolean(currentUserUuid && requestedByUserUuid === currentUserUuid);
  }

  function isSystemDeveloperUser() {
    return Boolean(currentSession?.user && userHasAccess(PRIVILEGE_SYSTEM_DEVELOPER, currentSession.user));
  }

  function isEligibleReportUser(reportRequestUuid: string) {
    return isCurrentUserTheSameAsReportRequestedByUser(reportRequestUuid) || isSystemDeveloperUser();
  }

  function renderRowCheckbox(row) {
    const selectable = [COMPLETED, SAVED].includes(getReportStatus(row));
    return (
      <TableCell>
        {selectable && (
          <Checkbox
            id={`checkbox-${row.id}`}
            labelText={t('selectReportForDownload', 'Select report for download')}
            hideLabel
            onChange={(_, { checked }) =>
              setCheckedReportUuidsArray((selected) =>
                checked
                  ? [...selected.filter((uuid) => uuid !== row.id), row.id]
                  : selected.filter((uuid) => uuid !== row.id),
              )
            }
            checked={selectedReportUuids.includes(row.id)}
          />
        )}
      </TableCell>
    );
  }

  const handlePreserveReport = useCallback(
    async (reportRequestUuid: string) => {
      preserveReport(reportRequestUuid)
        .then(() => {
          mutateReports();
          showSnackbar({
            kind: 'success',
            title: t('preserveReport', 'Preserve report'),
            subtitle: t('reportPreservedSuccessfully', 'Report preserved successfully'),
          });
        })
        .catch(() => {
          showSnackbar({
            kind: 'error',
            title: t('preserveReport', 'Preserve report'),
            subtitle: t('reportPreservingErrorMsg', 'Error during report preserving'),
          });
        });
    },
    [mutateReports, t],
  );

  const launchDeleteReportDialog = (reportRequestUuid: string) => {
    const dispose = showModal('cancel-report-modal', {
      closeModal: () => {
        dispose();
        mutateReports();
      },
      reportRequestUuid,
      modalType: 'delete',
    });
  };

  const handleViewReport = useCallback(
    (reportRequestUuid: string) => {
      if (!webPreviewViewReportUrl) {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('noWebPreviewUrlConfigured', 'No web preview URL configured.'),
          kind: 'error',
        });
        return;
      }

      try {
        // Basic URL validation
        new URL(webPreviewViewReportUrl.replace('{reportRequestUuid}', 'placeholder'));
      } catch {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('invalidWebPreviewUrl', 'Configured web preview URL is invalid.'),
          kind: 'error',
        });
        return;
      }

      if (!webPreviewViewReportUrl.includes('{reportRequestUuid}')) {
        showSnackbar({
          title: t('error', 'Error'),
          subtitle: t('missingPlaceholder', 'Configured web preview URL must include {reportRequestUuid} placeholder.'),
          kind: 'error',
        });
        return;
      }

      const viewUrl = webPreviewViewReportUrl.replace('{reportRequestUuid}', reportRequestUuid);
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    },
    [webPreviewViewReportUrl, t],
  );

  const handleDownloadReport = useCallback(
    async (reportRequestUuid: string) => {
      try {
        const response = await downloadReport(reportRequestUuid);
        downloadReportFile(response);
        clearReportCheckboxes();
        showSnackbar({
          kind: 'success',
          title: t('reportDownloaded', 'Report downloaded'),
          subtitle: t('reportDownloadedSuccessfully', 'Report downloaded successfully'),
        });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('errorDownloadingReport', 'Error downloading report'),
          subtitle: error?.message,
        });
      }
    },
    [t],
  );

  const handleDownloadMultipleReports = useCallback(
    async (reportRequestUuids: string[]) => {
      try {
        const response = await downloadMultipleReports(reportRequestUuids);
        response.forEach(downloadReportFile);
        clearReportCheckboxes();
        showSnackbar({
          kind: 'success',
          title: t('reportsDownloaded', 'Reports downloaded'),
          subtitle: t('reportsDownloadedSuccessfully', 'Reports downloaded successfully'),
        });
      } catch (error) {
        showSnackbar({
          kind: 'error',
          title: t('errorDownloadingReports', 'Error downloading reports'),
          subtitle: error?.message,
        });
      }
    },
    [t],
  );

  const handlePrintReport = async (reportRequestUuid: string) => {
    if (printInProgress.current) return;
    printInProgress.current = true;
    setPrintingReportUuid(reportRequestUuid);
    try {
      await printReportFile(
        () => downloadReport(reportRequestUuid),
        {
          loading: t('preparingReportToPrint', 'Preparing report to print…'),
          popupBlocked: t('reportPrintPopupBlocked', 'Allow pop-ups for this site, then try printing again.'),
          invalidPdf: t('reportPrintPdfOnly', 'Only PDF reports can be printed. Download this report instead.'),
        },
        () =>
          showSnackbar({
            kind: 'info',
            title: t('printReport', 'Print report'),
            subtitle: t('reportPrintManually', 'Use the print button in the PDF tab to print this report.'),
          }),
      );
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorPrintingReport', 'Unable to print report'),
        subtitle: error instanceof Error ? error.message : t('reportPrintRetry', 'Please try again.'),
      });
    } finally {
      printInProgress.current = false;
      setPrintingReportUuid(null);
    }
  };

  const clearReportCheckboxes = () => {
    setCheckedReportUuidsArray([]);
  };

  return (
    <div>
      <PageHeader className={styles.header}>
        <PageHeaderContent illustration={<ReportsPictogram />} title={t('reports', 'Reports')} />
      </PageHeader>
      <div className={styles.content}>
        <div className={styles.actionsRow}>
          <div className={styles.mainActionButtonsDiv}>
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Renew}
              iconDescription={t('refreshReports', 'Refresh reports')}
              disabled={isValidating}
              onClick={() => mutateReports()}
            />
            {selectedReportUuids.length > 0 && (
              <Button
                kind="ghost"
                renderIcon={() => <Download size={16} className={styles.actionButtonIcon} />}
                iconDescription="Download reports"
                onClick={() => handleDownloadMultipleReports(selectedReportUuids)}
                className={styles.mainActionButton}
              >
                {t('downloadReports', 'Download reports')}
              </Button>
            )}
            <Button
              kind="ghost"
              renderIcon={() => <Play size={16} className={styles.actionButtonIcon} />}
              iconDescription="Run reports"
              onClick={() => {
                launchOverlay(
                  t('runReport', 'Run Report'),
                  <RunReportForm
                    closePanel={() => {
                      closeOverlay();
                      mutateReports();
                    }}
                  />,
                );
              }}
              className={styles.mainActionButton}
            >
              {t('runReports', 'Run reports')}
            </Button>
            <Button
              className={styles.mainActionButton}
              iconDescription="Report schedule"
              kind="ghost"
              onClick={() => navigate({ to: `\${openmrsSpaBase}/reports/scheduled-overview` })}
              renderIcon={() => <Calendar size={16} className={styles.actionButtonIcon} />}
            >
              {t('reportSchedule', 'Report schedule')}
            </Button>
            <Button
              className={styles.mainActionButton}
              iconDescription={t('viewReports', 'Reports Webview')}
              kind="ghost"
              onClick={() => navigate({ to: `\${openmrsSpaBase}/reports/reports-data-overview` })}
              renderIcon={View}
            >
              {t('viewReports', 'Reports Webview')}
            </Button>
          </div>
        </div>
        {error && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('errorFetchingReports', 'Unable to load reports')}
            subtitle={t('refreshReportsToRetry', 'Refresh to try again.')}
          />
        )}
        <DataTable rows={reports} headers={tableHeaders}>
          {({ rows, headers }) => (
            <TableContainer className={styles.requestsTableContainer}>
              <Table className={styles.requestsTable} useZebraStyles>
                <TableHead>
                  <TableRow>
                    <th></th>
                    {headers.map((header) => (
                      <TableHeader key={header.key} className={styles[`${header.key}Column`]}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {renderRowCheckbox(row)}
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles[`${cell.info.header}Column`]}>
                          {cell.info.header === 'actions' ? (
                            <div className={styles.reportActions}>
                              <ReportOverviewButton
                                icon={() => <View size={16} className={styles.actionButtonIcon} />}
                                label={t('view', 'View')}
                                onClick={() => handleViewReport(row.id)}
                                reportRequestUuid={row.id}
                                shouldBeDisplayed={shouldShowViewButton(row)}
                                iconOnly
                              />
                              <ReportOverviewButton
                                icon={() => <Download size={16} className={styles.actionButtonIcon} />}
                                label={t('download', 'Download')}
                                onClick={() => handleDownloadReport(row.id)}
                                reportRequestUuid={row.id}
                                shouldBeDisplayed={shouldShowDownloadButton(row)}
                                iconOnly
                              />
                              <ReportOverviewButton
                                icon={Printer}
                                label={
                                  printingReportUuid === row.id
                                    ? t('preparingReportToPrint', 'Preparing report to print…')
                                    : t('printReport', 'Print report')
                                }
                                onClick={() => handlePrintReport(row.id)}
                                reportRequestUuid={row.id}
                                shouldBeDisplayed={
                                  shouldShowDownloadButton(row) && /^pdf$/i.test(getReportOutputFormat(row)?.trim())
                                }
                                disabled={printingReportUuid !== null}
                                iconOnly
                              />
                              <ReportOverviewButton
                                icon={() => <Save size={16} className={styles.actionButtonIcon} />}
                                label={t('preserve', 'Preserve')}
                                onClick={() => handlePreserveReport(row.id)}
                                reportRequestUuid={row.id}
                                shouldBeDisplayed={getReportStatus(row) === COMPLETED && isEligibleReportUser(row.id)}
                                iconOnly
                              />
                              <ReportOverviewButton
                                icon={() => <TrashCan size={16} className={styles.actionButtonIcon} />}
                                label={t('delete', 'Delete')}
                                onClick={() => launchDeleteReportDialog(row.id)}
                                reportRequestUuid={row.id}
                                shouldBeDisplayed={isEligibleReportUser(row.id)}
                                iconOnly
                              />
                            </div>
                          ) : cell.info.header === 'status' ? (
                            <div className={styles.requestStatus}>
                              <ReportStatus status={cell.value} />
                            </div>
                          ) : cell.info.header === 'reportName' ? (
                            <div>{cell.value?.content ?? cell.value}</div>
                          ) : cell.info.header === 'parameters' ? (
                            <ReportRequestParameters
                              parameters={Array.isArray(cell.value) ? cell.value : undefined}
                              fallback={Array.isArray(cell.value) ? undefined : cell.value?.content ?? cell.value}
                            />
                          ) : cell.info.header === 'requestedOn' && dayjs(cell.value).isValid() ? (
                            <time dateTime={dayjs(cell.value).format()}>
                              {dayjs(cell.value).format('DD-MMM-YYYY')}
                              <span className={styles.requestTime}>{dayjs(cell.value).format('HH:mm')}</span>
                            </time>
                          ) : (
                            cell.value?.content ?? cell.value
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={tableHeaders.length + 1} className={styles.emptyTableMessage}>
                        {isValidating
                          ? t('loadingReports', 'Loading reports…')
                          : error
                            ? t('refreshReportsToRetry', 'Refresh to try again.')
                            : t('noReports', 'No reports yet. Run a report to get started.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        {reports.length > 0 ? (
          <Pagination
            backwardText={t('previousPage', 'Previous page')}
            forwardText={t('nextPage', 'Next page')}
            onChange={({ pageSize: newPageSize, page: newPage }) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);
              }
              setCheckedReportUuidsArray([]);

              if (newPage !== currentPage) {
                setCurrentPage(newPage);
              }
            }}
            page={currentPage}
            pageSize={pageSize}
            pageSizes={DEFAULT_PAGE_SIZES}
            size={isDesktop(layout) ? 'sm' : 'lg'}
            totalItems={reportsTotalCount}
          />
        ) : null}
      </div>
      <Overlay />
    </div>
  );
};

export default OverviewComponent;
