// ============================================================================
// Simple test · testTool（`src/mastra/tools/testTool .ts`）
//
// 用途 ：1 次真实调用 → 打印 { location, temperatureCelsius, conditions }
// 费用 ：0（直接 fetch wttr.in 公开接口，不经过 LLM）
// 运行 ：npx tsx tests/test-tool.e2e.ts
// ============================================================================
import { testTool } from "../src/mastra/tools/testTool.ts";

const LOCATION = "Shanghai";

process.stdout.write(`testTool(${JSON.stringify(LOCATION)})  `);
const out: any = await testTool.execute({ location: LOCATION });

if (out && typeof out.temperatureCelsius === "number" && typeof out.conditions === "string") {
  console.log(`✅  ${out.location ?? LOCATION} · ${out.temperatureCelsius}°C · ${out.conditions}`);
  process.exit(0);
} else {
  console.log(`❌  return=${JSON.stringify(out).slice(0, 200)}`);
  process.exit(1);
}
