import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportParameter from './report-parameter.component';

describe('report date parameter', () => {
  it('allows navigating from September to August without changing the selected date until a day is chosen', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <ReportParameter
        parameter={{ name: 'fromDate', label: 'Start date', type: 'java.util.Date' }}
        reportUuid="statement"
        reportParameters={{ fromDate: new Date(2026, 8, 15) }}
        locations={[]}
        handleOnChange={undefined}
        handleOnDateChange={onChange}
      />,
    );

    const input = screen.getByLabelText('Start date');
    expect(input).toHaveValue('15/09/2026');
    fireEvent.click(input);
    const calendar = screen.getByRole('application', { name: 'calendar-container' });
    // Flatpickr's previous-month navigation span has no accessible label.
    // eslint-disable-next-line testing-library/no-node-access
    fireEvent.click(calendar.querySelector('.flatpickr-prev-month'));
    expect(screen.getByText('August')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('15/09/2026');

    fireEvent.click(screen.getByLabelText('August 15, 2026'));
    expect(onChange).toHaveBeenLastCalledWith('fromDate', new Date(2026, 7, 15));
    expect(input).toHaveValue('15/08/2026');

    unmount();
    expect(screen.queryByRole('application', { name: 'calendar-container' })).not.toBeInTheDocument();
  });
});
