import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Story, StoryPage, Quiz } from "../types";

// NOTE: Process.env.API_KEY is assumed to be available.
const apiKey = process.env.API_KEY || ''; 

// Helper to ensure we have a fresh client
const getClient = () => new GoogleGenAI({ apiKey });

export const generateStoryContent = async (topic: string): Promise<Omit<Story, 'id' | 'createdAt' | 'isCompleted'>> => {
  const ai = getClient();
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A fun, catchy title for the story" },
      pages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pageNumber: { type: Type.INTEGER },
            text: { type: Type.STRING, description: "Simple, engaging text for children (2-3 sentences)" },
            imagePrompt: { type: Type.STRING, description: "A highly descriptive prompt for an image generator to create a colorful, children's book style illustration matching the text." }
          },
          required: ["pageNumber", "text", "imagePrompt"]
        }
      },
      quiz: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "A simple comprehension question about the story" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3 possible answers"
          },
          correctAnswerIndex: { type: Type.INTEGER, description: "Index of the correct answer (0-2)" }
        },
        required: ["question", "options", "correctAnswerIndex"]
      }
    },
    required: ["title", "pages", "quiz"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Write a short children's picture book story (3-5 pages) about: ${topic}. The tone should be educational, fun, and safe for kids.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: "You are a world-class children's book author. Create engaging, simple stories."
    }
  });

  if (!response.text) throw new Error("No content generated");
  return JSON.parse(response.text);
};

export const generateStoryImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  // Using Imagen 3 (via model name gemini-2.5-flash-image for general purpose or specific imagen model if available)
  // The prompt instructions suggest imagen-4.0-generate-001 for high quality.
  
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `Children's book illustration, cute, colorful, vector style, high quality. ${prompt}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });
    
    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64ImageBytes) throw new Error("No image generated");
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (e) {
    console.error("Imagen 4 failed, trying fallback to Gemini Flash Image", e);
    // Fallback if Imagen 4 isn't available or fails
    const fallbackAi = getClient();
    const response = await fallbackAi.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: `Children's book illustration, cute, colorful. ${prompt}` }]
        },
        config: {
            responseModalities: [Modality.IMAGE]
        }
    });
    
    // Extract inline data from response
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image generation failed");
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is usually good for storytelling
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};
