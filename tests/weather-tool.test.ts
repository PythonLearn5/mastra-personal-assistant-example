// ============================================================================
// Test 1 · weatherTool 纯功能测试（不调用 LLM，无 API 费用）
//
// 目的 ：验证 weatherTool.execute() 本身是否正常工作（geocoding + 气象 API fetch）
// 费用 ：0（直接 fetch 公开的 open-meteo 免费 API）
// 运行 ：yarn test:tool
// ============================================================================
import { weatherTool } from "../src/mastra/tools/index.js";

const cases = ["上海", "Shanghai", "北京", "深圳", "New York", "London", "Tokyo", "巴黎"];
let passed = 0;
let failed = 0;

for (const loc of cases) {
  process.stdout.write(`  weatherTool(${JSON.stringify(loc)})  `);
  try {
    // Mastra v1.x: execute(inputData, context?) — first arg is raw input, NOT wrapped
    const out: any = await weatherTool.execute({ location: loc });
    if (out && typeof out.temperature === "number" && typeof out.humidity === "number") {
      console.log(`✅  ${out.location ?? loc} · ${out.temperature}°C · ${out.conditions}`);
      passed++;
    } else {
      console.log(`❌  return=${JSON.stringify(out).slice(0, 200)}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`❌  ${e?.message ?? String(e)}`);
    failed++;
  }
}

console.log(`\nResult: ${passed} passed, ${failed} failed (${cases.length} cases)`);
process.exit(failed === 0 ? 0 : 1);
