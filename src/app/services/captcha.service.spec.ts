import { TestBed } from '@angular/core/testing';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
    let service: CaptchaService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({});
        service = TestBed.inject(CaptchaService);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize with 3 challenges', () => {
        expect(service.challenges().length).toBe(3);
    });

    it('should initialize at stage 1', () => {
        expect(service.currentStage()).toBe(1);
    });

    it('should have empty results initially', () => {
        expect(service.results().length).toBe(0);
    });

    it('should not be complete initially', () => {
        expect(service.isComplete()).toBeFalsy();
    });

    it('should have one of each challenge type', () => {
        const types = service.challenges().map(c => c.type);
        expect(types).toContain('emoji');
        expect(types).toContain('math');
        expect(types).toContain('text');
    });

    it('should return current challenge for current stage', () => {
        const challenge = service.currentChallenge();
        expect(challenge).toBeTruthy();
        expect(challenge!.type).toBeDefined();
    });

    it('should submit a stage and advance', () => {
        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);
        expect(service.results().length).toBe(1);
        expect(service.results()[0].passed).toBeTruthy();
        expect(service.currentStage()).toBe(2);
    });

    it('should persist to localStorage after submit', () => {
        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);
        const stored = localStorage.getItem('captchaState');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.results.length).toBe(1);
    });

    it('should restore from localStorage on init', () => {
        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);

        // Create new service instance
        const newService = TestBed.inject(CaptchaService);
        expect(newService.results().length).toBe(1);
        expect(newService.currentStage()).toBe(2);
    });

    it('should go to previous stage', () => {
        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);
        expect(service.currentStage()).toBe(2);

        service.goToPreviousStage();
        expect(service.currentStage()).toBe(1);
    });

    it('should not go below stage 1', () => {
        service.goToPreviousStage();
        expect(service.currentStage()).toBe(1);
    });

    it('should mark as complete after 3 submissions', () => {
        for (let i = 0; i < 3; i++) {
            const challenge = service.currentChallenge()!;
            let userAnswer: unknown;

            if (challenge.type === 'emoji') {
                userAnswer = challenge.correctAnswers;
            } else if (challenge.type === 'math') {
                userAnswer = challenge.answer;
            } else {
                userAnswer = challenge.displayWord;
            }

            service.submitStage(userAnswer);
        }

        expect(service.isComplete()).toBeTruthy();
        expect(service.results().length).toBe(3);
    });

    it('should reset all state', () => {
        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);
        service.reset();

        expect(service.currentStage()).toBe(1);
        expect(service.results().length).toBe(0);
        expect(localStorage.getItem('captchaState')).toBeNull();
    });

    it('should record wrong answers as failed', () => {
        const challenge = service.currentChallenge()!;
        let wrongAnswer: unknown;

        if (challenge.type === 'emoji') {
            wrongAnswer = [-1];
        } else if (challenge.type === 'math') {
            wrongAnswer = -999;
        } else {
            wrongAnswer = 'definitely_wrong_answer_xyz';
        }

        service.submitStage(wrongAnswer);
        expect(service.results()[0].passed).toBeFalsy();
    });

    it('should report hasPersistedState correctly', () => {
        expect(service.hasPersistedState()).toBeFalsy();

        const challenge = service.currentChallenge()!;
        let userAnswer: unknown;

        if (challenge.type === 'emoji') {
            userAnswer = challenge.correctAnswers;
        } else if (challenge.type === 'math') {
            userAnswer = challenge.answer;
        } else {
            userAnswer = challenge.displayWord;
        }

        service.submitStage(userAnswer);
        expect(service.hasPersistedState()).toBeTruthy();
    });
});