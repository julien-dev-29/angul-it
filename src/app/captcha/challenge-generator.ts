export type ChallengeType = 'image' | 'math' | 'text';
export type ChallengeStatus = 'active' | 'passed';

export interface Challenge {
  id: number;
  type: ChallengeType;
  question: string;
  images?: string[];
  category?: string;
  answer: string | number | number[];
  userAnswer?: string | number | number[];
  attempts: number;
  status: ChallengeStatus;
}

export interface CaptchaSession {
  challenges: Challenge[];
  currentIndex: number;
  maxIndex: number;
  completed: boolean;
  startedAt: number;
}

export interface ImageCategory {
  category: string;
  label: string;
  correct: string[];
  distractors: string[];
}

export const IMAGE_CATEGORIES: ImageCategory[] = [
  { category: 'cats', label: 'a cat', correct: ['🐱', '🐈', '😺', '😻'], distractors: ['🐶', '🦊', '🐺', '🐵'] },
  { category: 'flowers', label: 'a flower', correct: ['🌸', '🌺', '🌻', '🌷'], distractors: ['🍀', '🌿', '🌵', '🍁'] },
  { category: 'vehicles', label: 'a car or bus', correct: ['🚗', '🚙', '🚌', '🏎️'], distractors: ['🚲', '🚤', '✈️', '🚂'] },
  { category: 'fruits', label: 'a fruit', correct: ['🍎', '🍌', '🍇', '🍓'], distractors: ['🥕', '🌽', '🍆', '🍄'] },
  { category: 'music', label: 'a musical note', correct: ['🎵', '🎶', '🎸', '🎹'], distractors: ['🥁', '🎺', '🎧', '🎤'] },
];

export const WORD_POOL: string[] = ['angular', 'captcha', 'harbor', 'quartz', 'purple', 'drift'];

const rand = (n: number): number => Math.floor(Math.random() * n);

export function pick<T>(items: readonly T[]): T {
  return items[rand(items.length)];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildImageChallenge(id: number): Challenge {
  const category = pick(IMAGE_CATEGORIES);
  const correctCount = 2 + rand(3);
  const correctTiles = shuffle(category.correct).slice(0, correctCount);
  const tiles = [...correctTiles];
  const distractors = shuffle(category.distractors);
  while (tiles.length < 9) {
    tiles.push(distractors[tiles.length % distractors.length]);
  }
  const images = shuffle(tiles);
  const answer: number[] = [];
  images.forEach((tile, index) => {
    if (correctTiles.includes(tile)) answer.push(index);
  });
  return {
    id,
    type: 'image',
    question: `Select every tile showing ${category.label}.`,
    category: category.category,
    images,
    answer,
    attempts: 0,
    status: 'active',
  };
}

export function buildMathChallenge(id: number): Challenge {
  const op = pick(['+', '−', '×'] as const);
  let a = 1 + rand(12);
  let b = 1 + rand(12);
  if (op === '−' && b > a) {
    [a, b] = [b, a];
  }
  const answer = op === '+' ? a + b : op === '−' ? a - b : a * b;
  return {
    id,
    type: 'math',
    question: `What is ${a} ${op} ${b}?`,
    answer,
    attempts: 0,
    status: 'active',
  };
}

export function buildTextChallenge(id: number): Challenge {
  const word = pick(WORD_POOL);
  return {
    id,
    type: 'text',
    question: `Type the word "${word}".`,
    answer: word,
    attempts: 0,
    status: 'active',
  };
}

export function buildSession(startedAt: number): CaptchaSession {
  const one = [buildImageChallenge(0), buildMathChallenge(1), buildTextChallenge(2)];
  const extra = pick([buildImageChallenge, buildMathChallenge, buildTextChallenge])(3);
  return {
    challenges: shuffle([...one, extra]),
    currentIndex: 0,
    maxIndex: 0,
    completed: false,
    startedAt,
  };
}

export function isCorrect(challenge: Challenge, input: unknown): boolean {
  if (challenge.type === 'image') {
    if (!Array.isArray(input) || !Array.isArray(challenge.answer)) return false;
    const left = [...(input as number[])].sort((a, b) => a - b);
    const right = (challenge.answer as number[]).slice().sort((a, b) => a - b);
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }
  if (challenge.type === 'math') {
    const raw = String(input ?? '').trim();
    if (raw === '') return false;
    const n = Number(raw);
    return Number.isFinite(n) && n === challenge.answer;
  }
  return String(input ?? '').trim().toLowerCase() === String(challenge.answer).toLowerCase();
}

export function describeUserAnswer(challenge: Challenge): string {
  if (challenge.type === 'image') {
    const picked = Array.isArray(challenge.userAnswer) ? challenge.userAnswer : [];
    return picked.map((i) => challenge.images?.[i] ?? '').join(' ').trim();
  }
  return challenge.userAnswer === undefined || challenge.userAnswer === null
    ? '—'
    : String(challenge.userAnswer);
}

export function typeLabel(type: ChallengeType): string {
  switch (type) {
    case 'image':
      return 'Image grid';
    case 'math':
      return 'Math';
    case 'text':
      return 'Text';
  }
}
