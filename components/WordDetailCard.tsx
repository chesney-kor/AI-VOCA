
import React, { useState, useEffect } from 'react';
import { WordDetail, SavedWord } from '../types';
import { playSpeech, cacheSpeech } from '../services/geminiService';
import { getCachedAudio } from '../services/audioCacheService';

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
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());

  // 데이터 로드 시 백그라운드 캐싱 트리거
  useEffect(() => {
    const prefetch = async () => {
      const mainText = `The word is ${data.word}. The nuance is: ${data.nuance}`;
      // 캐시 존재 여부 확인
      const checkCache = async (text: string, id: string) => {
        const key = `tts_${text.slice(0, 50)}_${text.length}`;
        const data = await getCachedAudio(key);
        if (data) setCachedKeys(prev => new Set(prev).add(id));
        return !!data;
      };

      await checkCache(mainText, 'main-word');
      
      // 메인 단어 캐싱 시도
      await cacheSpeech(mainText);
      setCachedKeys(prev => new Set(prev).add('main-word'));

      // 첫 번째 예문도 미리 캐싱
      if (data.examples && data.examples[0]) {
        await checkCache(data.examples[0].sentence, 'ex-0');
        await cacheSpeech(data.examples[0].sentence);
        setCachedKeys(prev => new Set(prev).add('ex-0'));
      }
    };

    prefetch();
    setPracticeText((data as SavedWord).userSentence || "");
    setIsEditing(!((data as SavedWord).userSentence));
  }, [data]);

  const handlePlay = async (text: string, id: string) => {
    if (playingId || generatingId) return;
    
    try {
      setPlayingId(id);
      await playSpeech(text, () => {
        setGeneratingId(id);
      });
      // 성공적으로 재생/생성 후 캐시 상태 업데이트
      setCachedKeys(prev => new Set(prev).add(id));
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
              cachedKeys.has('main-word') ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-white text-slate-300'
            }`}
          >
            <i className={`fa-solid ${
              generatingId === 'main-word' ? 'fa-wand-magic-sparkles' : 
              playingId === 'main-word' ? 'fa-volume-high' : 
              cachedKeys.has('main-word') ? 'fa-volume-low' : 'fa-volume-xmark opacity-30'
            }`}></i>
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
          const isCached = cachedKeys.has(`ex-${idx}`);
          
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
                    isCached ? 'text-indigo-400' : 'text-slate-200 hover:text-indigo-300'
                  }`}
                >
                  <i className={`fa-solid ${
                    isGenerating ? 'fa-arrows-rotate' : 
                    isPlaying ? 'fa-circle-play' : 
                    isCached ? 'fa-volume-low text-[10px]' : 'fa-volume-xmark text-[10px] opacity-20'
                  }`}></i>
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
                      cachedKeys.has('user-practice') ? 'text-indigo-500' : 'text-slate-300'
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
