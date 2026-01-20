
import React, { useState, useEffect } from 'react';
import { WordDetail, SavedWord } from '../types';
import { playSpeech } from '../services/geminiService';

interface WordDetailCardProps {
  data: WordDetail | SavedWord;
  onUpdatePractice?: (sentence: string) => void;
}

const WordDetailCard: React.FC<WordDetailCardProps> = ({ data, onUpdatePractice }) => {
  if (!data || !data.word) return null;

  const [practiceText, setPracticeText] = useState((data as SavedWord).userSentence || "");
  const [isEditing, setIsEditing] = useState(!((data as SavedWord).userSentence));
  const [isSaving, setIsSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    setPracticeText((data as SavedWord).userSentence || "");
    setIsEditing(!((data as SavedWord).userSentence));
  }, [data]);

  const handlePlay = async (text: string, id: string) => {
    if (playingId || generatingId) return;
    
    try {
      setPlayingId(id);
      await playSpeech(text, () => {
        // If it starts generating (not in cache), update state
        setGeneratingId(id);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setPlayingId(null);
      setGeneratingId(null);
    }
  };

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

  const isAnyActionActive = !!playingId || !!generatingId;

  return (
    <div className="bg-white rounded-[2rem] shadow-lg border border-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50/20 to-white">
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-2xl font-black text-indigo-700 uppercase tracking-tighter">{data.word}</h2>
          <button 
            onClick={() => handlePlay(`The word is ${data.word}. The nuance is: ${data.nuance}`, 'main-word')}
            disabled={isAnyActionActive}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
              generatingId === 'main-word' ? 'bg-amber-500 text-white animate-bounce' : 
              playingId === 'main-word' ? 'bg-indigo-600 text-white animate-pulse' : 
              'bg-white text-indigo-500'
            }`}
          >
            <i className={`fa-solid ${generatingId === 'main-word' ? 'fa-wand-magic-sparkles' : playingId === 'main-word' ? 'fa-volume-high' : 'fa-volume-low'}`}></i>
          </button>
        </div>
        <div className="bg-white/80 p-3.5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
          {generatingId === 'main-word' && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400 animate-pulse"></div>}
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Nuance</span>
          <p className="text-slate-800 text-[14px] font-bold leading-relaxed">{data.nuance}</p>
        </div>
      </div>
      
      <div className="p-5 space-y-5 bg-white">
        {data.examples && data.examples.map((ex, idx) => {
          const isGenerating = generatingId === `ex-${idx}`;
          const isPlaying = playingId === `ex-${idx}`;
          
          return (
            <div key={idx} className="group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{ex.category.split('(')[0].trim()}</span>
                <div className="h-[1px] flex-1 bg-slate-50"></div>
                <button 
                  onClick={() => handlePlay(ex.sentence, `ex-${idx}`)}
                  disabled={isAnyActionActive}
                  className={`p-1.5 rounded-lg transition-all ${
                    isGenerating ? 'text-amber-500 animate-spin' :
                    isPlaying ? 'text-indigo-600 animate-pulse' : 
                    'text-slate-300 hover:text-indigo-400 active:scale-90'
                  }`}
                >
                  <i className={`fa-solid ${isGenerating ? 'fa-arrows-rotate' : isPlaying ? 'fa-circle-play' : 'fa-volume-low text-[10px]'}`}></i>
                </button>
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
          );
        })}

        <div className="mt-4 pt-4 border-t border-dashed border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">My Context</span>
            {!isEditing && onUpdatePractice && (
              <div className="flex items-center gap-2">
                {practiceText && (
                  <button 
                    onClick={() => handlePlay(practiceText, 'user-practice')}
                    disabled={isAnyActionActive}
                    className={`text-[10px] transition-all ${
                      generatingId === 'user-practice' ? 'text-amber-500 animate-spin' :
                      playingId === 'user-practice' ? 'text-indigo-600 animate-pulse' : 
                      'text-slate-400'
                    }`}
                  >
                    <i className={`fa-solid ${generatingId === 'user-practice' ? 'fa-arrows-rotate' : 'fa-volume-low'}`}></i>
                  </button>
                )}
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Edit</button>
              </div>
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
