
import React, { useState, useEffect } from 'react';
import { WordDetail, SavedWord } from '../types';

interface WordDetailCardProps {
  data: WordDetail | SavedWord;
  onUpdatePractice?: (sentence: string) => void;
}

const WordDetailCard: React.FC<WordDetailCardProps> = ({ data, onUpdatePractice }) => {
  if (!data || !data.word) return null;

  const [practiceText, setPracticeText] = useState((data as SavedWord).userSentence || "");
  const [isEditing, setIsEditing] = useState(!((data as SavedWord).userSentence));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPracticeText((data as SavedWord).userSentence || "");
    setIsEditing(!((data as SavedWord).userSentence));
  }, [data]);

  const handleSave = async () => {
    if (!onUpdatePractice || !practiceText.trim()) return;
    setIsSaving(true);
    try {
      await onUpdatePractice(practiceText);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-lg border border-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50/20 to-white">
        <div className="flex flex-col mb-3">
          <h2 className="text-2xl font-black text-indigo-700 uppercase tracking-tighter">{data.word}</h2>
          <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">EFL Principles Applied</span>
        </div>
        <div className="bg-white/80 p-3.5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Nuance</span>
          <p className="text-slate-800 text-[14px] font-bold leading-relaxed">{data.nuance}</p>
        </div>
      </div>
      
      <div className="p-5 space-y-5 bg-white">
        {data.examples && data.examples.map((ex, idx) => (
          <div key={idx} className="group">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{ex.category.split('(')[0].trim()}</span>
              <div className="h-[1px] flex-1 bg-slate-50"></div>
            </div>
            <p className="text-slate-900 text-[15px] font-bold leading-snug mb-1">
              {ex.sentence}
            </p>
            {ex.explanation && (
              <p className="text-slate-500 text-[12px] font-medium leading-relaxed bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                {ex.explanation}
              </p>
            )}
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">My Practice</span>
            {!isEditing && onUpdatePractice && (
              <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-2 py-1 bg-indigo-50 rounded-md">Edit</button>
            )}
          </div>

          {isEditing && onUpdatePractice ? (
            <div className="space-y-2.5">
              <textarea 
                value={practiceText}
                onChange={(e) => setPracticeText(e.target.value)}
                placeholder="Write your own sentence here..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[14px] font-medium focus:border-indigo-500 outline-none min-h-[80px] resize-none"
              />
              <button 
                onClick={handleSave}
                disabled={isSaving || !practiceText.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                Save Practice
              </button>
            </div>
          ) : (
            <div className="bg-indigo-50/40 border border-indigo-100/40 rounded-xl p-4 relative group">
              <div className="absolute -top-2 -left-1.5 bg-indigo-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase">User</div>
              <p className="text-indigo-900 text-[15px] font-bold leading-relaxed">
                {practiceText || "No practice sentence yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordDetailCard;
