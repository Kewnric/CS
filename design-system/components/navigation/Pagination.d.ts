import * as React from 'react';

/** Centred page bar under a long list. 32px square buttons; the current page is a solid indigo fill and is not clickable; ellipsis collapses the middle. */
export interface PaginationProps {
  page?: number;
  pageCount?: number;
  onChange?: (page: number) => void;
  style?: React.CSSProperties;
}

export declare function Pagination(props: PaginationProps): JSX.Element;
