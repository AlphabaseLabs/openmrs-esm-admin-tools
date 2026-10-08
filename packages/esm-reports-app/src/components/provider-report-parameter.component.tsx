import React, { useState } from 'react';
import { ComboBox } from '@carbon/react';
import { openmrsFetch, useDebounce } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';

interface ProviderOption {
  uuid: string;
  display: string;
}

interface Props {
  name: string;
  label: string;
  value?: string | ProviderOption;
  onChange: (uuid: string) => void;
}

// UUID string parameters keep report requests independent of Provider entity serialization.
export const isProviderParameter = (parameter: { type: string; name: string }) =>
  parameter.type === 'org.openmrs.Provider' ||
  (parameter.type === 'java.lang.String' && parameter.name === 'providerUuid');

const ProviderReportParameter: React.FC<Props> = ({ name, label, value, onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<ProviderOption | null>(null);
  const query = useDebounce(search.trim(), 300);
  const uuid = typeof value === 'string' ? value : value?.uuid;
  const { data: selected, error: selectionError } = useSWR<{ data: ProviderOption }>(
    uuid ? `/ws/rest/v1/provider/${encodeURIComponent(uuid)}` : null,
    openmrsFetch,
  );
  const { data, error, isLoading } = useSWR<{ data: { results: ProviderOption[] } }>(
    `/ws/rest/v1/provider?q=${encodeURIComponent(query)}&limit=25&v=default`,
    openmrsFetch,
  );
  const selectedItem =
    selection?.uuid === uuid ? selection : selected?.data ?? (typeof value === 'object' ? value : null);
  const results = data?.data?.results ?? [];
  const items =
    selectedItem && !results.some((item) => item.uuid === selectedItem.uuid) ? [selectedItem, ...results] : results;

  return (
    <ComboBox
      id={`report-provider-${name}`}
      titleText={label}
      placeholder={t('searchProvider', 'Search for a provider')}
      helperText={isLoading ? t('loadingProviders', 'Loading providers…') : undefined}
      invalid={Boolean(error || selectionError)}
      invalidText={t('loadProvidersError', 'Unable to load providers. Try searching again.')}
      items={items}
      selectedItem={selectedItem}
      itemToString={(item: ProviderOption | null) => item?.display ?? ''}
      shouldFilterItem={() => true}
      onInputChange={setSearch}
      onChange={({ selectedItem }) => {
        setSelection(selectedItem ?? null);
        onChange(selectedItem?.uuid ?? '');
      }}
    />
  );
};

export default ProviderReportParameter;
