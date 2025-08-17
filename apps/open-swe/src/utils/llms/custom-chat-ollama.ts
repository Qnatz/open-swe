import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { StreamJSONCollector } from "./stream-json-collector.js";
import { type ChatOllamaInput } from "@langchain/community/chat_models/ollama";
import {
  type TiktokenEncoding,
  getEncoding,
} from "js-tiktoken";

const getNumTokens = (text: string, model: TiktokenEncoding = "gpt2") => {
  const encoding = getEncoding(model);
  return encoding.encode(text).length;
};

export class CustomChatOllama extends ChatOllama {
  constructor(fields: ChatOllamaInput) {
    super(fields);
  }

  async *_streamResponseChunks(
    prompt: any[],
    options: this["ParsedCallOptions"],
    runManager?: any,
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = await super._streamResponseChunks(prompt, options, runManager);
    const collector = new StreamJSONCollector();

    let responseText = "";
    const toolCalls: any[] = [];
    let toolCallCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.message.content;
      if (typeof delta === "string") {
        responseText += delta;
        // Check for tool call start
        if (responseText.includes('"tool_calls":')) {
          // Collect potential tool call fragments
          collector.feed(responseText);
          const collectedObjects = collector.getObjects();
          if (collectedObjects.length > 0) {
            for (const obj of collectedObjects) {
              if (obj.tool_calls) {
                // This is a structured tool call message
                const newToolCalls = (obj.tool_calls as any[]).slice(toolCallCount);
                for (const toolCall of newToolCalls) {
                  toolCalls.push(toolCall);
                  toolCallCount++;
                }
                // Reset buffer for next potential tool call
                responseText = "";
              }
            }
          }
        }
      }
      yield chunk;
    }

    if (toolCalls.length > 0) {
      const message = new AIMessageChunk({
        content: "",
        tool_calls: toolCalls,
      });
      yield new ChatGenerationChunk({
        message,
        text: "",
      });
    }
  }
}

export const getKobeStandardModel = (
  fields: ChatOllamaInput,
): CustomChatOllama => {
  const customChatOllama = new CustomChatOllama({
    ...fields,
    temperature: 0,
    topK: 1,
    topP: 0.01,
  });

  // @ts-expect-error - This is a hack to get around the fact that the model is not a valid tiktoken model
  customChatOllama.getNumTokens = (text: string) => getNumTokens(text);

  return customChatOllama;
};
