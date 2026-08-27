import * as React from 'react';

/** Stacking notification. The tone shows only as a 3px left border and the glyph colour — the card itself stays neutral elevated surface. Container is fixed bottom-right, 20px in, 0.6rem gap. */
export interface ToastProps {
  tone?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export declare function Toast(props: ToastProps): JSX.Element;
