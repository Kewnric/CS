import * as React from 'react';

/** VS Code-style tab in the practice editor. Mono 13px, 38px tall, cyan when active (text, 2px underline and an 8%-cyan wash). The close x only appears on hover. */
export interface FileTabProps {
  name: string;
  active?: boolean;
  /** Show the unsaved dot after the name. */
  dirty?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export declare function FileTab(props: FileTabProps): JSX.Element;
