import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonSet, Form, Select, SelectItem, Stack } from '@carbon/react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import ReportParameter from '../report-parameter.component';
import { PROVIDER_FINANCIAL_STATEMENT_UUID } from '../../constants';
import { useLocations, useReportDefinitions, useReportDesigns, runReport } from '../reports.resource';
import styles from './run-report-form.scss';

const supportedParameterTypes = [
  'java.util.Date',
  'java.lang.String',
  'java.lang.Integer',
  'org.openmrs.Location',
  'org.openmrs.Provider',
  'org.openmrs.Concept',
];

interface RunReportForm {
  closePanel: () => void;
}

const RunReportForm: React.FC<RunReportForm> = ({ closePanel }) => {
  const { t } = useTranslation();
  const [reportUuid, setReportUuid] = useState('');
  const [selectedRenderModeUuid, setRenderModeUuid] = useState<string | null>(null);
  const [reportParameters, setReportParameters] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTablet = useLayoutType() === 'tablet';

  const { reportDesigns } = useReportDesigns(reportUuid);
  const { reportDefinitions } = useReportDefinitions();
  const { locations } = useLocations();
  const currentReport = reportDefinitions?.find((report) => report.uuid === reportUuid);
  const defaultDesign =
    reportUuid === PROVIDER_FINANCIAL_STATEMENT_UUID
      ? reportDesigns?.find((design) => design.name.trim().toUpperCase() === 'PDF')?.uuid
      : undefined;
  // Null means untouched; an explicit choice (including clearing the field) wins over the default.
  const renderModeUuid = selectedRenderModeUuid ?? defaultDesign ?? '';
  const isFormValid = Boolean(
    currentReport &&
      reportDesigns?.some((design) => design.uuid === renderModeUuid) &&
      currentReport.parameters?.every((parameter) => {
        if (!supportedParameterTypes.includes(parameter.type)) return false;
        const value = reportParameters[parameter.name];
        const empty = value == null || (typeof value === 'string' && value.trim() === '');
        if (empty) return !parameter.required;
        return parameter.type !== 'java.util.Date' || (value instanceof Date && Number.isFinite(value.getTime()));
      }),
  );
  const submitting = useRef(false);
  const mounted = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(closeTimer.current);
    };
  }, []);

  function handleOnChange(event) {
    const key = event.target.name;
    let value = null;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    } else {
      value = event.target.value;
    }

    setReportParameters((state) => ({ ...state, [key]: value }));
  }

  function handleOnDateChange(fieldName, dateValue) {
    setReportParameters((state) => ({ ...state, [fieldName]: dateValue }));
  }

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!isFormValid || submitting.current) return;
      submitting.current = true;
      setIsSubmitting(true);

      const reportRequest = {
        uuid: null,
        reportDefinition: {
          parameterizable: {
            uuid: reportUuid,
          },
          parameterMappings: reportParameters,
        },
        renderingMode: {
          argument: renderModeUuid,
        },
        schedule: null,
      };

      runReport(reportRequest)
        .then(() => {
          if (!mounted.current) return;
          // delayed handling because runReport returns before new reports is accessible via GET
          closeTimer.current = setTimeout(() => {
            showSnackbar({
              kind: 'success',
              title: t('reportRanSuccessfully', 'Report ran successfully'),
            });
            submitting.current = false;
            setIsSubmitting(false);
            closePanel();
          }, 500);
        })
        .catch((error) => {
          submitting.current = false;
          if (!mounted.current) return;
          showSnackbar({
            kind: 'error',
            title: t('errorRunningReport', 'Error running report'),
            subtitle: error?.message,
          });
          setIsSubmitting(false);
        });
    },
    [closePanel, isFormValid, reportParameters, reportUuid, renderModeUuid, t],
  );

  return (
    <Form className={styles.desktopRunReport} onSubmit={handleSubmit}>
      <Stack gap={5} className={styles.formContent}>
        <Select
          id="select-report"
          labelText={t('selectReportLabel', 'Report')}
          onChange={(e) => {
            setReportUuid(e.target.value);
            setRenderModeUuid(null);
            setReportParameters(e.target.value === PROVIDER_FINANCIAL_STATEMENT_UUID ? { currency: 'PKR' } : {});
          }}
          value={reportUuid}
        >
          <SelectItem text="" value={''} />
          {reportDefinitions?.map((reportDefinition) => (
            <SelectItem key={reportDefinition.uuid} text={reportDefinition.name} value={reportDefinition.uuid}>
              {reportDefinition.name}
            </SelectItem>
          ))}
        </Select>
        {currentReport?.parameters?.map((parameter) => {
          return parameter.type === 'java.util.Date' ? (
            <ReportParameter
              key={parameter.name + reportUuid}
              parameter={parameter}
              reportUuid={reportUuid}
              reportParameters={reportParameters}
              locations={locations}
              handleOnDateChange={handleOnDateChange}
              handleOnChange={undefined}
            />
          ) : (
            <ReportParameter
              key={parameter.name + reportUuid}
              parameter={parameter}
              reportUuid={reportUuid}
              reportParameters={reportParameters}
              locations={locations}
              handleOnChange={handleOnChange}
              handleOnDateChange={undefined}
            />
          );
        })}
        <Select
          id="output-format-select"
          labelText={t('outputFormat', 'Output format')}
          onChange={(e) => setRenderModeUuid(e.target.value)}
          value={renderModeUuid}
        >
          <SelectItem text="" value={''} />
          {reportDesigns?.map((reportDesign) => (
            <SelectItem key={reportDesign.uuid} text={reportDesign.name} value={reportDesign.uuid}>
              {reportDesign.name}
            </SelectItem>
          ))}
        </Select>
      </Stack>
      <div className={styles.buttonsDiv}>
        <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
          <Button onClick={closePanel} kind="secondary" size="xl" className={styles.reportButton}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            disabled={!isFormValid || isSubmitting}
            size="xl"
            className={styles.reportButton}
            kind="primary"
            type="submit"
          >
            {t('run', 'Run')}
          </Button>
        </ButtonSet>
      </div>
    </Form>
  );
};

export default RunReportForm;
