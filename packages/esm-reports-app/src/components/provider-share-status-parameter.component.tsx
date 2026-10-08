import React from 'react';
import { Select, SelectItem } from '@carbon/react';
import { useTranslation } from 'react-i18next';

export const isShareStatusParameter = (parameter: { type: string; name: string }) =>
  parameter.type === 'java.lang.String' && parameter.name === 'shareStatus';

const ProviderShareStatusParameter: React.FC<{
  name: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
}> = ({ name, label, value, onChange }) => {
  const { t } = useTranslation();
  return (
    <Select
      id={name}
      name={name}
      labelText={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      helperText={
        value === 'PENDING'
          ? t(
              'pendingStatementHelp',
              'Shows each patient payment that released a share in the selected period and still has an unpaid amount at its end.',
            )
          : value === 'PAID'
            ? t('paidStatementHelp', 'Includes provider payments and reversals within the selected period.')
            : value === 'ALL'
              ? t('allStatementHelp', 'Includes pending share releases and provider payments from the selected period.')
              : undefined
      }
    >
      <SelectItem value="" text={t('selectShareStatus', 'Select All, Pending or Paid')} disabled hidden />
      <SelectItem value="ALL" text={t('all', 'All')} />
      <SelectItem value="PENDING" text={t('pending', 'Pending')} />
      <SelectItem value="PAID" text={t('paid', 'Paid')} />
    </Select>
  );
};

export default ProviderShareStatusParameter;
