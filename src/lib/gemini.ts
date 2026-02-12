import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini
// Note: In production, calling API directly from client exposes the key if not careful. 
// For Chrome Extensions, it's safer but still risky. A backend proxy is better.
// For this MVP, we use client-side directly.
const genAI = new GoogleGenerativeAI(API_KEY || "YOUR_API_KEY");

export const getGeminiResponse = async (userMessage: string) => {
    if (!API_KEY) return "I'm having trouble connecting to my brain (API Key missing).";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
      You are Bob, a supportive, empathetic college mentor and friend. 
      You help students with stress, time management, and loneliness.
      Keep your responses concise (under 50 words usually), warm, and encouraging.
      Use emojis occasionally.
      
      User: ${userMessage}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "I'm feeling a bit disconnected right now. Can we try again later?";
    }
};
