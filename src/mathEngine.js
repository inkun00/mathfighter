/**
 * Math Engine for Math Fighter
 * Generates divisibility, multiple, GCD, LCM, and relationship problems based on stage level.
 */

// Helper to get all divisors of a number
export function getDivisors(num) {
  const divisors = [];
  for (let i = 1; i <= num; i++) {
    if (num % i === 0) divisors.push(i);
  }
  return divisors;
}

// Helper for GCD
export function getGCD(a, b) {
  while (b !== 0) {
    let temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

// Helper for LCM
export function getLCM(a, b) {
  return (a * b) / getGCD(a, b);
}

export function generateBrainTrainingQuestions(stage = 1) {
  const difficulty = Math.max(1, Math.min(5, Math.ceil(stage / 10)));
  const divisorTargets = [
    [12, 16, 18, 20, 24, 27, 28, 30, 36, 40, 42],
    [32, 36, 40, 42, 45, 48, 50, 52, 54, 56, 60, 63, 64],
    [54, 56, 60, 63, 66, 70, 72, 75, 78, 80, 84, 88, 90],
    [84, 90, 96, 99, 100, 104, 108, 112, 117, 120, 126, 130, 132, 135],
    [128, 140, 144, 150, 156, 160, 162, 168, 175, 180, 192, 196, 200, 210]
  ];
  const stamp = Date.now().toString(36);
  const targetSet = divisorTargets[difficulty - 1];
  const templates = [
    () => {
      const target = randomFrom(targetSet);
      const limit = Math.max(3, Math.floor(target / (difficulty + 4)));
      const answer = getDivisors(target).filter(value => value > limit && value < target).length;
      return {
        text: `${target}의 약수 중 ${limit}보다 크고 ${target}보다 작은 약수는 몇 개인가요?`,
        answer
      };
    },
    () => {
      const target = randomFrom(targetSet);
      const answer = getDivisors(target)
        .filter(value => value !== target)
        .reduce((sum, value) => sum + value, 0);
      return {
        text: `${target}의 자기 자신을 제외한 모든 약수의 합을 구하세요.`,
        answer
      };
    },
    () => {
      const a = Math.floor(Math.random() * (7 + difficulty * 2)) + 4;
      const b = Math.floor(Math.random() * (7 + difficulty * 2)) + 5;
      return {
        text: `${a} x □ = ${a * b} 입니다. □에 들어갈 수를 구하세요.`,
        answer: b
      };
    },
    () => {
      const base = Math.floor(Math.random() * (6 + difficulty * 2)) + 3 + difficulty;
      const order = Math.floor(Math.random() * 6) + 3 + difficulty;
      return {
        text: `${base}의 ${order}번째 배수는 무엇인가요?`,
        answer: base * order
      };
    },
    () => {
      const a = Math.floor(Math.random() * (6 + difficulty * 2)) + 3;
      const b = a + Math.floor(Math.random() * 6) + 2;
      return {
        text: `두 수 ${a}, ${b}의 공배수 중 가장 작은 수를 구하세요.`,
        answer: getLCM(a, b)
      };
    },
    () => {
      const gcdBase = randomFrom([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15].slice(0, 5 + difficulty));
      const a = gcdBase * (Math.floor(Math.random() * 5) + 3 + difficulty);
      const b = gcdBase * (Math.floor(Math.random() * 5) + 6 + difficulty);
      return {
        text: `두 수 ${a}, ${b}의 공약수는 모두 몇 개인가요?`,
        answer: getDivisors(getGCD(a, b)).length
      };
    },
    () => {
      const gcdBase = randomFrom([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15].slice(0, 5 + difficulty));
      let a = gcdBase * (Math.floor(Math.random() * 5) + 2 + difficulty);
      let b = gcdBase * (Math.floor(Math.random() * 6) + 5 + difficulty);
      while (a === b || getGCD(a, b) !== gcdBase) {
        a = gcdBase * (Math.floor(Math.random() * 5) + 2 + difficulty);
        b = gcdBase * (Math.floor(Math.random() * 6) + 5 + difficulty);
      }
      return {
        text: `두 수 ${a}, ${b}의 최대공약수를 구하세요.`,
        answer: getGCD(a, b)
      };
    },
    () => {
      const a = Math.floor(Math.random() * (6 + difficulty * 2)) + 4;
      let b = Math.floor(Math.random() * (7 + difficulty * 2)) + 5;
      if (a === b) b += difficulty + 1;
      return {
        text: `두 수 ${a}, ${b}의 최소공배수를 구하세요.`,
        answer: getLCM(a, b)
      };
    },
    () => {
      const divisor = Math.floor(Math.random() * (7 + difficulty * 2)) + 4;
      const quotient = Math.floor(Math.random() * 10) + 5;
      const answer = Math.floor(Math.random() * (divisor - 1)) + 1;
      return {
        text: `${divisor * quotient + answer}에서 ${divisor}로 나누었을 때의 나머지를 구하세요.`,
        answer
      };
    }
  ];

  return shuffle(templates).slice(0, 3).map((createQuestion, index) => {
    const question = createQuestion();
    return {
      id: `brain-${stamp}-${index + 1}`,
      text: question.text,
      options: [],
      answer: question.answer.toString()
    };
  });
}
// Problem Generator
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDivisorTargets(stage) {
  if (stage <= 20) {
    return [
      10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28, 30,
      32, 33, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50, 51, 52, 54, 55, 56, 57, 58, 60
    ];
  }

  return [
    32, 36, 39, 40, 42, 45, 48, 50, 51, 52, 54, 55, 56, 60, 62, 63, 64, 65, 66, 68, 70,
    72, 74, 75, 76, 78, 80, 82, 84, 85, 86, 88, 90, 92, 93, 94, 95, 96, 98, 99, 100, 102,
    104, 105, 106, 108, 110, 112, 114, 115, 116, 117, 118, 120, 124, 125, 126, 128, 130,
    132, 135, 136, 138, 140, 144, 150
  ];
}

export function generateProblem(stage) {
  // Determine area based on stage difficulty ratios
  let area = 1;
  const rand = Math.random() * 100;

  if (stage <= 10) {
    // Area 1, 2: 70%, Area 3: 20%, Area 4, 5: 10%
    if (rand < 35) area = 1;
    else if (rand < 70) area = 2;
    else if (rand < 90) area = 3;
    else area = Math.random() < 0.5 ? 4 : 5;
  } else if (stage <= 20) {
    // Area 1, 2: 40%, Area 3: 40%, Area 4, 5: 20%
    if (rand < 20) area = 1;
    else if (rand < 40) area = 2;
    else if (rand < 80) area = 3;
    else area = Math.random() < 0.5 ? 4 : 5;
  } else if (stage <= 30) {
    // Area 1, 2: 20%, Area 3: 40%, Area 4, 5: 40%
    if (rand < 10) area = 1;
    else if (rand < 20) area = 2;
    else if (rand < 60) area = 3;
    else area = Math.random() < 0.5 ? 4 : 5;
  } else if (stage <= 40) {
    // Area 1, 2: 10%, Area 3: 30%, Area 4, 5: 60%
    if (rand < 5) area = 1;
    else if (rand < 10) area = 2;
    else if (rand < 40) area = 3;
    else area = Math.random() < 0.5 ? 4 : 5;
  } else {
    // Area 1, 2: 10%, Area 3: 20%, Area 4, 5: 70%
    if (rand < 5) area = 1;
    else if (rand < 10) area = 2;
    else if (rand < 30) area = 3;
    else area = Math.random() < 0.5 ? 4 : 5;
  }

  let text = '';
  let checkAnswer = () => false;
  let requiredCount = 3; // Number of correct answers to complete this problem
  let type = '';
  let targetNum = 0;
  let options = []; // Collection of valid answers

  switch (area) {
    case 1: { // Divisor
      type = 'divisor';
      const numbers = getDivisorTargets(stage);
      targetNum = randomFrom(numbers);
      text = `${targetNum}의 약수를 모두 모으세요!`;
      options = getDivisors(targetNum);
      checkAnswer = (num) => targetNum % num === 0;
      requiredCount = Math.min(options.length - 1, 4); // Collect some divisors (excluding 1 if possible, or all)
      break;
    }
    case 2: { // Multiple
      type = 'multiple';
      targetNum = stage <= 20 ? randomInt(3, 12) : randomInt(4, 18);
      text = `${targetNum}의 배수를 모으세요!`;
      // Generate some multiples
      for (let i = 1; i <= 10; i++) options.push(targetNum * i);
      checkAnswer = (num) => num > 0 && num % targetNum === 0;
      requiredCount = 4;
      break;
    }
    case 3: { // Relation (e.g., A = B * C)
      type = 'relation';
      const b = stage <= 20 ? randomInt(2, 9) : randomInt(2, 12);
      const c = stage <= 20 ? randomInt(3, 12) : randomInt(4, 12);
      const a = b * c;
      targetNum = a;
      // Option: find divisors of a, or check if a is a multiple of b/c
      text = `곱셈식 [ ${a} = ${b} × ${c} ] 에서 ${a}의 약수를 고르세요!`;
      options = [b, c];
      checkAnswer = (num) => num === b || num === c;
      requiredCount = 2;
      break;
    }
    case 4: { // GCD
      type = 'gcd';
      let a, b, gcd;
      const gcdBases = stage <= 20 ? [2, 3, 4, 5, 6, 8, 9] : [2, 3, 4, 5, 6, 8, 9, 10, 12];
      do {
        const base = randomFrom(gcdBases);
        a = base * randomInt(stage <= 20 ? 2 : 3, stage <= 20 ? 10 : 14);
        b = base * randomInt(stage <= 20 ? 3 : 4, stage <= 20 ? 12 : 16);
        gcd = getGCD(a, b);
      } while (gcd < 2 || a === b || a > 160 || b > 180);
      
      text = `[ ${a}와 ${b} ] 의 최대공약수는 무엇인가요?`;
      targetNum = gcd;
      options = [gcd];
      checkAnswer = (num) => num === gcd;
      requiredCount = 1;
      break;
    }
    case 5: { // LCM
      type = 'lcm';
      let a, b, lcm;
      do {
        a = stage <= 20 ? randomInt(3, 12) : randomInt(4, 15);
        b = stage <= 20 ? randomInt(3, 12) : randomInt(4, 15);
        lcm = getLCM(a, b);
      } while (lcm > (stage <= 20 ? 120 : 180) || a === b);

      text = `[ ${a}와 ${b} ] 의 최소공배수는 무엇인가요?`;
      targetNum = lcm;
      options = [lcm];
      checkAnswer = (num) => num === lcm;
      requiredCount = 1;
      break;
    }
  }

  return {
    area,
    text,
    targetNum,
    type,
    options,
    requiredCount,
    checkAnswer
  };
}

// Generate the pool of numbers to drop when a monster dies
export function getRandomNumberPool(problem) {
  const correctOnes = [...problem.options];
  const pool = [];
  const correctNumberChance = 0.725; // Raises selected correct-number odds by about 50%.

  // 1. Add correct answers.
  // Ensure at least one correct answer is present
  const chosenCorrect = correctOnes[Math.floor(Math.random() * correctOnes.length)];
  pool.push(chosenCorrect);

  // Generate 4 other numbers (some correct, some incorrect)
  for (let i = 0; i < 4; i++) {
    if (Math.random() < correctNumberChance) {
      // Pick a correct answer
      pool.push(correctOnes[Math.floor(Math.random() * correctOnes.length)]);
    } else {
      // Generate an incorrect answer
      let fakeNum;
      let isCorrect = true;
      let attempts = 0;

      while (isCorrect && attempts < 20) {
        attempts++;
        if (problem.type === 'divisor') {
          // Divisors: Pick random numbers near target but not divisors
          fakeNum = Math.floor(Math.random() * (problem.targetNum - 2)) + 2;
          isCorrect = problem.targetNum % fakeNum === 0;
        } else if (problem.type === 'multiple') {
          // Multiples: Pick random numbers that aren't multiples
          fakeNum = Math.floor(Math.random() * (problem.targetNum * 6)) + 2;
          isCorrect = fakeNum % problem.targetNum === 0;
        } else if (problem.type === 'relation') {
          // Relation: Pick numbers that are not b or c
          fakeNum = Math.floor(Math.random() * 20) + 2;
          isCorrect = problem.options.includes(fakeNum);
        } else {
          // GCD/LCM: Just random number offset from target
          const offset = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 8) + 1);
          fakeNum = problem.targetNum + offset;
          if (fakeNum <= 0) fakeNum = problem.targetNum + 3;
          isCorrect = fakeNum === problem.targetNum;
        }
      }
      pool.push(fakeNum);
    }
  }

  return pool;
}

