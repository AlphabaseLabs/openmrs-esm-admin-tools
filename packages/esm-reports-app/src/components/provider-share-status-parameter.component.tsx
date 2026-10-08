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
          ? t('pendingStatementHelp', 'Includes older unpaid balances at the end date.')
          : value === 'PAID'
            ? t('paidStatementHelp', 'Includes provider payments and reversals within the selected period.')
            : undefined
      }
    >
      <SelectItem value="" text={t('selectShareStatus', 'Select Paid or Pending')} disabled hidden />
      <SelectItem value="PENDING" text={t('pending', 'Pending')} />
      <SelectItem value="PAID" text={t('paid', 'Paid')} />
    </Select>
  );
};

export default ProviderShareStatusParameter;
