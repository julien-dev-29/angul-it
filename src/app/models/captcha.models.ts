export type ChallengeType = 'emoji' | 'math' | 'text';

export interface EmojiGridChallenge {
    type: 'emoji';
    prompt: string;
    grid: string[][];
    correctAnswers: number[];
}

export interface MathChallenge {
    type: 'math';
    prompt: string;
    answer: number;
    options: number[];
}

export interface TextChallenge {
    type: 'text';
    prompt: string;
    displayWord: string;
}

export type Challenge = EmojiGridChallenge | MathChallenge | TextChallenge;

export interface StageResult {
    stage: number;
    type: ChallengeType;
    passed: boolean;
    userAnswer: unknown;
}

export interface CaptchaState {
    currentStage: number;
    challenges: Challenge[];
    results: StageResult[];
}