// Generates evaluation questions for the review sheet popup
function getSimilarQuestionsLegacy(wrongAreas) {
  // If no wrong areas, default to areas 1, 2, 4
  const areasToUse = wrongAreas && wrongAreas.length > 0 ? wrongAreas : [1, 2, 4];
  const questions = [];

  areasToUse.forEach((area, index) => {
    let qText = '';
    let qOptions = [];
    let qAnswer = '';

    if (area === 1) { // Divisor
      const targets = [20, 28, 32, 45];
      const target = targets[Math.floor(Math.random() * targets.length)];
      qText = `${target}의 약수가 아닌 것은 무엇인가요?`;
      
      const divisors = getDivisors(target);
      // Pick 3 divisors
      const correctOpts = divisors.filter(d => d !== 1).slice(0, 3);
      // Pick 1 non-divisor
      let fake;
      do {
        fake = Math.floor(Math.random() * 20) + 2;
      } while (target % fake === 0);
      
      qOptions = [...correctOpts, fake].sort(() => Math.random() - 0.5);
      qAnswer = fake.toString();
    } else if (area === 2) { // Multiple
      const target = Math.floor(Math.random() * 4) + 6; // 6~9
      qText = `다음 중 ${target}의 배수인 것은 무엇인가요?`;
      const correct = target * 4;
      const fakes = [];
      while (fakes.length < 3) {
        let fake = Math.floor(Math.random() * 40) + 2;
        if (fake % target !== 0 && !fakes.includes(fake)) fakes.push(fake);
      }
      qOptions = [correct, ...fakes].sort(() => Math.random() - 0.5);
      qAnswer = correct.toString();
    } else if (area === 3) { // Relation
      const b = 6;
      const c = 7;
      const a = 42;
      qText = `곱셈식 [ 42 = 6 × 7 ] 에 대한 설명 중 틀린 것은 무엇인가요?`;
      qOptions = [
        `6은 42의 약수입니다.`,
        `7은 42의 약수입니다.`,
        `42는 6의 배수입니다.`,
        `6은 7의 배수입니다.`
      ];
      qAnswer = `6은 7의 배수입니다.`;
    } else if (area === 4) { // GCD
      const a = 18;
      const b = 30;
      const gcd = getGCD(a, b); // 6
      qText = `두 수 ${a}와 ${b}의 최대공약수를 구하세요. (숫자만 입력)`;
      qOptions = []; // 주관식
      qAnswer = gcd.toString();
    } else { // LCM
      const a = 8;
      const b = 12;
      const lcm = getLCM(a, b); // 24
      qText = `두 수 ${a}와 ${b}의 최소공배수를 구하세요. (숫자만 입력)`;
      qOptions = []; // 주관식
      qAnswer = lcm.toString();
    }

    questions.push({
      id: index + 1,
      area,
      text: qText,
      options: qOptions,
      answer: qAnswer
    });
  });

  return questions;
}

