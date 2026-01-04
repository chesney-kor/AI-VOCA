
import { GoogleGenAI, Type } from "@google/genai";
import { WordDetail, QuizQuestion } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// Vite 환경에서는 import.meta.env를 사용할 수도 있지만, 
// deploy.yml 설정에 따라 process.env.API_KEY를 참조하도록 구성합니다.
const getAI = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

const cleanJSONResponse = (text: string) => {
  return text.replace(/```json\n?|```/g, '').trim();
};

export const getWordDetails = async (word: string): Promise<WordDetail> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest", // 비용 효율적이고 빠른 응답을 위해 라이트 모델 권장
      contents: `Please explain the word: "${word}" according to the EFL principles.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            nuance: { type: Type.STRING, description: "Core nuance in Korean" },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  sentence: { type: Type.STRING, description: "English sentence" },
                  explanation: { type: Type.STRING, description: "Korean translation/note" }
                },
                required: ["category", "sentence", "explanation"]
              }
            }
          },
          required: ["word", "nuance", "examples"]
        }
      }
    });

    const cleanedText = cleanJSONResponse(response.text || "{}");
    return JSON.parse(cleanedText) as WordDetail;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateQuiz = async (savedWords: string[]): Promise<QuizQuestion> => {
  if (savedWords.length < 1) throw new Error("Not enough words to generate a quiz.");
  
  const ai = getAI();
  const targetWord = savedWords[Math.floor(Math.random() * savedWords.length)];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: `Generate a fill-in-the-blank quiz question for the word: "${targetWord}". 
      The sentence should be clear enough for an EFL learner to guess the word.
      Provide 4 options including the correct word.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING, description: "The sentence with ____" },
            correctWord: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4 options including the correct word"
            }
          },
          required: ["sentence", "correctWord", "options"]
        }
      }
    });

    const cleanedText = cleanJSONResponse(response.text || "{}");
    return JSON.parse(cleanedText) as QuizQuestion;
  } catch (error) {
    console.error("Quiz Generation Error:", error);
    throw error;
  }
};
