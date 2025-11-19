export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface Quiz {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string; // Populated after generation
  audioData?: string; // Base64 audio data, populated after generation
}

export interface Story {
  id: string;
  title: string;
  topic: string;
  createdAt: number;
  pages: StoryPage[];
  quiz: Quiz;
  isCompleted: boolean;
}

export interface UserProgress {
  booksRead: number;
  streakDays: number;
  lastReadDate: string; // ISO date string
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
  recentStories: Story[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CREATE_STORY = 'CREATE_STORY',
  READING = 'READING',
  QUIZ = 'QUIZ',
}
