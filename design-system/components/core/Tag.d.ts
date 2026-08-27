import * as React from 'react';

/** Removable chip — 6px radius (squarer than Badge), indigo-subtle fill; the x turns red on hover. */
export interface TagProps {
  children?: React.ReactNode;
  /** Show the remove affordance. Omit for a static chip. */
  onRemove?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function Tag(props: TagProps): JSX.Element;
