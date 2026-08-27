import * as React from 'react';

/** Native select styled to match Input. The version picker in the session dialog sets fontWeight 600 on it. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
}

export declare function Select(props: SelectProps): JSX.Element;
