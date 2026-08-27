import * as React from 'react';

/**
 * Glass KPI tile from the home dashboard. Four sit in a row and each takes its
 * own accent in fixed order — indigo, green, amber, cyan — as a 3px top bar and
 * a washed icon chip. The number is mono 28px/800; the label is 11px uppercase.
 */
export interface StatCardProps {
  /** Lucide name. */
  icon?: string;
  value?: React.ReactNode;
  label?: string;
  accent?: 'indigo' | 'green' | 'amber' | 'cyan';
  /** Streak about to break — turns the border and label amber. */
  atRisk?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function StatCard(props: StatCardProps): JSX.Element;
