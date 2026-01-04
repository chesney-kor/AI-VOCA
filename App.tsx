
import React, { useState, useEffect, useRef } from 'react';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // DB Config State
  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || "");
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || "");
  const [dbUserId, setDbUserId] = useState(localStorage.getItem('supabase_user_id') || "my_lexicon_user");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
      // 1. Load Chat History first for immediate UI
      const storedMessages = localStorage.getItem('efl_chat_history');
      if (storedMessages) {
        try {
          const parsed = JSON.parse(storedMessages);
          if (parsed.length > 0) setMessages(parsed); else showWelcome();
        } catch (e) { showWelcome(); }
      } else { showWelcome(); }

      // 2. Load Words
      if (db.isSupabaseConfigured()) {
        setIsSyncing(true);
        const cloudWords = await db.fetchWordsFromDB();
        if (cloudWords.length > 0) {
          setSavedWords(cloudWords);
        } else {
          // Fallback to local if cloud is empty
          loadLocalWords();
        }
        setIsSyncing(false);
      } else {
        loadLocalWords();
      }
    };

    const loadLocalWords = () => {
      const storedWords = localStorage.getItem('efl_lexicon_saved');
      if (storedWords) {
        try { setSavedWords(JSON.parse(storedWords)); } catch (e) {}
      }
    };

    initData();
  }, []);

  const showWelcome = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! 💡 Just type any word you want to master. I\'ll provide the core nuance and 5 context examples based on EFL principles.',
      timestamp: Date.now()
    }]);
  };

  useEffect(() => {
    // Backup to local storage always
    localStorage.setItem('efl_lexicon_saved', JSON.stringify(savedWords));
  }, [savedWords]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('efl_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const details = await getWordDetails(query);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: details,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (db.isSupabaseConfigured()) {
        const saved = await db.saveWordToDB(details);
        if (saved) {
          setSavedWords(prev => [saved, ...prev.filter(w => w.word.toLowerCase() !== details.word.toLowerCase())]);
        } else {
          // Local fallback if DB fails
          saveLocalOnly(details);
        }
      } else {
        saveLocalOnly(details);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Sorry, I had trouble processing that word. Check your connection or API configuration.",
        timestamp: Date.now()
      }]);
    } finally { setIsLoading(false); }
  };

  const saveLocalOnly = (details: WordDetail) => {
    setSavedWords(prev => {
      if (prev.some(w => w.word.toLowerCase() === details.word.toLowerCase())) return prev;
      return [{ ...details, id: Date.now().toString(), savedAt: Date.now() }, ...prev];
    });
  };

  const removeWord = async (id: string) => {
    if (db.isSupabaseConfigured()) {
      await db.deleteWordFromDB(id);
    }
    setSavedWords(prev => prev.filter(w => w.id !== id));
  };

  const saveSettings = async () => {
    db.setSupabaseConfig(dbUrl, dbKey, dbUserId);
    const isWorking = await db.testConnection();
    if (isWorking) {
      if (savedWords.length > 0 && confirm("기존 로컬 단어들을 Supabase 클라우드로 업로드할까요?")) {
        setIsSyncing(true);
        await db.uploadLocalWords(savedWords);
        const freshWords = await db.fetchWordsFromDB();
        setSavedWords(freshWords);
        setIsSyncing(false);
      }
      setIsSettingsOpen(false);
      alert("클라우드 연결 성공!");
    } else {
      alert("연결 실패! URL과 Key를 다시 확인해 주세요.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <header className="glass sticky top-0 z-30 px-6 flex justify-between items-center border-b border-slate-200/50" 
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)', paddingBottom: '1rem' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <i className="fa-solid fa-sparkles text-white text-sm"></i>
          </div>
          <h1 className="font-black text-lg text-slate-900 tracking-tight">LEXI<span className="text-indigo-600">AI</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
          {isSyncing && <i className="fa-solid fa-arrows-rotate animate-spin text-indigo-400 text-sm"></i>}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${db.isSupabaseConfigured() ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}
          >
            <i className={`fa-solid ${db.isSupabaseConfigured() ? 'fa-cloud-check' : 'fa-gear'}`}></i>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 relative overflow-hidden bg-slate-50">
        <div ref={scrollRef} className="h-full overflow-y-auto custom-scrollbar px-4 py-6 pb-48">
          <div className="max-w-2xl mx-auto">
            {activeTab === 'chat' && (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[90%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                      {msg.role === 'assistant' && typeof msg.content === 'object' ? (
                        <WordDetailCard data={msg.content} />
                      ) : (
                        <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white font-semibold rounded-tr-none shadow-indigo-100' 
                            : 'bg-white text-slate-800 border border-slate-200/60 font-medium rounded-tl-none'
                        }`}>
                          <p className="text-[15px] leading-relaxed">{msg.content as string}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'list' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Vocab 
                    <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full align-middle uppercase tracking-widest ${db.isSupabaseConfigured() ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {db.isSupabaseConfigured() ? 'Cloud Sync' : 'Local Only'}
                    </span>
                  </h2>
                </div>
                {savedWords.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No words in your lexicon</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {savedWords.map((word) => (
                      <div key={word.id} className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
                           onClick={() => { setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: word, timestamp: Date.now() }]); setActiveTab('chat'); }}>
                        <div className="flex-1">
                          <h3 className="text-lg font-black text-indigo-600 uppercase tracking-tight mb-0.5">{word.word}</h3>
                          <p className="text-slate-500 text-xs italic line-clamp-1">{word.nuance}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeWord(word.id); }} className="text-slate-300 hover:text-rose-500 p-2 transition-colors">
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quiz' && <QuizView savedWords={savedWords} />}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-2xl font-black text-slate-900">Supabase Sync</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-300 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <p className="text-slate-500 text-sm mb-6 font-medium">데이터를 클라우드에 안전하게 저장하세요.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supabase URL</label>
                <input value={dbUrl} onChange={e => setDbUrl(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 font-medium text-sm outline-none focus:border-indigo-500" placeholder="https://xyz.supabase.co" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anon Key</label>
                <input value={dbKey} onChange={e => setDbKey(e.target.value)} type="password" className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 font-medium text-sm outline-none focus:border-indigo-500" placeholder="eyJhbGci..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your ID</label>
                <input value={dbUserId} onChange={e => setDbUserId(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 font-medium text-sm outline-none focus:border-indigo-500" placeholder="iphone_user_1" />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={saveSettings} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Save & Sync Now</button>
            </div>
            <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">Supabase 프로젝트의 Project Settings {'>'} API 에서 확인 가능합니다.</p>
          </div>
        </div>
      )}

      {/* Floating Search (Chat Tab) */}
      {activeTab === 'chat' && (
        <div className="fixed left-0 right-0 px-4 z-40 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 85px)' }}>
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative pointer-events-auto">
            <div className="relative group">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Explore a word essence..." className="w-full bg-white/95 backdrop-blur-xl border-2 border-slate-200/50 focus:border-indigo-500 focus:ring-[6px] focus:ring-indigo-500/10 rounded-[2rem] px-7 py-5 pr-16 text-base font-bold shadow-2xl shadow-indigo-100/30 outline-none" disabled={isLoading} />
              <button type="submit" disabled={!inputValue.trim() || isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"><i className="fa-solid fa-arrow-up text-lg"></i></button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom Nav */}
      <footer className="glass border-t border-slate-200/50 grid grid-cols-3 z-50 bg-white/90" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {(['chat', 'list', 'quiz'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 flex flex-col items-center gap-1 transition-all ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400'}`}>
            <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${activeTab === tab ? 'bg-indigo-600/10' : ''}`}>
              <i className={`fa-solid ${tab === 'chat' ? 'fa-magnifying-glass' : tab === 'list' ? 'fa-book-bookmark' : 'fa-brain-circuit'} text-[18px]`}></i>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{tab === 'chat' ? 'Search' : tab === 'list' ? 'Vocab' : 'Quiz'}</span>
          </button>
        ))}
      </footer>
    </div>
  );
};

export default App;
