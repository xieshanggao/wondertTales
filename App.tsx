import React, { useState, useEffect, useRef } from 'react';
import { AppView, Story, UserProgress, StoryPage } from './types';
import { generateStoryContent, generateStoryImage, generateSpeech } from './services/geminiService';
import { decode, decodeAudioData } from './services/audioUtils';
import { Button } from './components/Button';
import { ProgressBar } from './components/ProgressBar';
import { StoryCard } from './components/StoryCard';
import { BookOpen, Star, Home, Volume2, ArrowRight, Check, RefreshCcw, Plus, Award } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';

const STORAGE_KEY_PROGRESS = 'wondertales_progress';
const STORAGE_KEY_STORIES = 'wondertales_stories';

function App() {
  // --- State ---
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [stories, setStories] = useState<Story[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    booksRead: 0,
    streakDays: 0,
    lastReadDate: '',
    totalQuizzesTaken: 0,
    totalCorrectAnswers: 0,
    recentStories: []
  });
  
  // Create Story State
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Reading State
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Quiz State
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Load data on mount
    const storedProgress = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (storedProgress) setProgress(JSON.parse(storedProgress));

    const storedStories = localStorage.getItem(STORAGE_KEY_STORIES);
    if (storedStories) setStories(JSON.parse(storedStories));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(stories));
  }, [stories]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // --- Actions ---

  const handleCreateStory = async () => {
    if (!topicInput.trim()) return;
    setIsGenerating(true);
    try {
      const content = await generateStoryContent(topicInput);
      const newStory: Story = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        isCompleted: false,
        ...content
      };
      
      setStories(prev => [newStory, ...prev]);
      setCurrentStory(newStory);
      setCurrentPageIndex(0);
      setTopicInput('');
      setView(AppView.READING);
      
      // Pre-fetch the first image
      loadImageForPage(newStory, 0);
    } catch (error) {
      console.error("Failed to generate story", error);
      alert("Oh no! The story machine is taking a nap. Try again!");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadImageForPage = async (story: Story, index: number) => {
    if (!story.pages[index] || story.pages[index].imageUrl) return;

    setIsLoadingImage(true);
    try {
      const imageUrl = await generateStoryImage(story.pages[index].imagePrompt);
      
      // Update story in state and storage
      const updatedStory = { ...story };
      updatedStory.pages[index].imageUrl = imageUrl;
      
      setStories(prev => prev.map(s => s.id === story.id ? updatedStory : s));
      if (currentStory?.id === story.id) {
        setCurrentStory(updatedStory);
      }
    } catch (error) {
      console.error("Failed to load image", error);
    } finally {
      setIsLoadingImage(false);
    }
  };

  const playAudioForPage = async (text: string) => {
    if (isPlayingAudio) {
      audioSourceRef.current?.stop();
      setIsPlayingAudio(false);
      return;
    }

    setIsLoadingAudio(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Check if we already have audio cached for this page (omitted for simplicity, doing fresh gen mostly)
      // In a real app, we'd cache the base64 in the StoryPage object like we do for images.
      
      const base64Audio = await generateSpeech(text);
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingAudio(false);
      source.start();
      
      audioSourceRef.current = source;
      setIsPlayingAudio(true);

    } catch (error) {
      console.error("Audio failed", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleNextPage = () => {
    if (!currentStory) return;
    
    // Stop audio if playing
    if (isPlayingAudio) {
      audioSourceRef.current?.stop();
      setIsPlayingAudio(false);
    }

    if (currentPageIndex < currentStory.pages.length - 1) {
      const nextIndex = currentPageIndex + 1;
      setCurrentPageIndex(nextIndex);
      // Lazy load image for next page
      loadImageForPage(currentStory, nextIndex);
    } else {
      setView(AppView.QUIZ);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      if (isPlayingAudio) {
        audioSourceRef.current?.stop();
        setIsPlayingAudio(false);
      }
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const handleQuizSubmit = () => {
    if (!currentStory || quizSelectedOption === null) return;
    
    setQuizSubmitted(true);
    
    const isCorrect = quizSelectedOption === currentStory.quiz.correctAnswerIndex;
    
    // Update stats
    const today = new Date().toISOString().split('T')[0];
    const lastRead = progress.lastReadDate.split('T')[0];
    
    let newStreak = progress.streakDays;
    if (today !== lastRead) {
       // Simple streak logic: if last read was yesterday, increment. Else reset to 1.
       // For demo, just increment if it's a new day.
       newStreak += 1;
    }

    const updatedProgress = {
      ...progress,
      booksRead: progress.booksRead + (isCorrect ? 1 : 0), // Only count if quiz passed? Or count anyway? Let's count anyway but track stats.
      streakDays: newStreak,
      lastReadDate: new Date().toISOString(),
      totalQuizzesTaken: progress.totalQuizzesTaken + 1,
      totalCorrectAnswers: progress.totalCorrectAnswers + (isCorrect ? 1 : 0),
    };
    
    setProgress(updatedProgress);

    // Mark story as completed
    const updatedStory = { ...currentStory, isCompleted: true };
    setStories(prev => prev.map(s => s.id === updatedStory.id ? updatedStory : s));
  };

  const exitToDashboard = () => {
    setView(AppView.DASHBOARD);
    setCurrentStory(null);
    setQuizSubmitted(false);
    setQuizSelectedOption(null);
    setIsPlayingAudio(false);
    audioSourceRef.current?.stop();
  };

  // --- Render Views ---

  const renderDashboard = () => (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">WonderTales</h1>
          <p className="text-slate-500">Welcome back, Little Explorer!</p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full border-2 border-yellow-300">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <span className="font-bold text-yellow-700">{progress.streakDays} Day Streak</span>
        </div>
      </header>

      {/* Progress Section */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Award className="text-purple-500" />
          Your Learning Journey
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <ProgressBar current={progress.booksRead} total={progress.booksRead + 5} label="Books Read" colorClass="bg-sky-400" />
            <ProgressBar current={progress.totalCorrectAnswers} total={progress.totalQuizzesTaken || 1} label="Quiz Score" colorClass="bg-green-400" />
          </div>
          <div className="h-40 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Books', value: progress.booksRead },
                  { name: 'Correct', value: progress.totalCorrectAnswers },
                  { name: 'Quizzes', value: progress.totalQuizzesTaken }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                    {
                      [0,1,2].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#38bdf8', '#4ade80', '#c084fc'][index]} />
                      ))
                    }
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Create New Story Action */}
      <section>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-indigo-200">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black mb-2">Create a New Adventure!</h2>
            <p className="opacity-90">What do you want to read about today?</p>
          </div>
          <Button 
            variant="secondary" 
            size="lg" 
            onClick={() => setView(AppView.CREATE_STORY)}
            className="whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Make a Story
          </Button>
        </div>
      </section>

      {/* Library */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4">My Library</h2>
        {stories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No stories yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map(story => (
              <StoryCard 
                key={story.id} 
                story={story} 
                onClick={() => {
                  setCurrentStory(story);
                  setCurrentPageIndex(0);
                  setView(AppView.READING);
                  loadImageForPage(story, 0); // Preload first page if needed
                }} 
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderCreateStory = () => (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-slate-800">Magic Story Maker</h1>
        <p className="text-lg text-slate-600">Type a topic, and I'll write a book just for you!</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-indigo-100 space-y-6">
        <textarea
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="e.g., A brave astronaut cat who loves pizza..."
          className="w-full p-6 text-xl rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all min-h-[150px] resize-none"
          disabled={isGenerating}
        />
        
        <div className="flex gap-4 justify-center">
          <Button 
            variant="ghost" 
            onClick={() => setView(AppView.DASHBOARD)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            size="lg" 
            onClick={handleCreateStory}
            disabled={!topicInput.trim() || isGenerating}
            isLoading={isGenerating}
            className="w-48"
          >
            Create Story!
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm text-slate-400">
        <div>🚀 Imagination</div>
        <div>🎨 Beautiful Pictures</div>
        <div>🔊 Read Aloud</div>
      </div>
    </div>
  );

  const renderReading = () => {
    if (!currentStory) return null;
    const page = currentStory.pages[currentPageIndex];

    return (
      <div className="max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-4">
          <Button variant="ghost" size="sm" onClick={exitToDashboard}>
            <Home className="w-5 h-5 mr-2" /> Home
          </Button>
          <span className="font-bold text-slate-500">
            Page {currentPageIndex + 1} of {currentStory.pages.length}
          </span>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        {/* Book Content */}
        <div className="flex-1 bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800 flex flex-col md:flex-row relative">
          {/* Image Side */}
          <div className="w-full md:w-1/2 bg-slate-100 relative flex items-center justify-center border-b-4 md:border-b-0 md:border-r-4 border-slate-200">
            {page.imageUrl ? (
              <img src={page.imageUrl} alt="Story illustration" className="w-full h-full object-cover" />
            ) : isLoadingImage ? (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-20 h-20 bg-slate-300 rounded-full"></div>
                <p className="text-slate-400 font-bold">Painting the picture...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                 <p className="text-slate-400">Image not loaded</p>
                 <Button size="sm" variant="secondary" onClick={() => loadImageForPage(currentStory, currentPageIndex)}>Retry Load</Button>
              </div>
            )}
          </div>

          {/* Text Side */}
          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-[#fffcf5]">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed mb-8 font-serif">
              {page.text}
            </h2>

            <div className="mt-auto flex items-center justify-between">
              <Button 
                variant={isPlayingAudio ? "accent" : "secondary"} 
                onClick={() => playAudioForPage(page.text)}
                className="rounded-full w-16 h-16 !p-0 flex items-center justify-center"
                disabled={isLoadingAudio}
              >
                {isLoadingAudio ? (
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Volume2 className={`w-8 h-8 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                )}
              </Button>

              <div className="flex gap-4">
                <Button 
                  variant="ghost" 
                  onClick={handlePrevPage} 
                  disabled={currentPageIndex === 0}
                >
                  Back
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleNextPage}
                >
                  {currentPageIndex === currentStory.pages.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!currentStory) return null;
    const { quiz } = currentStory;
    const isCorrect = quizSelectedOption === quiz.correctAnswerIndex;

    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-[2rem] shadow-xl border-b-8 border-purple-200 overflow-hidden">
          <div className="bg-purple-500 p-8 text-center">
            <h2 className="text-3xl font-black text-white mb-2">Quiz Time!</h2>
            <p className="text-purple-100">Did you read carefully?</p>
          </div>

          <div className="p-8 space-y-8">
            <h3 className="text-2xl font-bold text-slate-800 text-center">
              {quiz.question}
            </h3>

            <div className="space-y-4">
              {quiz.options.map((option, idx) => {
                let btnClass = "w-full text-left p-6 rounded-2xl border-2 text-lg font-bold transition-all ";
                
                if (quizSubmitted) {
                  if (idx === quiz.correctAnswerIndex) {
                    btnClass += "bg-green-100 border-green-500 text-green-700";
                  } else if (idx === quizSelectedOption) {
                    btnClass += "bg-red-50 border-red-300 text-red-400 opacity-50";
                  } else {
                    btnClass += "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                  }
                } else {
                  btnClass += quizSelectedOption === idx 
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md scale-[1.02]" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => !quizSubmitted && setQuizSelectedOption(idx)}
                    disabled={quizSubmitted}
                    className={btnClass}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {quizSubmitted && idx === quiz.correctAnswerIndex && (
                        <CheckCircleIcon />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {!quizSubmitted ? (
              <Button 
                variant="primary" 
                size="lg" 
                className="w-full py-4 text-xl"
                disabled={quizSelectedOption === null}
                onClick={handleQuizSubmit}
              >
                Check Answer
              </Button>
            ) : (
              <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`text-2xl font-black ${isCorrect ? 'text-green-500' : 'text-orange-500'}`}>
                  {isCorrect ? "🎉 Awesome job!" : "Nice try!"}
                </div>
                <Button variant="primary" onClick={exitToDashboard}>
                  Back to Library
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f0f9ff] p-4 md:p-6 font-sans">
      {view === AppView.DASHBOARD && renderDashboard()}
      {view === AppView.CREATE_STORY && renderCreateStory()}
      {view === AppView.READING && renderReading()}
      {view === AppView.QUIZ && renderQuiz()}
    </div>
  );
}

const CheckCircleIcon = () => (
  <div className="bg-green-500 rounded-full p-1">
    <Check className="w-4 h-4 text-white" strokeWidth={4} />
  </div>
);

export default App;
