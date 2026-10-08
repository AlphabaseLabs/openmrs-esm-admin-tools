import React from 'react';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { isProviderParameter } from './provider-report-parameter.component';
import { isShareStatusParameter } from './provider-share-status-parameter.component';
import { type ReportParameterValue } from './reports.resource';
import styles from './reports.scss';

const ProviderName: React.FC<{ value: unknown }> = ({ value }) => {
  const { t } = useTranslation();
  const provider = value && typeof value === 'object' ? (value as { uuid?: string; display?: string }) : null;
  const uuid = typeof value === 'string' ? value : provider?.uuid;
  const { data, error, isLoading } = useSWR<{ data: { display?: string } }>(
    uuid && !provider?.display ? `/ws/rest/v1/provider/${encodeURIComponent(uuid)}` : null,
    openmrsFetch,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const name = provider?.display || data?.data?.display;
  return (
    <span title={error ? uuid : undefined}>
      {name ||
        (error
          ? t('providerUnavailable', 'Provider unavailable')
          : uuid && isLoading
            ? t('loadingProvider', 'Loading provider…')
            : uuid
              ? t('providerUnavailable', 'Provider unavailable')
              : '—')}
    </span>
  );
};

const ReportRequestParameters: React.FC<{ parameters?: ReportParameterValue[]; fallback?: string }> = ({
  parameters,
  fallback,
}) => {
  const { t } = useTranslation();
  if (!parameters?.length) {
    return <span>{fallback || '—'}</span>;
  }

  const labels: Record<string, string> = {
    providerUuid: t('provider', 'Provider'),
    shareStatus: t('shares', 'Shares'),
    fromDate: t('startDate', 'Start date'),
    toDate: t('endDate', 'End date'),
    currency: t('currency', 'Currency'),
  };

  return (
    <dl className={styles.requestParameters}>
      {parameters.map((parameter) => {
        const { name, type, value } = parameter;
        let display = value == null || value === '' ? '—' : String(value);
        if (value && typeof value === 'object' && 'display' in value) {
          display = String(value.display);
        } else if (type === 'java.util.Date' && typeof value === 'string' && dayjs(value).isValid()) {
          display = dayjs(value).format('DD-MMM-YYYY');
        } else if (isShareStatusParameter(parameter)) {
          display =
            value === 'PENDING'
              ? t('pending', 'Pending')
              : value === 'PAID'
                ? t('paid', 'Paid')
                : value === 'ALL'
                  ? t('all', 'All')
                  : display;
        }
        return (
          <div key={name}>
            <dt>{labels[name] ?? parameter.label}:</dt>
            <dd>{isProviderParameter(parameter) ? <ProviderName value={value} /> : display}</dd>
          </div>
        );
      })}
    </dl>
  );
};

export default ReportRequestParameters;
