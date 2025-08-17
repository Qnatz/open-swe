import { JsonOutputParser } from "@langchain/core/output_parsers";

// Safely reconstructs JSON from fragmented streaming chunks
export class StreamJSONCollector extends JsonOutputParser<Record<string, unknown>> {
  private buffer = "";
  private objects: Record<string, unknown>[] = [];

  // Process incoming JSON fragment
  feed(chunk: string): void {
    this.buffer += chunk;
    this._extractCompleteObjects();
  }

  // Extract valid JSON objects from buffer
  private _extractCompleteObjects(): void {
    while (true) {
      const start = this.buffer.indexOf("{");
      const end = this.buffer.indexOf("}", start);

      if (start === -1 || end === -1) {
        break;
      }

      const candidate = this.buffer.substring(start, end + 1);
      try {
        const obj = JSON.parse(candidate) as Record<string, unknown>;
        this.objects.push(obj);
        this.buffer = this.buffer.substring(end + 1);
      } catch (e) {
        // Incomplete JSON object, wait for more chunks
        break;
      }
    }
  }

  // Get all collected JSON objects
  getObjects(): Record<string, unknown>[] {
    return this.objects;
  }

  // Clear the buffer and collected objects
  clear(): void {
    this.buffer = "";
    this.objects = [];
  }
}
