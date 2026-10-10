// ============================================================================
// Simple e2e test · timeTravelWorkflows.ts
//
// 流程：
//   ① 首次 start()：订单 [ 鼠标×1 ￥200 + 键盘×1 ￥300 ]（共 2 件 → 9 折 → VAT8% → ￥486）
//   ② run.timeTravel({ step: 'place-order-step', inputData: 新订单 })
//       回退到 step1，新订单数量改到 5 件 → 8 折
//   断言：两次输出的 totalPrice/折扣 计算正确，且 version 从 1→2 递增
//
// 运行 ：npx tsx tests/test-time-travel-workflow.e2e.ts
// ============================================================================
import { Mastra } from "@mastra/core/mastra";
import { timeTravelWorkflow } from "../src/mastra/workflows/timeTravelWorkflows";

const mastra = new Mastra({
  workflows: { timeTravelWorkflow },
});
const wf = mastra.getWorkflow("timeTravelWorkflow");
const runId = `tt-${Date.now()}`;

// helpers：金额四舍五入到分
const round2 = (n: number) => Math.round(n * 100) / 100;

// ①—————————————————————————————————————————— 首次下单：鼠标1 + 键盘1 = 2件（9折）
const itemsV1 = [
  { sku: "MOUSE-01",  unitPrice: 200, qty: 1 },
  { sku: "KEYBD-01",  unitPrice: 300, qty: 1 },
];
const subtotalV1 = 200 * 1 + 300 * 1;       // ￥500
const discountV1 = 0.90;
const expectedTotalV1 = round2(subtotalV1 * discountV1 * 1.08); // 500 * 0.9 * 1.08 = 486

const t0 = Date.now();
const firstRun = await wf.createRun({ runId });
const firstResult: any = await firstRun.start({
  inputData:   { items: itemsV1 },
  initialState: { version: 0 },
  outputOptions: { includeState: true },
});
console.log(`① first.start (${Date.now() - t0}ms)  status=${firstResult.status}`);
console.log(`   version            =`, firstResult?.resultState?.version ?? firstResult?.state?.version);
console.log(`   totalPrice         =`, firstResult?.result?.totalPrice, ` (expected=${expectedTotalV1})`);
console.log(`   invoiceNo          =`, firstResult?.result?.invoiceNo);
console.log(`   orderId            =`, firstResult?.result?.orderId);

if (
  firstResult?.status !== "success" ||
  round2(firstResult?.result?.totalPrice ?? NaN) !== expectedTotalV1
) {
  console.error(`❌ FAIL  V1 结果不符合预期：status=${firstResult?.status} total=${firstResult?.result?.totalPrice}  expected=${expectedTotalV1}`);
  console.error(JSON.stringify(firstResult, null, 2).slice(0, 1200));
  process.exit(1);
}
const orderIdV1 = firstResult.result.orderId;

// ②—————————————————————————————————————————— TimeTravel：回退到 step1，改订单为 5 件（8折）
const itemsV2 = [
  { sku: "MOUSE-01", unitPrice: 200, qty: 3 },   // ￥600
  { sku: "KEYBD-01", unitPrice: 300, qty: 2 },   // ￥600
];                                                   // 合计 ￥1200 → 8折 → *1.08
const subtotalV2 = 200 * 3 + 300 * 2;
const discountV2 = 0.80;
const expectedTotalV2 = round2(subtotalV2 * discountV2 * 1.08);

const t1 = Date.now();
const ttRun = await wf.createRun({ runId });            // ← 同一个 runId！
const ttResult: any = await ttRun.timeTravel({
  step: "place-order-step",                              // ← 回退到 step1（字符串 step.id）
  inputData: { items: itemsV2 },                         // ← 替换 step1 输入
  initialState: { version: 1 },                          // ← 重设 state，相当于「第二次草稿」
  outputOptions: { includeState: true },
});
console.log(`\n② timetravel (${Date.now() - t1}ms)   status=${ttResult.status}`);
console.log(`   version            =`, ttResult?.resultState?.version ?? ttResult?.state?.version);
console.log(`   totalPrice         =`, ttResult?.result?.totalPrice, ` (expected=${expectedTotalV2})`);
console.log(`   invoiceNo          =`, ttResult?.result?.invoiceNo);
console.log(`   orderId 不同？      =`, ttResult?.result?.orderId !== orderIdV1 ? `✅ 不同（重新下单了，orderId=${ttResult?.result?.orderId}）` : `⚠️ 仍是 ${orderIdV1}`);

const ok =
  ttResult?.status === "success" &&
  round2(ttResult?.result?.totalPrice ?? NaN) === expectedTotalV2 &&
  (ttResult?.resultState?.version ?? ttResult?.state?.version) === 2;

console.log(
  ok
    ? `\n✅ PASS  TimeTravel 回退成功：V1(￥${expectedTotalV1} 9折) → V2(￥${expectedTotalV2} 8折)，version=2`
    : `\n❌ FAIL  ttResult=${JSON.stringify(ttResult, null, 2).slice(0, 2000)}`
);
process.exit(ok ? 0 : 1);
