// ============================================================================
// 工作流 · TimeTravel（时光倒流 / 回退到指定 step 重跑）示例
//
// 场景：采购 3 步审批流
//   step1 · 下订单（items: [{sku, unitPrice, qty}]）→ 生成 orderId + items 快照
//           写 state.order / state.subtotalBeforeDiscount
//   step2 · 计算价格（折扣规则：满2件9折，满5件8折，VAT 8%）→ totalPrice
//           写 state.totalPrice / state.discountPercent
//   step3 · 生成发票（拿 step1.orderId + step2.totalPrice → invoiceNo + issuedAt）
//
// TimeTravel 用法（Run 层 API）：
//   const run = await wf.createRun({ runId });
//   const r1  = await run.start({ inputData, initialState });           // → success
//   const run2= await wf.createRun({ runId });                          // 同一 runId
//   const r2  = await run2.timeTravel({                                 // 回退到 step1 重跑
//     step: 'place-order-step',
//     inputData: { items: [ /* 新订单内容 */ ] },   // ← 可选：替换 step1 重新执行的输入
//     initialState: { version: 2 },                    // ← 可选：重设整个 workflow state
//   });
//
// ⚠️ 注意点：
//   · timeTravel() 依赖 storage snapshot（默认 InMemoryStore 也支持，只是重启后失效）
//   · 传 step: '<stepId>' 可以是字符串，会按 '.' 自动切分多级
//   · 回退后被跳过的 step（step2/step3）旧 snapshot 会被新执行结果覆盖
//   · 'step' 参数必须指向被 commit 进 workflow 的 step.id，不是变量名
// ============================================================================
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

// ---------------- schema ----------------
const ItemSchema = z.object({
  sku:       z.string().min(1),
  unitPrice: z.number().positive(),
  qty:       z.number().int().positive(),
});

// ---------------- step1：下订单 ----------------
const placeOrderStep = createStep({
  id: "place-order-step",
  inputSchema:  z.object({ items: z.array(ItemSchema).min(1, "至少需要 1 件商品") }),
  outputSchema: z.object({
    orderId:             z.string(),
    items:               z.array(ItemSchema),
    subtotalBeforeDiscount: z.number(),
  }),
  stateSchema: z.object({
    version:             z.number(),                      // 每次重跑版本号 +1
    orderId:             z.string().optional(),
    subtotalBeforeDiscount: z.number().optional(),
    discountPercent:     z.number().optional(),
    totalPrice:          z.number().optional(),
    invoiceNo:           z.string().optional(),
  }),
  execute: async ({ inputData, state, setState }) => {
    const orderId = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString().padStart(3, "0")}`;
    const subtotalBeforeDiscount = inputData.items.reduce(
      (sum, it) => sum + it.unitPrice * it.qty, 0
    );
    setState({
      ...state,
      version: (state.version ?? 0) + 1,
      orderId,
      subtotalBeforeDiscount,
      // 清掉下游可能已有的旧值（timeTravel 回退时要避免读到上一次 step2/3 的结果）
      discountPercent: undefined,
      totalPrice:      undefined,
      invoiceNo:       undefined,
    });
    return { orderId, items: inputData.items, subtotalBeforeDiscount };
  },
});

// ---------------- step2：计算价格 ----------------
const calcPriceStep = createStep({
  id: "calc-price-step",
  inputSchema:  z.object({
    orderId:             z.string(),
    items:               z.array(ItemSchema),
    subtotalBeforeDiscount: z.number(),
  }),
  outputSchema: z.object({ orderId: z.string(), discountPercent: z.number(), totalPrice: z.number() }),
  stateSchema: placeOrderStep.stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const qtySum = inputData.items.reduce((s, it) => s + it.qty, 0);
    const discountPercent =
      qtySum >= 5 ? 0.80 :
      qtySum >= 2 ? 0.90 :
                    1.00;
    const subtotal = inputData.subtotalBeforeDiscount * discountPercent;
    const totalPrice = Math.round(subtotal * 1.08 * 100) / 100;   // VAT 8%

    setState({ ...state, discountPercent, totalPrice });
    return { orderId: inputData.orderId, discountPercent, totalPrice };
  },
});

// ---------------- step3：生成发票 ----------------
const issueInvoiceStep = createStep({
  id: "issue-invoice-step",
  inputSchema: z.object({
    orderId:         z.string(),
    discountPercent: z.number(),
    totalPrice:      z.number(),
  }),
  outputSchema: z.object({
    invoiceNo:  z.string(),
    issuedAt:   z.string(),
    orderId:    z.string(),
    totalPrice: z.number(),
  }),
  stateSchema: placeOrderStep.stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const invoiceNo = `INV-${inputData.orderId.replace(/^PO-/, "")}`;
    const issuedAt  = new Date().toISOString();
    setState({ ...state, invoiceNo });
    return { invoiceNo, issuedAt, orderId: inputData.orderId, totalPrice: inputData.totalPrice };
  },
});

// ---------------- workflow ----------------
export const timeTravelWorkflow = createWorkflow({
  id: "time-travel-workflow",
  name: "TimeTravel 示例 · 采购审批流",
  inputSchema:  z.object({ items: z.array(ItemSchema).min(1) }),
  outputSchema: z.object({
    invoiceNo:  z.string(),
    issuedAt:   z.string(),
    orderId:    z.string(),
    totalPrice: z.number(),
  }),
  stateSchema: z.object({
    version: z.number(),
    orderId: z.string().optional(),
    subtotalBeforeDiscount: z.number().optional(),
    discountPercent: z.number().optional(),
    totalPrice: z.number().optional(),
    invoiceNo:  z.string().optional(),
  }),
})
  .then(placeOrderStep)
  .then(calcPriceStep)
  .then(issueInvoiceStep)
  .commit();
