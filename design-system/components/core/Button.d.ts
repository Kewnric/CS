import * as React from 'react';

/**
 * The app's button. Primary is a 135deg indigo gradient with a coloured glow;
 * every variant lifts 1px on hover and scales to 0.97 on press.
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = gradient + glow; secondary = surface + border; ghost = bare, for toolbars; practice = full-width outlined CTA. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'practice';
  size?: 'sm' | 'md';
  /** Lucide name rendered before the label. */
  icon?: string;
  /** Lucide name rendered after the label. */
  iconAfter?: string;
  /** Drop the label and square the padding (toolbar icon button). */
  iconOnly?: boolean;
  disabled?: boolean;
  as?: 'button' | 'a';
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;
