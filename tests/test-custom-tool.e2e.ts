// ============================================================================
// Simple test · testTool（`src/mastra/tools/testTool .ts`）
//
// 用途 ：1 次真实调用 → 打印 { location, temperatureCelsius, conditions }
// 费用 ：0（直接 fetch wttr.in 公开接口，不经过 LLM）
// 运行 ：npx tsx tests/test-tool.e2e.ts
// ============================================================================
import { customerTool } from "../src/mastra/tools/customerTool.ts";

const customerId = "Shanghai";

process.stdout.write(`customerTool(${JSON.stringify(customerId)})  `);
const out: any = await customerTool.execute({ customerId: customerId });

if (out && typeof out.ssn === "string") {
  console.log(`✅  ${out.ssn}`);
  process.exit(0);
} else {
  console.log(`❌  return=${JSON.stringify(out).slice(0, 200)}`);
  process.exit(1);
}
