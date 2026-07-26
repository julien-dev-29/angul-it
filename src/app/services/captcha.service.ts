import { Injectable, signal, computed } from '@angular/core';
import {
    Challenge,
    ChallengeType,
    EmojiGridChallenge,
    MathChallenge,
    TextChallenge,
    StageResult,
    CaptchaState,
} from '../models/captcha.models';

const STORAGE_KEY = 'captchaState';

const EMOJI_POOLS: { category: string; emojis: string[][] }[] = [
    {
        category: 'animals',
        emojis: [
            ['🐶', '🐱', '🐭', '🐹'],
            ['🐰', '🦊', '🐻', '🐼'],
            ['🐨', '🐯', '🦁', '🐮'],
            ['🐷', '🐸', '🐵', '🐔'],
        ],
    },
    {
        category: 'food',
        emojis: [
            ['🍎', '🍐', '🍊', '🍋'],
            ['🍌', '🍉', '🍇', '🍓'],
            ['🫐', '🍈', '🍒', '🍑'],
            ['🥭', '🍍', '🥝', '🍅'],
        ],
    },
    {
        category: 'objects',
        emojis: [
            ['⚽', '🏀', '🏈', '⚾'],
            ['🎾', '🏐', '🏉', '🎱'],
            ['🏓', '🏸', '🥊', '🎯'],
            ['⛳', '🏹', '🎣', '🛶'],
        ],
    },
];

const MATH_PROBLEMS: Omit<MathChallenge, 'options'>[] = [
    { type: 'math', prompt: '7 + 5 = ?', answer: 12 },
    { type: 'math', prompt: '15 - 8 = ?', answer: 7 },
    { type: 'math', prompt: '6 × 4 = ?', answer: 24 },
    { type: 'math', prompt: '20 - 9 = ?', answer: 11 },
    { type: 'math', prompt: '3 + 9 = ?', answer: 12 },
    { type: 'math', prompt: '5 × 3 = ?', answer: 15 },
    { type: 'math', prompt: '18 - 7 = ?', answer: 11 },
    { type: 'math', prompt: '4 × 6 = ?', answer: 24 },
];

const TEXT_WORDS = [
    'captcha', 'angular', 'bridge', 'guitar', 'planet',
    'forest', 'rocket', 'puzzle', 'breeze', 'marble',
    'crystal', 'shadow', 'velvet', 'thunder', 'lantern',
];

@Injectable({ providedIn: 'root' })
export class CaptchaService {
    readonly currentStage = signal(1);
    readonly challenges = signal<Challenge[]>([]);
    readonly results = signal<StageResult[]>([]);

    readonly isComplete = computed(() => this.results().length === 3);

    readonly currentChallenge = computed<Challenge | null>(() => {
        const stage = this.currentStage();
        const all = this.challenges();
        if (stage < 1 || stage > all.length) return null;
        return all[stage - 1];
    });

    constructor() {
        this.restore();
        if (this.challenges().length === 0) {
            this.generateChallenges();
        }
    }

    submitStage(userAnswer: unknown): void {
        const challenge = this.currentChallenge();
        if (!challenge) return;

        const passed = this.validateAnswer(challenge, userAnswer);
        const result: StageResult = {
            stage: this.currentStage(),
            type: challenge.type,
            passed,
            userAnswer,
        };

        this.results.update(r => [...r, result]);

        if (this.currentStage() < 3) {
            this.currentStage.update(s => s + 1);
        }
        this.persist()
    }

    goToPreviousStage(): void {
        if (this.currentStage() > 1) {
            this.currentStage.update(s => s - 1);
        }
    }

    reset(): void {
        this.currentStage.set(1);
        this.challenges.set([]);
        this.results.set([]);
        localStorage.removeItem(STORAGE_KEY);
        this.generateChallenges();
    }

    hasPersistedState(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    private validateAnswer(challenge: Challenge, userAnswer: unknown): boolean {
        switch (challenge.type) {
            case 'emoji': {
                const correct = new Set(challenge.correctAnswers);
                const user = userAnswer as number[];
                if (!Array.isArray(user) || user.length !== correct.size) return false;
                return user.every(i => correct.has(i));
            }
            case 'math':
                return userAnswer === challenge.answer;
            case 'text':
                return (
                    typeof userAnswer === 'string' &&
                    userAnswer.toLowerCase() === challenge.displayWord.toLowerCase()
                );
        }
    }

    private generateChallenges(): void {
        const shuffledTypes: ChallengeType[] = ['emoji', 'math', 'text'].sort(
            () => Math.random() - 0.5,
        ) as ChallengeType[];

        const challenges: Challenge[] = shuffledTypes.map(type => {
            switch (type) {
                case 'emoji':
                    return this.generateEmojiChallenge();
                case 'math':
                    return this.generateMathChallenge();
                case 'text':
                    return this.generateTextChallenge();
            }
        });

        this.challenges.set(challenges);
    }

    private generateEmojiChallenge(): EmojiGridChallenge {
        const pool = EMOJI_POOLS[Math.floor(Math.random() * EMOJI_POOLS.length)];
        const correctIndices: number[] = [];
        const usedRows = new Set<number>();

        // Pick 2-3 random rows as correct answers
        const numRows = 2 + Math.floor(Math.random() * 2);
        while (correctIndices.length < numRows) {
            const row = Math.floor(Math.random() * 4);
            if (!usedRows.has(row)) {
                usedRows.add(row);
                for (let col = 0; col < 4; col++) {
                    correctIndices.push(row * 4 + col);
                }
            }
        }

        return {
            type: 'emoji',
            prompt: `Select all ${pool.category}`,
            grid: pool.emojis,
            correctAnswers: correctIndices.sort((a, b) => a - b),
        };
    }

    private generateMathChallenge(): MathChallenge {
        const base = MATH_PROBLEMS[Math.floor(Math.random() * MATH_PROBLEMS.length)];
        const options = new Set<number>([base.answer]);

        while (options.size < 4) {
            const offset = Math.floor(Math.random() * 10) - 5;
            const wrong = base.answer + offset;
            if (wrong !== base.answer && wrong > 0) {
                options.add(wrong);
            }
        }

        return {
            ...base,
            options: Array.from(options).sort(() => Math.random() - 0.5),
        };
    }

    private generateTextChallenge(): TextChallenge {
        const word = TEXT_WORDS[Math.floor(Math.random() * TEXT_WORDS.length)];
        return {
            type: 'text',
            prompt: 'Type the word shown below',
            displayWord: word,
        };
    }

    private persist(): void {
        const state: CaptchaState = {
            currentStage: this.currentStage(),
            challenges: this.challenges(),
            results: this.results(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    private restore(): void {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        try {
            const state: CaptchaState = JSON.parse(raw);
            if (state.challenges?.length === 3) {
                this.challenges.set(state.challenges);
                this.results.set(state.results || []);
                this.currentStage.set(state.currentStage || 1);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}