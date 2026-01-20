
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
      examples: item.examples,
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
    
    // 1. 기존 데이터 존재 확인
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/saved_words?user_id=eq.${encodedUserId}&word=eq.${encodedWord}`, {
      method: "GET",
      headers: headers()
    });
    
    let existing: any[] = [];
    if (checkRes.ok) {
      existing = await checkRes.json();
    }
    
    const payload = {
      word: word.word,
      nuance: word.nuance,
      examples: Array.isArray(word.examples) ? word.examples : [],
      user_sentence: (word as SavedWord).userSentence || null,
      user_id: userId
    };

    if (Array.isArray(existing) && existing.length > 0) {
      // UPDATE (PATCH)
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/saved_words?id=eq.${existing[0].id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(payload)
      });
      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error("Supabase Update Failed (400?):", errorText);
        return null;
      }
      const updated = await updateRes.json();
      if (updated && updated[0]) {
        return {
          ...word,
          id: updated[0].id,
          userSentence: updated[0].user_sentence,
          savedAt: new Date(updated[0].created_at).getTime()
        } as SavedWord;
      }
    } else {
      // INSERT (POST)
      const res = await fetch(`${supabaseUrl}/rest/v1/saved_words`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Supabase Insert Failed (400?):", errorText);
        return null;
      }
      const data = await res.json();
      if (data && data[0]) {
        return {
          ...word,
          id: data[0].id,
          userSentence: data[0].user_sentence,
          savedAt: new Date(data[0].created_at).getTime()
        } as SavedWord;
      }
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
    // UUID 형식이 아닌 로컬 ID는 DB 삭제에서 제외
    if (id.length > 15) {
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
