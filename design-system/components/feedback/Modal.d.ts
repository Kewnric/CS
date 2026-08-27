import * as React from 'react';

/**
 * Centred dialog. Scrim is 55% black at 10px blur; the card is 24px-radius,
 * centre-aligned, and RISES into place on an expo-out curve — deliberately no
 * spring overshoot (the source removed it for reading as clunky).
 */
export interface ModalProps {
  open?: boolean;
  title?: string;
  description?: string;
  /** Lucide name, rendered at 48px above the title. */
  icon?: string;
  iconColor?: string;
  /** md=420, lg=520, wide=900, search=640. */
  size?: 'md' | 'lg' | 'wide' | 'search';
  /** Buttons row. Each stretches with flex:1. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export declare function Modal(props: ModalProps): JSX.Element | null;
