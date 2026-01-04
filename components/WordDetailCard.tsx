
import React from 'react';
import { WordDetail } from '../types';

interface WordDetailCardProps {
  data: WordDetail;
}

const WordDetailCard: React.FC<WordDetailCardProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white">
        <h2 className="text-2xl font-black text-indigo-700 mb-2 uppercase tracking-tight">{data.word}</h2>
        <div className="inline-flex items-center gap-2 bg-indigo-600/5 px-3 py-1.5 rounded-full">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Nuance</span>
          <p className="text-slate-800 text-sm font-semibold leading-relaxed">
            {data.nuance}
          </p>
        </div>
      </div>
      
      <div className="p-5 space-y-5">
        {data.examples.map((ex, idx) => (
          <div key={idx} className="relative pl-4 border-l-2 border-slate-100 hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ex.category.split('(')[0].trim()}</span>
            </div>
            <p className="text-slate-900 text-[15px] font-bold leading-snug mb-1">
              {ex.sentence}
            </p>
            {ex.explanation && (
              <p className="text-slate-500 text-xs font-medium bg-slate-50 inline-block px-1.5 py-0.5 rounded">
                {ex.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordDetailCard;
