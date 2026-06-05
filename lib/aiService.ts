import { ParseRuleConfig } from "./types";
import { matchExamples, getAllExampleDescriptions, examples as allExamples, RefExample } from "./referenceExamples";

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const RULE_GENERATION_SYSTEM_PROMPT = `你是一个顶尖的物流数据解析专家。你的任务是根据文件内容的预览，生成一套精准的 JSON 格式解析规则配置。

## 核心原则：按外部编码聚合出库单

**最重要的规则**：每条出库单必须按「外部编码」（单据号/配送单号/调拨单号/汇总单号）聚合。
- 同一个外部编码下的多行 SKU 属于同一条出库单，共享一组收货信息
- 一个文件可能包含多个外部编码，每个编码对应一条出库单
- 收货人信息（门店/姓名/电话/地址）只需提取一次，服务于该编码下所有 SKU 行

## 目标字段说明

| 字段 | 含义 | 说明 |
|------|------|------|
| externalCode | 外部编码/单据号 | 聚合依据 |
| storeName | 收货门店 | 门店全称 |
| receiverName | 收货人/联系人 | |
| receiverPhone | 联系电话 | |
| receiverAddress | 收货地址 | |
| skuCode | SKU物品编码 | 必填 |
| skuName | SKU物品名称 | |
| skuQuantity | SKU数量 | |
| skuSpec | SKU规格型号 | 如"750ml*6瓶/件" |
| remark | 备注 | |

## 解析模式判定树（按优先级）

1. **卡片式** → 有 "▶" 标记分割，使用 cardBoundary，字段优先用 regex
2. **矩阵转置** → 门店列在右侧横向排列，SKU 行在左
3. **标准表格+外部编码聚合** ⭐最常用 → 有单据号列，同号多行
4. **标准表格+单店** → 全文件只有一个收货方，用 tailExtraction 提取头部/尾部信息
5. **多Sheet分门店** → 每个 Sheet 一个门店名，Sheet 内是标准表格
6. **PDF/Word纯文本** → 无分隔符，需用正则逐行提取

## 输出规范
- 只返回纯 JSON，不要 markdown、不要解释
- sourceColumn 从 0 开始计数
- 数量字段 transform="number"，文本字段 transform="trim"
- **收货人信息如果在数据区外，必须启用 tailExtraction**，格式如下：
  tailExtraction: { "enabled": true, "patterns": [{ "field": "storeName", "regex": "收货机构[：:\\s]+(.+?)(?:\\s+供货|$)", "group": 1 }, ...] }
- 正则用原始字符串，JSON 中转义为 \\s、\\d 等
- tailExtraction 的 regex 要兼容冒号(:：)和空格两种分隔方式`;

function buildFewShotSection(examples: RefExample[]): string {
  if (examples.length === 0) return "";

  let text = "\n\n## 参考示例（以下为相似文件的正确解析规则，请严格参考其格式和字段）\n\n";
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    text += `### 示例${i + 1}：${ex.name}\n`;
    text += `场景：${ex.description}\n`;
    text += `文件结构示例：\n\`\`\`\n${ex.sampleContent}\n\`\`\`\n`;
    text += "对应的正确解析规则：\n```json\n";
    text += JSON.stringify(ex.config, null, 2);
    text += "\n```\n\n";
  }
  return text;
}

export async function generateRuleFromFileContent(
  fileContent: string,
  fileType: string,
  fileName: string
): Promise<{ config: ParseRuleConfig; name: string; confidence: "high" | "medium" | "low" }> {
  if (!AI_API_KEY) {
    console.error("DEEPSEEK_API_KEY 未配置");
    throw new Error("AI 服务未配置，请设置 DEEPSEEK_API_KEY 环境变量");
  }

  // 智能匹配参考示例，作为 few-shot 发给 AI
  const matchedExamples = matchExamples(fileContent, fileType);
  console.log(`[AI] 文件 ${fileName} 匹配到 ${matchedExamples.length} 个参考示例:`, matchedExamples.map(e => e.name));
  const allDescriptions = getAllExampleDescriptions(fileType);

  // 始终发送所有同类型示例的完整配置
  const allTypeExamples = allExamples.filter(e => e.fileType === fileType);
  const fewShot = buildFewShotSection(allTypeExamples);

  const userPrompt = `请分析以下文件并生成解析规则配置。

文件名: ${fileName}
文件类型: ${fileType}

已知的文件类型模式（供参考）：
${allDescriptions}

${fewShot}

文件内容预览（前8000字符）:
\`\`\`
${fileContent.substring(0, 8000)}
\`\`\`

## 关键要求
1. 对比你的文件和参考示例的结构，判断属于哪种模式
2. 生成的 JSON 格式必须和参考示例中的 **完全一致**
3. 准确设置 skipHeaderRows（数据区前总行数）和 skipFooterRows（数据区后总行数）
4. 收货人/电话/地址/storeName/externalCode 如果在数据区外，**必须用 tailExtraction**，参考示例中的格式
5. 聚合场景：有单据号/汇总单号列且同一编码有多行SKU，设 aggregationKey="externalCode"
6. 多Sheet文件，sheetIndices 留空数组 []
7. **只返回纯 JSON，不要 markdown 代码块**`;

  const response = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: RULE_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API 错误:", response.status, errorText);
    throw new Error(`AI 服务调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 返回内容为空");
  }

  let parsed: ParseRuleConfig;
  try {
    const cleanContent = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (parseErr) {
    console.error("AI 返回 JSON 解析失败:", parseErr);
    throw new Error("AI 返回的规则配置格式无效");
  }

  const name = fileName.replace(/\.(xlsx|xls|docx|pdf)$/i, "").slice(0, 30);

  return {
    config: parsed,
    name: `AI生成-${name}`,
    confidence: matchedExamples.length > 0 ? "high" : "medium",
  };
}
