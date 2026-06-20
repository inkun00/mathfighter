import { getNextStageProgress } from './stageRules.js';

export function getNextStageTransition(currentStage) {
  const progress = getNextStageProgress(currentStage);
  return {
    currentStage: progress.nextStage,
    destination: progress.completed ? 'certificate' : 'stage'
  };
}

export function getPlayerDeathTransition({ isDeathHandled, usedReviewRevive }) {
  if (isDeathHandled) {
    return { destination: 'ignore', isDeathHandled, usedReviewRevive };
  }

  return {
    destination: usedReviewRevive ? 'certificate' : 'review',
    isDeathHandled: true,
    usedReviewRevive: true
  };
}
