// ============================================================================
// 工作流 · 暂停 / 恢复 示例（Mastra v1 suspend / resume）
//
// 场景：模拟一篇文章的「草稿 → 人工审批 → 发布」流程
//   step1 · 生成草稿（记录草稿内容 + 初始 counter）后，调用 ctx.suspend() 进入
//           SUSPENDED 状态，等待外部「审批决策」
//   resumeData · 审批决策：{ approved: boolean; reviewer: string }
//   step2 · 收到审批结果：通过 → 打上时间戳 + 文案「已发布」；驳回 → 返回拒绝理由
//
// 关键 API（写在 execute 参数 ctx 里）：
//   ctx.suspend(suspendPayload?, { resumeLabel? })
//     立即中断 workflow 并返回 status = 'suspended'；再次 run.resume() 就会
//     从「下一行」继续执行。
//   ctx.resumeData          resume 传进来的 data（对应 resumeSchema）
//   ctx.resume?.resumePayload  同上（冗余字段，二者都能拿到）
//   ctx.suspendData         上次 suspend 时传入的 payload（对应 suspendSchema）
//
// 如何调用（见 tests/test-pause-resume-workflow.e2e.ts）：
//   const run1 = await wf.createRun({ runId });
//   const suspended = await run1.start({ inputData, initialState }); // → 'suspended'
//   const run2 = await wf.createRun({ runId });  // ← 相同 runId！
//   const result    = await run2.resume({ resumeData: { approved: true, reviewer: 'Alice' } });
// ============================================================================
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

// 审批 resume 输入：是否通过 + 审批人
const ApprovalSchema = z.object({
  approved: z.boolean(),
  reviewer: z.string().min(1, "reviewer 不能为空"),
  comment:  z.string().optional(),
});

// suspend 时带出来的「待审批内容」方便外部 UI 展示
const PendingApprovalSchema = z.object({
  title:   z.string(),
  summary: z.string(),
});

// -------------- step1：生成草稿 → 等待审批 → suspend --------------
const draftStep = createStep({
  id: "pr-approval-step",
  inputSchema:   z.object({ title: z.string(), content: z.string() }),
  outputSchema:  z.object({
    publishedAt: z.string().optional(),        // 发布时间（审批通过才会有）
    status:      z.enum(["published", "rejected", "draft"]),
    message:     z.string(),
    draft:       PendingApprovalSchema,
    reviewedBy:  z.string().optional(),
  }),
  stateSchema:   z.object({ counter: z.number() }),
  suspendSchema: PendingApprovalSchema,   // 声明后，suspend(x) 传参自动 zod 校验
  resumeSchema:  ApprovalSchema,          // 声明后，resume({ resumeData }) 自动 zod 校验
  execute: async ({ inputData, state, setState, suspend, suspendData, resumeData }) => {
    // 1) 生成草稿摘要（任何情况先走这一步，counter +1 记录进入过审批）
    setState({ ...state, counter: state.counter + 1 });

    const summary = inputData.content.slice(0, 40) + (inputData.content.length > 40 ? "…" : "");
    const draft = { title: inputData.title, summary };

    if (!resumeData) {
      // 首次执行：挂起，等待人工审批（把 draft 丢给外部系统）
      await suspend(draft, { resumeLabel: "waiting-approval" });
      // ⚠️ Mastra 约定：suspend 后 execute 必须立即 return
      // 下次 resume() 触发时，引擎会再次调用 execute()，此时 resumeData 不为空
      return {
        status:  "draft" as const,
        message: "等待审批中...",
        draft,
      };
    }

    // ————— 以下代码仅在 resume 之后执行 —————
    // resumeData 在「resumeSchema 通过校验」后会被回填，suspendData 就是之前写的 draft
    const approval = resumeData;
    setState({ ...state, counter: state.counter + 1 });

    if (approval.approved) {
      return {
        publishedAt: new Date().toISOString(),
        status:      "published" as const,
        message:     `已由 ${approval.reviewer} 审批发布${approval.comment ? `（备注：${approval.comment}）` : ""}`,
        draft,
        reviewedBy:  approval.reviewer,
      };
    }

    return {
      status:     "rejected" as const,
      message:    `被 ${approval.reviewer} 驳回${approval.comment ? `：${approval.comment}` : ""}`,
      draft,
      reviewedBy: approval.reviewer,
    };
  },
});

// -------------- workflow：就一步（示例保持简单） --------------
export const pauseResumeWorkflow = createWorkflow({
  id: "pause-resume-workflow",
  name: "Pause / Resume 示例 · 审批流",
  inputSchema: z.object({
    title:   z.string().min(1),
    content: z.string().min(1),
  }),
  outputSchema: z.object({
    publishedAt: z.string().optional(),
    status:      z.enum(["published", "rejected"]),
    message:     z.string(),
    reviewedBy:  z.string(),
  }),
})
  .then(draftStep)
  .commit();
