
import React, { useState, useEffect } from 'react';
import { WordDetail, SavedWord } from '../types';

interface WordDetailCardProps {
  data: WordDetail | SavedWord;
  onUpdatePractice?: (sentence: string) => void;
}

const WordDetailCard: React.FC<WordDetailCardProps> = ({ data, onUpdatePractice }) => {
  // Safety check for data
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
      console.error("Failed to save practice", e);
    } finally {
      setIsSaving(false);
    }
  };

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
        {data.examples && data.examples.map((ex, idx) => (
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

        {/* Practice: 6th Sentence Section */}
        <div className="mt-8 pt-6 border-t border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-lightbulb text-[10px] text-amber-600"></i>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Practice: My Own Context</span>
            </div>
            {!isEditing && onUpdatePractice && (
              <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest">Edit</button>
            )}
          </div>

          {isEditing && onUpdatePractice ? (
            <div className="space-y-3 animate-in fade-in zoom-in-95">
              <textarea 
                value={practiceText}
                onChange={(e) => setPracticeText(e.target.value)}
                placeholder="어떻게 사용하면 내 일상에 도움이 될까요? 나만의 예문을 적어보세요."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:border-indigo-500 outline-none min-h-[100px] resize-none transition-all"
              />
              <button 
                onClick={handleSave}
                disabled={isSaving || !practiceText.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                Save My Practice
              </button>
            </div>
          ) : (
            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-5 relative group animate-in slide-in-from-top-2">
              <div className="absolute -top-2.5 -left-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-1 rounded-md shadow-sm uppercase tracking-tighter">You</div>
              <p className="text-indigo-900 text-[16px] font-bold leading-relaxed">
                {practiceText || "아직 나만의 예문이 없습니다."}
              </p>
              {!onUpdatePractice && !practiceText && (
                <p className="text-slate-400 text-xs italic mt-2">단어장 탭에서 자신만의 예문을 추가할 수 있습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordDetailCard;
