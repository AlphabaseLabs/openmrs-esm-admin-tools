import React from 'react';

interface ReportsPictogramProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

// Core 10 does not export ReportsPictogram. Render the OpenMRS reports pictogram
// locally so report headers retain the standard OpenMRS page-header appearance.
const ReportsPictogram = React.forwardRef<SVGSVGElement, ReportsPictogramProps>(({ size = 92, ...svgProps }, ref) => (
  <svg ref={ref} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" focusable="false" {...svgProps}>
    <path
      fill="#CEE6E5"
      d="M25.89 44h-7.78A1.11 1.11 0 0 0 17 45.11v13.78c0 .613.497 1.11 1.11 1.11h7.78A1.11 1.11 0 0 0 27 58.89V45.11A1.11 1.11 0 0 0 25.89 44M37.89 32h-7.78A1.11 1.11 0 0 0 29 33.11v25.78c0 .613.497 1.11 1.11 1.11h7.78A1.11 1.11 0 0 0 39 58.89V33.11A1.11 1.11 0 0 0 37.89 32M49.89 38h-7.78A1.11 1.11 0 0 0 41 39.11v19.78c0 .613.497 1.11 1.11 1.11h7.78A1.11 1.11 0 0 0 51 58.89V39.11A1.11 1.11 0 0 0 49.89 38"
    />
    <path
      fill="#7BBCB9"
      d="M61.89 20h-7.78A1.11 1.11 0 0 0 53 21.11v37.78c0 .613.497 1.11 1.11 1.11h7.78A1.11 1.11 0 0 0 63 58.89V21.11A1.11 1.11 0 0 0 61.89 20"
    />
    <path fill="#CEE6E5" d="M63 61H17a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h46a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1" />
  </svg>
));

ReportsPictogram.displayName = 'ReportsPictogram';

export default ReportsPictogram;
