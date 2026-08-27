import * as React from 'react';

/** Multi-line entry, vertical resize only. min-height 60px; 80px and 13px/1.6 mono when mono is set (answer keys, code blocks). */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
}

export declare function Textarea(props: TextareaProps): JSX.Element;
