import * as React from 'react';

/** Pill search field with an inset 18px search glyph. Unlike Input, this one DOES take a 3px primary-glow ring on focus. 320px wide by default; full width on mobile. */
export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  width?: number | string;
}

export declare function SearchInput(props: SearchInputProps): JSX.Element;
