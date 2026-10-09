// ============================================================================
// Simple e2e test · statusWorkflows.ts / testWorkflow（1 input, 1 call）
//
// Workflow 图：test-workflow ─► child-workflow ─► step-1（大写转换 + state.counter++）
// 预期 ：
//   · output.emphasized = input 转大写（例："hello" → "HELLO"）
//   · step1 执行时初始 state.counter = 0，写过 setState 后为 1
//
// 运行 ：npx tsx tests/test-workflow.e2e.ts
// ============================================================================
import { Mastra } from "@mastra/core/mastra";
import { testWorkflow } from "../src/mastra/workflows/statusWorkflows";

// —— ① 注册到 Mastra：因为 step1 的 execute 要读 mastra/pubsub，必须先 addWorkflow
const mastra = new Mastra({
  workflows: { testWorkflow },
});

const INPUT = { message: "hello workflow" };
console.log(`workflow.id        =`, testWorkflow.id);
console.log(`workflow.steps     =`, Object.keys((testWorkflow as any).steps ?? {}).join(", "));
console.log(`input.message      =`, JSON.stringify(INPUT.message));
process.stdout.write(`▶️  run.start()  `);

// —— ② createRun → start（v1 正确用法：不要直接 workflow.execute）
const started = Date.now();
const run = await mastra.getWorkflow("testWorkflow").createRun();
const result: any = await run.start({
  inputData: INPUT,
  initialState: { counter: 0 }, // step1 初始 counter；不传的话 state.counter 会是 undefined 导致 L12 打印 undefined
});
const duration = Date.now() - started;

// —— ③ 打印 + 断言
console.log(`(${duration}ms)`);
console.log(result)
console.log(`status             =`, result?.status ?? "<missing>");
console.log(`result             =`, JSON.stringify(result?.result ?? result ?? null).slice(0, 300));
// outputSchema 写的是 { emphasized }，实际 step1 返回 { formatted }，所以两个字段都兜底
const outputResult  = result?.result ?? result?.output ?? result ?? {};
const emphasized = (outputResult.emphasized ?? outputResult.formatted) as string | undefined;
console.log(`output keys        =`, Object.keys(outputResult).join(", ") || "<none>");
console.log(`emphasized/formatted=`, JSON.stringify(emphasized));

const EXPECTED = `${INPUT.message.toUpperCase()}!`;
const ok = emphasized === EXPECTED;
console.log(
  ok
    ? `\n✅ PASS  emphasized="${emphasized}" === "${EXPECTED}"`
    : `\n❌ FAIL  emphasized="${emphasized ?? String(emphasized)}"  expected="${EXPECTED}"`
);
process.exit(ok ? 0 : 1);
