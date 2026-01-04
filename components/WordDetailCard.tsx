
import React from 'react';
import { WordDetail } from '../types';

interface WordDetailCardProps {
  data: WordDetail;
}

const WordDetailCard: React.FC<WordDetailCardProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-indigo-50/30 to-white">
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-3xl font-black text-indigo-700 uppercase tracking-tighter">{data.word}</h2>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100 shadow-sm">
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Nuance</span>
          <p className="text-slate-800 text-[15px] font-bold leading-relaxed">{data.nuance}</p>
        </div>
      </div>
      
      <div className="p-6 space-y-6 bg-white">
        {data.examples.map((ex, idx) => (
          <div key={idx} className="group">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-black text-slate-300 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{ex.category.split('(')[0].trim()}</span>
              <div className="h-[1px] flex-1 bg-slate-50 group-hover:bg-indigo-50 transition-colors"></div>
            </div>
            <p className="text-slate-900 text-[16px] font-bold leading-snug mb-1.5 group-hover:text-indigo-900 transition-colors">
              {ex.sentence}
            </p>
            {ex.explanation && (
              <p className="text-slate-500 text-[13px] font-medium leading-relaxed bg-slate-50 px-3 py-1.5 rounded-xl inline-block border border-slate-100">
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
