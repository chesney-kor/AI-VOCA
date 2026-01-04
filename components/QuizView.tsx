
import React, { useState, useEffect, useCallback } from 'react';
import { generateQuiz } from '../services/geminiService';
import { QuizQuestion, SavedWord } from '../types';

interface QuizViewProps {
  savedWords: SavedWord[];
}

const QuizView: React.FC<QuizViewProps> = ({ savedWords }) => {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  const loadQuestion = useCallback(async () => {
    if (savedWords.length === 0) return;
    setLoading(true);
    setSelectedOption(null);
    setIsCorrect(null);
    try {
      const q = await generateQuiz(savedWords.map(w => w.word));
      setQuestion(q);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [savedWords]);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  const handleOptionClick = (option: string) => {
    if (selectedOption || !question) return;
    setSelectedOption(option);
    const correct = option.toLowerCase() === question.correctWord.toLowerCase();
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
  };

  if (savedWords.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl shadow-xl border border-slate-100 my-8">
        <div className="w-16 h-16 bg-amber-50 flex items-center justify-center rounded-2xl mb-4">
          <i className="fa-solid fa-lock text-2xl text-amber-500"></i>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Quiz is Locked</h3>
        <p className="text-sm text-slate-500 max-w-[240px]">
          Save at least 3 words to unlock the Quiz Master challenge.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 px-2 pb-32">
      <div className="flex justify-between items-end px-2">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Performance</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-indigo-600">{score}</span>
            <span className="text-xs font-bold text-slate-400">Points</span>
          </div>
        </div>
        <button 
          onClick={loadQuestion}
          disabled={loading}
          className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
          Skip
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-[13px] text-slate-400 font-bold uppercase tracking-widest">Crafting challenge...</p>
          </div>
        ) : question ? (
          <>
            <div className="mb-8">
              <div className="w-8 h-1 bg-slate-100 rounded-full mb-6"></div>
              <h3 className="text-xl font-bold text-slate-800 leading-[1.6]">
                {question.sentence.split('____').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="inline-block border-b-[3px] border-indigo-200 px-1 mx-1 text-indigo-600 font-black min-w-[60px] text-center">
                        {selectedOption || "?"}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {question.options.map((opt, idx) => {
                let statusClass = "bg-slate-50 border-slate-100 text-slate-700 active:bg-slate-100";
                if (selectedOption === opt) {
                  statusClass = isCorrect 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                    : "bg-rose-50 border-rose-500 text-rose-700";
                } else if (selectedOption && opt.toLowerCase() === question.correctWord.toLowerCase()) {
                  statusClass = "bg-emerald-50/50 border-emerald-200 text-emerald-600";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(opt)}
                    disabled={!!selectedOption}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-200 font-bold text-base flex justify-between items-center ${statusClass}`}
                  >
                    <span>{opt}</span>
                    {selectedOption === opt && (
                      <i className={`fa-solid ${isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedOption && (
              <div className="mt-8 animate-in fade-in slide-in-from-top-4">
                <div className={`p-4 rounded-2xl text-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white shadow-lg'}`}>
                  <p className="font-black text-sm uppercase tracking-widest mb-1">
                    {isCorrect ? "Mastered!" : "Learning Point"}
                  </p>
                  <p className="text-sm opacity-90 font-medium leading-relaxed">
                    {isCorrect ? "Perfect understanding of this word's context." : `The correct answer was "${question.correctWord}".`}
                  </p>
                </div>
                <button 
                  onClick={loadQuestion}
                  className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
                >
                  NEXT CHALLENGE
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-slate-400 font-bold py-10 uppercase tracking-widest">Failed to load challenge</p>
        )}
      </div>
    </div>
  );
};

export default QuizView;
