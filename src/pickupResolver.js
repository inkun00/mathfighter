import { circlesOverlap } from './combatResolver.js';
import { getStageRewardMultiplier } from './stageRules.js';

export function evaluateNumberAnswer({ problem, value, combo, stage, monsters }) {
  if (problem.checkAnswer(value)) {
    const nextCombo = combo + 1;
    const goldReward = Math.floor(
      (30 + nextCombo * 5) * 1.2 * getStageRewardMultiplier(stage)
    );
    return {
      correct: true,
      combo: nextCombo,
      goldReward,
      penaltyDamage: 0
    };
  }

  const baseAttack = monsters.length > 0 ? monsters[0].atk : 10;
  return {
    correct: false,
    combo: 0,
    goldReward: 0,
    penaltyDamage: Math.max(1, Math.floor(baseAttack * 0.6))
  };
}

export function resolveDropItemPickups({
  dropItems,
  player,
  activeProblem,
  monsters,
  combo,
  stage,
  onLevelUp,
  onMonsterDefeat,
  onNumberAnswer
}) {
  let currentCombo = combo;

  dropItems.forEach(item => {
    item.update({ x: player.x, y: player.y }, player.magnetRange);
    if (!circlesOverlap(player, item)) return;

    item.isDead = true;

    if (item.type === 'gem') {
      if (player.gainExp(item.value)) onLevelUp();
      return;
    }

    if (item.type === 'heart') {
      player.heal(item.value);
      return;
    }

    if (item.type === 'bomb') {
      monsters.forEach(monster => {
        if (monster.hp <= 0 || monster.isElite) return;
        monster.hp = 0;
        onMonsterDefeat(monster);
      });
      return;
    }

    if (item.type !== 'number' || item.problemId !== activeProblem.id) return;

    const result = evaluateNumberAnswer({
      problem: activeProblem,
      value: item.value,
      combo: currentCombo,
      stage,
      monsters
    });
    const resolvedCombo = onNumberAnswer(item, result);
    currentCombo = Number.isFinite(resolvedCombo) ? resolvedCombo : result.combo;
  });
}
