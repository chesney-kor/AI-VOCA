
import { SavedWord, WordDetail } from "../types";

let supabaseUrl = localStorage.getItem('supabase_url') || "";
let supabaseKey = localStorage.getItem('supabase_key') || "";
let userId = localStorage.getItem('supabase_user_id') || "default_user";

export const isSupabaseConfigured = () => {
  return supabaseUrl.startsWith('http') && supabaseKey.length > 20;
};

export const setSupabaseConfig = (url: string, key: string, id: string) => {
  const cleanUrl = url.trim().replace(/\/$/, ""); // 트레일링 슬래시 제거
  localStorage.setItem('supabase_url', cleanUrl);
  localStorage.setItem('supabase_key', key.trim());
  localStorage.setItem('supabase_user_id', id.trim());
  supabaseUrl = cleanUrl;
  supabaseKey = key.trim();
  userId = id.trim();
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

export const fetchWordsFromDB = async (): Promise<SavedWord[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_words?user_id=eq.${userId}&order=created_at.desc`, {
      method: "GET",
      headers: headers()
    });
    if (!res.ok) throw new Error("Fetch failed");
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      word: item.word,
      nuance: item.nuance,
      examples: item.examples,
      savedAt: new Date(item.created_at).getTime()
    }));
  } catch (error) {
    console.error("Supabase Fetch Error:", error);
    return [];
  }
};

export const saveWordToDB = async (word: WordDetail): Promise<SavedWord | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    // 중복 체크: 이미 해당 유저가 이 단어를 가지고 있는지 확인
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/saved_words?user_id=eq.${userId}&word=eq.${word.word}`, {
      method: "GET",
      headers: headers()
    });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      // 이미 있으면 해당 정보 반환 (업데이트는 필요시 추가)
      return {
        ...word,
        id: existing[0].id,
        savedAt: new Date(existing[0].created_at).getTime()
      };
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/saved_words`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        word: word.word,
        nuance: word.nuance,
        examples: word.examples,
        user_id: userId
      })
    });
    const data = await res.json();
    if (data && data[0]) {
      return {
        ...word,
        id: data[0].id,
        savedAt: new Date(data[0].created_at).getTime()
      };
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
    // Supabase ID는 보통 UUID 형식이므로 숫자로만 된 로컬 ID는 걸러냄
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
  // 병렬 처리를 위해 Promise.all 사용 가능하지만 안정성을 위해 순차 처리 또는 최적화
  for (const word of localWords) {
    const saved = await saveWordToDB(word);
    if (saved) count++;
  }
  return count;
};
