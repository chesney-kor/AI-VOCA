
import { SavedWord, WordDetail } from "../types";

const DEFAULT_ID = "lexi_user_shared";
let supabaseUrl = localStorage.getItem('supabase_url') || "";
let supabaseKey = localStorage.getItem('supabase_key') || "";
let userId = localStorage.getItem('supabase_user_id') || DEFAULT_ID;

export const isSupabaseConfigured = () => {
  return supabaseUrl.startsWith('http') && supabaseKey.length > 20;
};

export const setSupabaseConfig = (url: string, key: string, id: string) => {
  const cleanUrl = url.trim().replace(/\/$/, ""); 
  localStorage.setItem('supabase_url', cleanUrl);
  localStorage.setItem('supabase_key', key.trim());
  localStorage.setItem('supabase_user_id', id.trim() || DEFAULT_ID);
  supabaseUrl = cleanUrl;
  supabaseKey = key.trim();
  userId = id.trim() || DEFAULT_ID;
};

const headers = () => ({
  "apikey": supabaseKey,
  "Authorization": `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

export const testConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_words?limit=1`, {
      method: "GET",
      headers: headers()
    });
    return res.ok;
  } catch (e) {
    return false;
  }
};

export const fetchWordsFromDB = async (): Promise<SavedWord[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const encodedUserId = encodeURIComponent(userId);
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_words?user_id=eq.${encodedUserId}&order=created_at.desc`, {
      method: "GET",
      headers: headers()
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase Fetch Failed:", errorText);
      return null;
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((item: any) => ({
      id: item.id,
      word: item.word,
      nuance: item.nuance,
      examples: Array.isArray(item.examples) ? item.examples : [],
      userSentence: item.user_sentence,
      savedAt: new Date(item.created_at).getTime()
    }));
  } catch (error) {
    console.error("Supabase Fetch Error:", error);
    return null;
  }
};

export const saveWordToDB = async (word: WordDetail | SavedWord): Promise<SavedWord | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const encodedUserId = encodeURIComponent(userId);
    const encodedWord = encodeURIComponent(word.word);
    
    // 1. 기존 데이터 확인 (중복 방지)
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/saved_words?user_id=eq.${encodedUserId}&word=eq.${encodedWord}`, {
      method: "GET",
      headers: headers()
    });
    
    let existing: any[] = [];
    if (checkRes.ok) {
      existing = await checkRes.json();
    }

    // 2. 페이로드 준비
    const payload = {
      word: word.word,
      nuance: word.nuance,
      examples: Array.isArray(word.examples) ? word.examples : [],
      user_sentence: (word as SavedWord).userSentence || null,
      user_id: userId
    };

    let res;
    if (Array.isArray(existing) && existing.length > 0) {
      // UPDATE
      res = await fetch(`${supabaseUrl}/rest/v1/saved_words?id=eq.${existing[0].id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(payload)
      });
    } else {
      // INSERT
      res = await fetch(`${supabaseUrl}/rest/v1/saved_words`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const errorDetail = await res.text();
      console.group("Supabase 400 Error Debug");
      console.error("Status:", res.status);
      console.error("Message:", errorDetail);
      console.log("Sent Payload:", payload);
      console.groupEnd();
      return null;
    }

    const data = await res.json();
    if (data && data[0]) {
      const item = data[0];
      return {
        ...word,
        id: item.id,
        userSentence: item.user_sentence,
        savedAt: new Date(item.created_at).getTime()
      } as SavedWord;
    }
    return null;
  } catch (error) {
    console.error("Supabase Save Error:", error);
    return null;
  }
};

export const deleteWordFromDB = async (id: string) => {
  if (!isSupabaseConfigured()) return;
  try {
    if (id && id.length > 15 && !id.startsWith('local_')) {
      await fetch(`${supabaseUrl}/rest/v1/saved_words?id=eq.${id}`, {
        method: "DELETE",
        headers: headers()
      });
    }
  } catch (error) {
    console.error("Supabase Delete Error:", error);
  }
};

export const uploadLocalWords = async (localWords: SavedWord[]): Promise<number> => {
  if (!isSupabaseConfigured() || localWords.length === 0) return 0;
  let count = 0;
  for (const word of localWords) {
    const saved = await saveWordToDB(word);
    if (saved) count++;
  }
  return count;
};
