// ============================================================================
// Simple e2e test · pauseResumeWorkflows.ts（1 suspend + 1 resume 调用）
//
// 流程：
//   ① run.start()  → 走到 step.suspend() → status=suspended, suspendPayload = {title,summary}
//   ② run.resume({ resumeData: {approved:true, reviewer:'Alice'} })
//                  → status=success, result.status='published'
//
// 运行 ：npx tsx tests/test-pause-resume-workflow.e2e.ts
// ============================================================================
import { Mastra } from "@mastra/core/mastra";
import { pauseResumeWorkflow } from "../src/mastra/workflows/pauseResumeWorkflows";

const mastra = new Mastra({
  workflows: { pauseResumeWorkflow },
});

// ①—————————————————————————————————————————— 启动 → 挂起
const runId = `demo-${Date.now()}`;
const wf = mastra.getWorkflow("pauseResumeWorkflow");

const runStartedAt = Date.now();
const suspendRun = await wf.createRun({ runId });
const suspended: any = await suspendRun.start({
  inputData:   { title: "2026 Q4 OKR", content: "Mastra 集成 AI Gateway、结构化输出、工作流暂停/恢复..." },
  initialState: { counter: 0 },
});

console.log(`① start → status   = ${suspended?.status}  (${Date.now() - runStartedAt}ms)`);
console.log(`  suspendPayload    =`, JSON.stringify(suspended?.suspendPayload ?? suspended?.payload));
console.log(`  counter(控制台)   : 首次 start 内 step1 会 setState({counter: 0→1})`);

if (suspended?.status !== "suspended") {
  console.error(`❌ FAIL  预期 status='suspended' 实际='${suspended?.status}'`);
  process.exit(1);
}
// Mastra 把 suspendPayload 按 stepId 包一层：{ [stepId]: userPayload }，拆一下拿用户态数据
const suspendAll = suspended?.suspendPayload ?? suspended?.payload ?? {};
const draft =
  suspendAll["pr-approval-step"] ??
  (typeof suspendAll === "object" && suspendAll ? Object.values(suspendAll)[0] : null) ??
  suspendAll;
if (!draft || draft?.title !== "2026 Q4 OKR") {
  console.error(`❌ FAIL  suspendPayload.title 不匹配: ${JSON.stringify(draft)}`);
  process.exit(1);
}

// ②—————————————————————————————————————————— 恢复 → 完成
const resumedAt = Date.now();
const resumeRun = await wf.createRun({ runId });   // 必须同一个 runId
const result: any = await resumeRun.resume({
  resumeData: { approved: true, reviewer: "Alice", comment: "季度计划已对齐" },
});

console.log(`② resume → status  = ${result?.status}  (${Date.now() - resumedAt}ms)`);
console.log(`  result.result     =`, JSON.stringify(result?.result ?? result).slice(0, 320));

const ok =
  result?.status === "success" &&
  result?.result?.status === "published" &&
  result?.result?.reviewedBy === "Alice" &&
  typeof result?.result?.publishedAt === "string";

console.log(
  ok
    ? "\n✅ PASS  暂停→审批通过→已发布  流程跑通 ✨"
    : `\n❌ FAIL  result=${JSON.stringify({ status: result?.status, ...(result?.result ?? {}) }).slice(0, 320)}`
);
process.exit(ok ? 0 : 1);
