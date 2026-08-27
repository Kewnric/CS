import * as React from 'react';

/** Field label — 11px/700 uppercase, 0.06em tracking, tertiary colour. Every input in the app is labelled this way. */
export interface FormLabelProps {
  children?: React.ReactNode;
  /** Right-aligned secondary content on the same line (a char count, a "Reset" link). */
  aside?: React.ReactNode;
  htmlFor?: string;
  style?: React.CSSProperties;
}

export declare function FormLabel(props: FormLabelProps): JSX.Element;
