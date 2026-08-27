import * as React from 'react';

export interface TabItem {
  label: string;
  /** Defaults to label. */
  value?: string;
  /** Lucide name. */
  icon?: string;
}

/**
 * Two tab treatments from the source: underline (Training Grounds / variant
 * strips — indigo 2px underline on the active tab) and pill (mindmap scope
 * switcher — rounded outline that fills with indigo-subtle).
 */
export interface TabsProps {
  items?: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'underline' | 'pill';
  style?: React.CSSProperties;
}

export declare function Tabs(props: TabsProps): JSX.Element;
