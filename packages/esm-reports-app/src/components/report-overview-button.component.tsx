import React from 'react';
import { Button } from '@carbon/react';
import styles from './reports.scss';

interface ReportOverviewButtonProps {
  shouldBeDisplayed: boolean;
  label: string;
  icon: React.ComponentProps<typeof Button>['renderIcon'];
  reportRequestUuid: string;
  onClick: () => void;
  iconOnly?: boolean;
  disabled?: boolean;
}

const ReportOverviewButton: React.FC<ReportOverviewButtonProps> = ({
  shouldBeDisplayed,
  label,
  icon,
  onClick,
  iconOnly = false,
  disabled = false,
}) => {
  if (shouldBeDisplayed) {
    return (
      <div className={styles.actionButtonsWrapperDiv}>
        <Button
          kind="ghost"
          size={iconOnly ? 'sm' : undefined}
          hasIconOnly={iconOnly}
          tooltipPosition={iconOnly ? 'left' : undefined}
          disabled={disabled}
          renderIcon={icon}
          iconDescription={label}
          onClick={onClick}
          className={iconOnly ? undefined : styles.actionButon}
        >
          {iconOnly ? undefined : label}
        </Button>
      </div>
    );
  } else {
    return null;
  }
};

export default ReportOverviewButton;
