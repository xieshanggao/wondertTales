import React from 'react';
import { Story } from '../types';
import { BookOpen, CheckCircle } from 'lucide-react';

interface StoryCardProps {
  story: Story;
  onClick: () => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-3xl p-4 shadow-md hover:shadow-xl transition-all cursor-pointer border-2 border-slate-100 hover:border-sky-300 flex flex-col h-full"
    >
      <div className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-sm">
        {story.isCompleted ? (
          <CheckCircle className="w-8 h-8 text-green-500 fill-green-100" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center">
             <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>
      
      <div className="h-32 bg-sky-50 rounded-2xl mb-4 overflow-hidden flex items-center justify-center text-6xl">
         {/* If the first page has an image, show it, otherwise show emoji */}
         {story.pages[0].imageUrl ? (
             <img src={story.pages[0].imageUrl} alt="cover" className="w-full h-full object-cover" />
         ) : (
             <span>📖</span>
         )}
      </div>
      
      <h3 className="font-bold text-lg text-slate-800 mb-2 leading-tight group-hover:text-sky-600">
        {story.title}
      </h3>
      <p className="text-sm text-slate-500 mt-auto">
        {new Date(story.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
};
