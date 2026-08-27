import * as React from 'react';

/**
 * Row in the deep folder tree. Folders take a cyan glyph and a chevron that
 * rotates 90deg on expand; items take a tertiary glyph. Depth is colour-coded
 * by a 3px rail on the RIGHT edge — indigo, cyan, green, amber, red by level.
 * Children indent behind a 2px border-left.
 */
export interface TreeNodeProps {
  label: string;
  /** Lucide name. Defaults by kind. */
  icon?: string;
  kind?: 'folder' | 'item';
  /** Depth 0-4, drives the right-edge rail colour. */
  level?: number;
  expanded?: boolean;
  active?: boolean;
  /** Child count pill on the right. */
  count?: number;
  /** Prerequisite not met — dims and shows an amber lock. */
  locked?: boolean;
  onToggle?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function TreeNode(props: TreeNodeProps): JSX.Element;
