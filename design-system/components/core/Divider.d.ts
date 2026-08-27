import * as React from 'react';

/** 1px rule in --border-color. Horizontal takes 16px of margin above and below; vertical is 24px tall with 8px side margins. */
export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  style?: React.CSSProperties;
}

export declare function Divider(props: DividerProps): JSX.Element;
