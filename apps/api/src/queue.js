import { Queue } from "bullmq";
export function makeQueue(redisUrl) {
  return new Queue("screenshot-runs", { connection: { url: redisUrl } });
}
