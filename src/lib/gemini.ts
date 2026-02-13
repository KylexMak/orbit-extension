import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini
// Note: In production, calling API directly from client exposes the key if not careful. 
// For Chrome Extensions, it's safer but still risky. A backend proxy is better.
// For this MVP, we use client-side directly.
const genAI = new GoogleGenerativeAI(API_KEY || "YOUR_API_KEY");

interface GeminiContext {
    todayEvents?: string;
    chatHistory?: string;
}

export const getGeminiResponse = async (userMessage: string, context?: GeminiContext) => {
    if (!API_KEY) return "I'm having trouble connecting to my brain (API Key missing).";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        let prompt = `You are Bob, a supportive, empathetic college mentor and friend.
You help students with stress, time management, and loneliness.
Keep your responses concise (under 50 words usually), warm, and encouraging.
Use emojis occasionally.`;

        if (context?.todayEvents) {
            prompt += `\n\nThe user's schedule for today:\n${context.todayEvents}`;
        }

        if (context?.chatHistory) {
            prompt += `\n\nConversation so far:\n${context.chatHistory}`;
        }

        prompt += `\n\nUser: ${userMessage}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "I'm feeling a bit disconnected right now. Can we try again later?";
    }
};
