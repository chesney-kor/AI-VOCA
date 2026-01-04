
import { GoogleGenAI, Type } from "@google/genai";
import { WordDetail, QuizQuestion } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

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
    const textResponse = await ai.models.generateContent({
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

    const details = JSON.parse(cleanJSONResponse(textResponse.text || "{}")) as WordDetail;
    return details;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateQuiz = async (savedWords: string[]): Promise<QuizQuestion> => {
  if (savedWords.length < 1) throw new Error("Not enough words to generate a quiz.");
  const ai = getAI();
  const targetWord = savedWords[Math.floor(Math.random() * savedWords.length)];
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a fill-in-the-blank quiz question for: "${targetWord}".`,
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
  return JSON.parse(cleanJSONResponse(response.text || "{}")) as QuizQuestion;
};
