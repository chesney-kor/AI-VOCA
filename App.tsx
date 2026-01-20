
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, SavedWord, WordDetail } from './types';
import { getWordDetails } from './services/geminiService';
import * as db from './services/supabaseService';
import WordDetailCard from './components/WordDetailCard';
import QuizView from './components/QuizView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'list' | 'quiz'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<SavedWord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || "");
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || "");
  const [dbUserId, setDbUserId] = useState(localStorage.getItem('supabase_user_id') || "lexi_user_shared");

  const syncWithCloud = useCallback(async (localData: SavedWord[]) => {
    if (!db.isSupabaseConfigured()) return localData;
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    
    try {
      const cloudWords = await db.fetchWordsFromDB();
      
      // 서버 에러로 null이 오면 로컬 데이터 유지
      if (cloudWords === null) {
        setSyncStatus("Sync Failed");
        setTimeout(() => setSyncStatus(null), 3000);
        setIsSyncing(false);
        return localData;
      }

      const cloudWordNames = new Set(cloudWords.map(w => w.word.toLowerCase()));
      const localOnlyWords = localData.filter(w => !cloudWordNames.has(w.word.toLowerCase()));
      
      // 로컬에만 있는 단어가 있다면 클라우드에 업로드
      if (localOnlyWords.length > 0) {
        setSyncStatus(`Uploading ${localOnlyWords.length} words...`);
        await db.uploadLocalWords(localOnlyWords);
        const finalWords = await db.fetchWordsFromDB();
        setIsSyncing(false);
        setSyncStatus("Synced");
        setTimeout(() => setSyncStatus(null), 2000);
        return finalWords || localData;
      }
      
      setIsSyncing(false);
      setSyncStatus("Synced");
      setTimeout(() => setSyncStatus(null), 2000);
      return cloudWords.length > 0 ? cloudWords : localData;
    } catch (e) {
      console.error("Sync error:", e);
      setSyncStatus("Error");
      setTimeout(() => setSyncStatus(null), 3000);
      setIsSyncing(false);
      return localData;
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
      const storedMessages = localStorage.getItem('efl_chat_history');
      if (storedMessages) {
        try {
          const parsed = JSON.parse(storedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else {
            showWelcome();
          }
        } catch (e) { showWelcome(); }
      } else { showWelcome(); }

      let currentWords: SavedWord[] = [];
      const storedWords = localStorage.getItem('efl_lexicon_saved');
      if (storedWords) {
        try { currentWords = JSON.parse(storedWords); } catch (e) {}
      }
      
      if (db.isSupabaseConfigured()) {
        const syncedWords = await syncWithCloud(currentWords);
        setSavedWords(syncedWords);
      } else {
        setSavedWords(currentWords);
      }
    };
    initData();
  }, [syncWithCloud]);

  const showWelcome = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! 💡 Just type any word you want to master. I\'ll provide the core nuance and 5 context examples based on EFL principles.',
      timestamp: Date.now()
    }]);
  };

  useEffect(() => {
    localStorage.setItem('efl_lexicon_saved', JSON.stringify(savedWords));
  }, [savedWords]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('efl_chat_history', JSON.stringify(messages));
    }
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, activeTab]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: Date.now()
    }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const details = await getWordDetails(query);
      const existingInVocab = savedWords.find(w => w.word.toLowerCase() === details.word.toLowerCase());
      const wordToSave = existingInVocab 
        ? { ...details, userSentence: existingInVocab.userSentence } 
        : details;

      if (db.isSupabaseConfigured()) {
        const saved = await db.saveWordToDB(wordToSave);
        if (saved) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: saved, timestamp: Date.now() }]);
          setSavedWords(prev => [saved, ...prev.filter(w => w.word.toLowerCase() !== details.word.toLowerCase())]);
        } else { saveLocalOnly(wordToSave); }
      } else { saveLocalOnly(wordToSave); }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "AI 응답 오류가 발생했습니다.", timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  const saveLocalOnly = (details: WordDetail | SavedWord) => {
    const existing = savedWords.find(w => w.word.toLowerCase() === details.word.toLowerCase());
    const newId = existing ? existing.id : Date.now().toString();
    const newSaved: SavedWord = { 
      ...details, 
      id: newId, 
      savedAt: existing ? existing.savedAt : Date.now(),
      userSentence: (details as SavedWord).userSentence || (existing ? existing.userSentence : undefined)
    };
    setSavedWords(prev => [newSaved, ...prev.filter(w => w.word.toLowerCase() !== details.word.toLowerCase())]);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: newSaved, timestamp: Date.now() }]);
  };

  const removeWord = async (id: string) => {
    if (db.isSupabaseConfigured()) await db.deleteWordFromDB(id);
    setSavedWords(prev => prev.filter(w => w.id !== id));
    if (selectedWord?.id === id) setSelectedWord(null);
  };

  const updateUserPractice = async (wordId: string, sentence: string) => {
    if (!wordId) return;
    let targetWordName: string | undefined;
    const vocabMatch = savedWords.find(w => w.id === wordId);
    if (vocabMatch) targetWordName = vocabMatch.word.toLowerCase();
    else {
      for (const m of messages) {
        if (typeof m.content === 'object' && 'word' in m.content && (m.content as SavedWord).id === wordId) {
          targetWordName = (m.content as SavedWord).word.toLowerCase();
          break;
        }
      }
    }
    if (!targetWordName) return;

    setSavedWords(prev => prev.map(w => (w.word.toLowerCase() === targetWordName) ? { ...w, userSentence: sentence } : w));
    if (db.isSupabaseConfigured()) {
      const wordToSync = savedWords.find(w => w.word.toLowerCase() === targetWordName);
      if (wordToSync) await db.saveWordToDB({ ...wordToSync, userSentence: sentence });
    }
    setMessages(prev => prev.map(msg => {
      const content = msg.content;
      if (content && typeof content === 'object' && 'word' in content) {
        if ((content as WordDetail).word.toLowerCase() === targetWordName) {
          return { ...msg, content: { ...content, userSentence: sentence } as SavedWord };
        }
      }
      return msg;
    }));
    if (selectedWord && selectedWord.word.toLowerCase() === targetWordName) {
      setSelectedWord(prev => prev ? { ...prev, userSentence: sentence } : null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !selectedWord) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    if (Math.abs(deltaX) > 60) {
      const currentIndex = savedWords.findIndex(w => w.id === selectedWord.id);
      if (deltaX < 0 && currentIndex < savedWords.length - 1) setSelectedWord(savedWords[currentIndex + 1]);
      else if (deltaX > 0 && currentIndex > 0) setSelectedWord(savedWords[currentIndex - 1]);
    }
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <header className="glass sticky top-0 z-30 px-5 flex justify-between items-center border-b border-slate-200/50" 
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <i className="fa-solid fa-sparkles text-white text-[12px]"></i>
          </div>
          <h1 className="font-black text-lg text-slate-900 tracking-tight">LEXI<span className="text-indigo-600">AI</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md animate-pulse">
              {syncStatus}
            </span>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-slate-100 text-slate-500 active:scale-90">
            <i className={`fa-solid ${db.isSupabaseConfigured() ? 'fa-cloud-check text-indigo-500' : 'fa-gear'}`}></i>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 relative overflow-hidden">
        {/* Chat Tab */}
        <div className={`absolute inset-0 overflow-y-auto custom-scrollbar px-4 pt-4 pb-44 transition-opacity duration-300 ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`} ref={chatScrollRef}>
          <div className="max-w-xl mx-auto space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className="max-w-[92%]">
                  {msg.role === 'assistant' && msg.content && typeof msg.content === 'object' && 'word' in msg.content ? (
                    <WordDetailCard data={msg.content as SavedWord} onUpdatePractice={(s: string) => updateUserPractice((msg.content as SavedWord).id, s)} />
                  ) : (
                    <div className={`px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                      msg.role === 'user' ? 'bg-indigo-600 text-white font-semibold rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200/60 font-medium rounded-tl-none'
                    }`}>
                      {msg.content as string}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && <div className="flex justify-start"><div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div></div></div>}
          </div>
        </div>

        {/* Vocab Tab */}
        <div className={`absolute inset-0 overflow-y-auto custom-scrollbar px-4 pt-4 pb-24 transition-opacity duration-300 ${activeTab === 'list' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Vocabulary</h2>
              {db.isSupabaseConfigured() && (
                <button 
                  onClick={() => syncWithCloud(savedWords).then(setSavedWords)} 
                  disabled={isSyncing} 
                  className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 active:scale-95 transition-all uppercase tracking-wider"
                >
                  <i className={`fa-solid fa-arrows-rotate ${isSyncing ? 'animate-spin' : ''}`}></i> 
                  Sync Now
                </button>
              )}
            </div>
            {savedWords.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200"><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Your Lexicon is Empty</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {savedWords.map((word) => (
                  <div key={word.id} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between active:bg-slate-50 transition-all cursor-pointer group" onClick={() => setSelectedWord(word)}>
                    <div className="flex-1"><h3 className="text-base font-black text-indigo-600 uppercase tracking-tight mb-0.5">{word.word}</h3><p className="text-slate-500 text-[11px] italic line-clamp-1">{word.nuance}</p></div>
                    <div className="flex items-center gap-3"><i className="fa-solid fa-chevron-right text-slate-200 text-xs"></i><button onClick={(e) => { e.stopPropagation(); removeWord(word.id); }} className="text-slate-300 active:text-rose-500 p-2"><i className="fa-solid fa-trash-can"></i></button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quiz Tab */}
        <div className={`absolute inset-0 overflow-y-auto custom-scrollbar px-4 pt-4 pb-24 transition-opacity duration-300 ${activeTab === 'quiz' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}><div className="max-w-xl mx-auto"><QuizView savedWords={savedWords} /></div></div>

        {/* Word Detail Overlay */}
        {selectedWord && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md flex items-end justify-center animate-in fade-in duration-300" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="bg-slate-50 w-full max-w-2xl h-[92%] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-500">
              <div className="px-6 pt-6 pb-2 flex justify-between items-center">
                <button onClick={() => setSelectedWord(null)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm active:scale-90"><i className="fa-solid fa-chevron-down"></i></button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navigation</span>
                  <div className="flex gap-1 mt-1">
                    {savedWords.slice(Math.max(0, savedWords.findIndex(w => w.id === selectedWord.id) - 2), Math.max(0, savedWords.findIndex(w => w.id === selectedWord.id) - 2) + 5).map((w) => (
                      <div key={w.id} className={`w-1 h-1 rounded-full ${w.id === selectedWord.id ? 'bg-indigo-600 w-3' : 'bg-slate-200'} transition-all`}></div>
                    ))}
                  </div>
                </div>
                <button onClick={() => removeWord(selectedWord.id)} className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 shadow-sm active:scale-90"><i className="fa-solid fa-trash-can"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-20">
                <div className="max-w-xl mx-auto"><WordDetailCard key={selectedWord.id} data={selectedWord} onUpdatePractice={(s: string) => updateUserPractice(selectedWord.id, s)} /><div className="mt-4"><button onClick={() => setSelectedWord(null)} className="w-full py-4 bg-white text-slate-400 rounded-2xl font-black text-[12px] uppercase tracking-widest border border-slate-200 active:bg-slate-50 transition-all">Close</button></div></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Search Bar */}
      <div className={`fixed left-0 right-0 px-4 z-40 transition-all duration-300 pointer-events-none ${activeTab === 'chat' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        <form onSubmit={handleSearch} className="max-w-xl mx-auto relative pointer-events-auto">
          <div className="relative group">
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Explore word essence..." className="w-full bg-white/95 backdrop-blur-xl border border-slate-200 focus:border-indigo-500 rounded-full px-6 py-4 pr-14 text-[15px] font-bold shadow-xl outline-none" disabled={isLoading} />
            <button type="submit" disabled={!inputValue.trim() || isLoading} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all"><i className="fa-solid fa-arrow-up"></i></button>
          </div>
        </form>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-black text-slate-900">Supabase Sync</h3><button onClick={() => setIsSettingsOpen(false)} className="text-slate-400"><i className="fa-solid fa-xmark text-lg"></i></button></div>
            <div className="space-y-4">
              {['URL', 'Key', 'User ID'].map((label, i) => (
                <div key={label}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                  <input 
                    value={[dbUrl, dbKey, dbUserId][i]} 
                    type={label === 'Key' ? 'password' : 'text'} 
                    placeholder={label === 'User ID' ? "lexi_user_shared" : ""}
                    onChange={e => [setDbUrl, setDbKey, setDbUserId][i](e.target.value)} 
                    className="w-full mt-1 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none" 
                  />
                </div>
              ))}
            </div>
            <button 
              onClick={async () => { 
                db.setSupabaseConfig(dbUrl, dbKey, dbUserId); 
                if(await db.testConnection()){ 
                  const result = await syncWithCloud(savedWords);
                  setSavedWords(result);
                  setIsSettingsOpen(false); 
                } else alert("Connect Failed. Please check URL and Key."); 
              }} 
              className="w-full mt-6 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Connect & Sync
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <footer className="glass border-t border-slate-200/50 grid grid-cols-3 z-50 bg-white/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {(['chat', 'list', 'quiz'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 flex flex-col items-center gap-1 transition-all ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400'}`}>
            <div className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${activeTab === tab ? 'bg-indigo-600/10' : ''}`}><i className={`fa-solid ${tab === 'chat' ? 'fa-magnifying-glass' : tab === 'list' ? 'fa-book-bookmark' : 'fa-brain-circuit'} text-[18px]`}></i></div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab === 'chat' ? 'Search' : tab === 'list' ? 'Vocab' : 'Quiz'}</span>
          </button>
        ))}
      </footer>
    </div>
  );
};

export default App;
