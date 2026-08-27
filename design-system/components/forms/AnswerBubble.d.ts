import * as React from 'react';

/**
 * Multiple-choice bubble from the answer-sheet system. Five states: default,
 * selected (indigo fill), correct (green), wrong (red, shakes), and expected
 * (dashed green outline, shown next to a wrong pick after grading).
 */
export interface AnswerBubbleProps {
  children?: React.ReactNode;
  state?: 'default' | 'selected' | 'correct' | 'wrong' | 'expected';
  /** md = 32px (answer sheet rows); lg = 64px (single-question practice view). */
  size?: 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function AnswerBubble(props: AnswerBubbleProps): JSX.Element;
