import { jest } from "@jest/globals";
import nock from "nock";
import {AIMessageChunk} from "@langchain/core/messages";
import {getModelManager} from "../utils/llms/model-manager.js";
import {LLMTask} from "@open-swe/shared/open-swe/llm-task";

describe("Local LLM Tool Calling", () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it("should correctly parse streamed tool calls from a local LLM", async () => {
        const scope = nock("http://127.0.0.1:8080")
            .post("/v1/chat/completions")
            .reply(200, function* () {
                yield 'data: {"choices":[{"delta":{"role":"assistant","content":""}, "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]}, "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":"{\\""}}]}} , "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":"city\\""}}]}} , "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":":"}}]}} , "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":"\\"London\\""}}]}} , "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"arguments":"}"}}]}} , "index":0, "finish_reason":null}]}\n\n';
                yield 'data: {"choices":[{"delta":{}, "index":0, "finish_reason":"tool_calls"}]}\n\n';
                yield "data: [DONE]\n\n";
            });

        const modelManager = getModelManager();
        modelManager.getModelConfigs = jest.fn().mockReturnValue([{
            provider: "openai",
            modelName: "local-model",
        }]);

        const mockStream = (async function* () {
            yield new AIMessageChunk({ content: "", tool_calls: [] });
            yield new AIMessageChunk({ content: "", tool_calls: [{ name: "get_weather", args: "", id: "call_1", index: 0 }] });
            yield new AIMessageChunk({ content: "", tool_calls: [{ name: "get_weather", args: "{\"city\":", id: "call_1", index: 0 }] });
            yield new AIMessageChunk({ content: "", tool_calls: [{ name: "get_weather", args: "\"London\"}", id: "call_1", index: 0 }] });
        })();

        const mockModel = {
            _streamResponseChunks: jest.fn().mockReturnValue(mockStream),
            invoke: jest.fn().mockResolvedValue(new AIMessageChunk({
                content: "",
                tool_calls: [{
                    name: "get_weather",
                    args: {city: "London"},
                    id: "call_1",
                }]
            }))
        };

        modelManager.initializeModel = jest.fn().mockResolvedValue(mockModel);

        const model = await modelManager.loadModel({
            configurable: {
                model: "local-model",
                langgraph_auth_user: { display_name: "test-user" },
                thread_id: "test-thread",
                assistant_id: "test-assistant"
            }
        } as any, LLMTask.PROGRAMMER);

        const result = await model.invoke("What's the weather in London?");

        expect(result).toBeInstanceOf(AIMessageChunk);
        expect(result.tool_calls).toBeDefined();
        expect(result.tool_calls).toHaveLength(1);
        if (result.tool_calls) {
            expect(result.tool_calls[0].name).toBe("get_weather");
            expect(result.tool_calls[0].args).toEqual({city: "London"});
        }
    });
});
