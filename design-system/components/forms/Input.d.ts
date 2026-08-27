import * as React from 'react';

/**
 * Text field. Focus swaps the border to indigo and adds NO ring — the source
 * explicitly sets box-shadow:none on .form-input:focus.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Use JetBrains Mono — for code, IDs and numeric entry. */
  mono?: boolean;
  align?: 'left' | 'center' | 'right';
}

export declare function Input(props: InputProps): JSX.Element;
