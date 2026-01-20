
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordDetail, QuizQuestion } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";
import { getCachedAudio, setCachedAudio } from "./audioCacheService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 전역 오디오 컨텍스트 싱글톤 (반응 속도 개선)
let globalAudioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!globalAudioCtx) {
    globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
};

const cleanJSONResponse = (text: string) => {
  return text.replace(/```json\n?|```/g, '').trim();
};

export const getWordDetails = async (word: string): Promise<WordDetail> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Please explain the word: "${word}" according to the EFL principles.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          nuance: { type: Type.STRING },
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                sentence: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["category", "sentence", "explanation"]
            }
          }
        },
        required: ["word", "nuance", "examples"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  return JSON.parse(cleanJSONResponse(text)) as WordDetail;
};

export const generateQuiz = async (savedWords: string[]): Promise<QuizQuestion> => {
  if (savedWords.length < 1) throw new Error("Not enough words to generate a quiz.");
  
  const targetWord = savedWords[Math.floor(Math.random() * savedWords.length)];
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a fill-in-the-blank quiz question for: "${targetWord}". Ensure one of the options is the correct word.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentence: { type: Type.STRING },
          correctWord: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["sentence", "correctWord", "options"]
      }
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("Empty quiz response from AI");
  return JSON.parse(cleanJSONResponse(text)) as QuizQuestion;
};

// --- TTS Logic ---

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// 오직 캐시 생성만 담당하는 함수 (백그라운드용)
export const cacheSpeech = async (text: string) => {
  if (!text.trim()) return;
  const cacheKey = `tts_${text.slice(0, 50)}_${text.length}`;
  const existing = await getCachedAudio(cacheKey);
  if (existing) return;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      await setCachedAudio(cacheKey, decodeBase64(base64Audio));
    }
  } catch (e) {
    console.warn("Silent background caching failed:", e);
  }
};

export const playSpeech = async (text: string, onGenerateStart?: () => void) => {
  if (!text.trim()) return;
  const cacheKey = `tts_${text.slice(0, 50)}_${text.length}`;
  
  try {
    let audioData = await getCachedAudio(cacheKey);
    
    if (!audioData) {
      if (onGenerateStart) onGenerateStart();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data received");
      audioData = decodeBase64(base64Audio);
      await setCachedAudio(cacheKey, audioData);
    }

    const audioCtx = getAudioCtx();
    const audioBuffer = await decodeAudioData(audioData, audioCtx);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start(0);
    
    return new Promise((resolve) => {
      source.onended = () => resolve(true);
      // 안전장치: 브라우저 정책에 의해 재생이 막힐 경우 대비
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    });
  } catch (error) {
    console.error("Speech Process Error:", error);
    throw error;
  }
};