export function getSimilarQuestions(wrongAreas) {
  const baseAreas = wrongAreas && wrongAreas.length > 0 ? [...wrongAreas] : [1, 2, 4];
  const areasToUse = [];

  while (areasToUse.length < 3) {
    areasToUse.push(baseAreas[areasToUse.length % baseAreas.length]);
  }

  return areasToUse.map((area, index) => {
    if (area === 1) return createDivisorReviewQuestion(index + 1);
    if (area === 2) return createMultipleReviewQuestion(index + 1);
    if (area === 3) return createRelationReviewQuestion(index + 1);
    if (area === 4) return createGcdReviewQuestion(index + 1);
    return createLcmReviewQuestion(index + 1);
  });
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function uniquePush(values, value) {
  if (!values.includes(value)) values.push(value);
}

function createDivisorReviewQuestion(id) {
  const target = randomFrom([18, 20, 24, 28, 30, 32, 36, 42, 45, 48, 54, 60]);
  const divisors = shuffle(getDivisors(target).filter(value => value !== 1 && value !== target));
  const options = divisors.slice(0, 3);
  let fake = 2;

  do {
    fake = Math.floor(Math.random() * (target + 8)) + 2;
  } while (target % fake === 0 || options.includes(fake));

  options.push(fake);

  return {
    id,
    area: 1,
    text: `${target}의 약수가 아닌 것은 무엇인가요?`,
    options: shuffle(options),
    answer: fake.toString()
  };
}

function createMultipleReviewQuestion(id) {
  const target = Math.floor(Math.random() * 8) + 3;
  const correct = target * (Math.floor(Math.random() * 8) + 2);
  const options = [correct];

  while (options.length < 4) {
    const fake = Math.floor(Math.random() * (target * 12)) + 2;
    if (fake % target !== 0) uniquePush(options, fake);
  }

  return {
    id,
    area: 2,
    text: `다음 중 ${target}의 배수인 것은 무엇인가요?`,
    options: shuffle(options),
    answer: correct.toString()
  };
}

function createRelationReviewQuestion(id) {
  const b = Math.floor(Math.random() * 7) + 3;
  const c = Math.floor(Math.random() * 7) + 4;
  const a = b * c;
  const answer = `${b}와 ${c}는 ${a}의 약수입니다.`;

  return {
    id,
    area: 3,
    text: `[ ${a} = ${b} x ${c} ] 에 대한 설명 중 옳은 것은 무엇인가요?`,
    options: shuffle([
      answer,
      `${a}는 ${b}의 약수입니다.`,
      `${b}는 ${c}의 배수입니다.`,
      `${a}는 ${c}보다 작은 수입니다.`
    ]),
    answer
  };
}

function createGcdReviewQuestion(id) {
  const gcdBase = randomFrom([2, 3, 4, 5, 6, 8, 9]);
  let a = gcdBase * (Math.floor(Math.random() * 5) + 2);
  let b = gcdBase * (Math.floor(Math.random() * 5) + 6);

  while (a === b || getGCD(a, b) !== gcdBase) {
    a = gcdBase * (Math.floor(Math.random() * 5) + 2);
    b = gcdBase * (Math.floor(Math.random() * 5) + 6);
  }

  return {
    id,
    area: 4,
    text: `두 수 ${a}와 ${b}의 최대공약수를 구하세요. (숫자만 입력)`,
    options: [],
    answer: getGCD(a, b).toString()
  };
}

function createLcmReviewQuestion(id) {
  let a = Math.floor(Math.random() * 8) + 3;
  let b = Math.floor(Math.random() * 8) + 4;
  let lcm = getLCM(a, b);

  while (a === b || lcm > 120) {
    a = Math.floor(Math.random() * 8) + 3;
    b = Math.floor(Math.random() * 8) + 4;
    lcm = getLCM(a, b);
  }

  return {
    id,
    area: 5,
    text: `두 수 ${a}와 ${b}의 최소공배수를 구하세요. (숫자만 입력)`,
    options: [],
    answer: lcm.toString()
  };
}
