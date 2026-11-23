import { describe, expect, it } from 'vitest';
import { readPanelAction } from './live-panel-relay';

describe('readPanelAction', () => {
  it('reads the actions the projector window sends', () => {
    expect(readPanelAction({ type: 'panel-action', action: 'moderate', questionId: 'q1' })).toEqual({ action: 'moderate', questionId: 'q1' });
    expect(readPanelAction({ type: 'panel-action', action: 'launch-prepared', pollId: 'p1' })).toEqual({ action: 'launch-prepared', pollId: 'p1' });
    expect(readPanelAction({ type: 'panel-action', action: 'load-quizzes' })).toEqual({ action: 'load-quizzes' });
    expect(readPanelAction({ type: 'panel-action', action: 'pick-quiz-question', quizIndex: 0, questionIndex: 2 }))
      .toEqual({ action: 'pick-quiz-question', quizIndex: 0, questionIndex: 2 });
  });

  it('ignores other messages and malformed actions', () => {
    expect(readPanelAction({ type: 'ready' })).toBeNull();
    expect(readPanelAction(null)).toBeNull();
    expect(readPanelAction({ type: 'panel-action', action: 'moderate' })).toBeNull();
    expect(readPanelAction({ type: 'panel-action', action: 'pick-quiz-question', quizIndex: 0.5, questionIndex: 1 })).toBeNull();
    expect(readPanelAction({ type: 'panel-action', action: 'delete-everything' })).toBeNull();
  });
});
