export const models = {
  local: {
    name: 'Local LLM',
    url: 'http://127.0.0.1:8080/v1/chat/completions',
  },
  gemini: {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  },
};
