import {
  IMAGE_CATEGORIES,
  WORD_POOL,
  buildImageChallenge,
  buildMathChallenge,
  buildSession,
  buildTextChallenge,
  describeUserAnswer,
  isCorrect,
  shuffle,
} from './challenge-generator';

function questionToMathAnswer(question: string): number {
  const m = question.match(/What is (\d+) ([+\-−×]) (\d+)\?$/);
  if (!m) throw new Error('bad math question: ' + question);
  const a = Number(m[1]);
  const b = Number(m[3]);
  const op = m[2];
  return op === '+' ? a + b : op === '−' ? a - b : a * b;
}

describe('challenge-generator', () => {
  describe('buildSession', () => {
    it('creates 4 challenges with all 3 types present', () => {
      for (let i = 0; i < 20; i++) {
        const session = buildSession(1000 + i);
        expect(session.challenges.length).toBe(4);
        const types = new Set(session.challenges.map((c) => c.type));
        expect(types.has('image')).toBe(true);
        expect(types.has('math')).toBe(true);
        expect(types.has('text')).toBe(true);
        expect(session.currentIndex).toBe(0);
        expect(session.maxIndex).toBe(0);
        expect(session.completed).toBe(false);
        expect(session.startedAt).toBe(1000 + i);
        const ids = session.challenges.map((c) => c.id);
        expect(new Set(ids).size).toBe(4);
        expect(Math.min(...ids)).toBe(0);
      }
    });

    it('shuffles stage order across sessions', () => {
      const signatures = new Set<string>();
      for (let i = 0; i < 30; i++) {
        signatures.add(buildSession(i).challenges.map((c) => c.type).join(','));
      }
      expect(signatures.size).toBeGreaterThan(1);
    });

    it('builds consistent image challenges', () => {
      for (let i = 0; i < 30; i++) {
        const c = buildImageChallenge(0);
        expect(c.images?.length).toBe(9);
        expect(IMAGE_CATEGORIES.some((cat) => cat.category === c.category)).toBe(true);
        const answer = c.answer as number[];
        expect(answer.length).toBeGreaterThanOrEqual(2);
        expect(answer.length).toBeLessThanOrEqual(4);
        answer.forEach((idx) => expect(idx).toBeGreaterThanOrEqual(0));
        answer.forEach((idx) => expect(idx).toBeLessThan(9));
        expect(new Set(answer).size).toBe(answer.length);
      }
    });

    it('builds self-consistent math challenges', () => {
      let sawSubtraction = false;
      for (let i = 0; i < 60; i++) {
        const c = buildMathChallenge(0);
        const expected = questionToMathAnswer(c.question);
        expect(c.answer).toBe(expected);
        if (c.question.includes('−')) {
          sawSubtraction = true;
          expect(c.answer as number).toBeGreaterThanOrEqual(0);
        }
      }
      expect(sawSubtraction).toBe(true);
    });

    it('builds text challenges from the word pool', () => {
      for (let i = 0; i < 20; i++) {
        const c = buildTextChallenge(0);
        expect(WORD_POOL).toContain(c.answer);
        expect(c.question).toContain(`"${c.answer as string}"`);
      }
    });
  });

  describe('shuffle', () => {
    it('returns a new array with the same elements', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const output = shuffle(input);
      expect(output).not.toBe(input);
      expect([...output].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('isCorrect', () => {
    it('image: exact set match, order-insensitive', () => {
      const challenge = { type: 'image', answer: [0, 3] } as never;
      expect(isCorrect(challenge, [0, 3])).toBe(true);
      expect(isCorrect(challenge, [3, 0])).toBe(true);
      expect(isCorrect(challenge, [0])).toBe(false);
      expect(isCorrect(challenge, [0, 1, 3])).toBe(false);
      expect(isCorrect(challenge, [])).toBe(false);
    });

    it('math: numeric string or number', () => {
      const challenge = { type: 'math', answer: 15 } as never;
      expect(isCorrect(challenge, 15)).toBe(true);
      expect(isCorrect(challenge, '15')).toBe(true);
      expect(isCorrect(challenge, ' 15 ')).toBe(true);
      expect(isCorrect(challenge, '15 ')).toBe(true);
      expect(isCorrect(challenge, '16')).toBe(false);
      expect(isCorrect(challenge, 'abc')).toBe(false);
      expect(isCorrect(challenge, '')).toBe(false);
    });

    it('text: trimmed, case-insensitive', () => {
      const challenge = { type: 'text', answer: 'angular' } as never;
      expect(isCorrect(challenge, 'angular')).toBe(true);
      expect(isCorrect(challenge, '  Angular ')).toBe(true);
      expect(isCorrect(challenge, 'other')).toBe(false);
      expect(isCorrect(challenge, '')).toBe(false);
    });
  });

  describe('describeUserAnswer', () => {
    it('joins selected image tiles as emoji', () => {
      const challenge = { type: 'image', images: ['🐱', '🐶', '🐱'], answer: [0, 2], userAnswer: [2, 0] } as never;
      expect(describeUserAnswer(challenge)).toBe('🐱 🐱');
    });

    it('returns primitives as-is for math and text', () => {
      expect(describeUserAnswer({ type: 'math', answer: 5, userAnswer: 5 } as never)).toBe('5');
      expect(describeUserAnswer({ type: 'text', answer: 'x', userAnswer: 'X' } as never)).toBe('X');
      expect(describeUserAnswer({ type: 'text', answer: 'x' } as never)).toBe('—');
    });
  });
});
