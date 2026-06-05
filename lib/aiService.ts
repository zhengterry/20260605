import { ParseRule, ParseRuleConfig } from "./types";

/**
 * AI 服务 - DeepSeek API 封装
 * 用于分析文件内容并生成解析规则
 */

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const AI_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const RULE_GENERATION_SYSTEM_PROMPT = `你是一个顶尖的物流数据解析专家。你的任务是根据文件内容的预览，生成一套精准的 JSON 格式解析规则配置。

## 核心原则：按外部编码聚合出库单

**最重要的规则**：每条出库单必须按「外部编码」（单据号/配送单号/调拨单号/汇总单号）聚合。
- 同一个外部编码下的多行 SKU 属于同一条出库单，共享一组收货信息
- 一个文件可能包含多个外部编码，每个编码对应一条出库单
- 收货人信息（门店/姓名/电话/地址）只需提取一次，服务于该编码下所有 SKU 行

## 规则配置接口（ParseRuleConfig）

\`\`\`typescript
interface ParseRuleConfig {
  dataSource: {
    sheetIndices?: number[];   // 空数组 = 解析所有Sheet
  };
  rowProcessing: {
    skipHeaderRows: number;     // 跳过头部行数（标题、元信息、空行、表头）
    skipFooterRows: number;     // 跳过尾部行数（合计、制单人、签名区等）
    cardBoundary?: {            // 卡片式布局标志
      markerPattern: string;    // 卡片边界正则，如 "^▶ 调拨记录"
      includeMarker: boolean;
    };
    aggregationKey: string;     // 聚合字段名。填空字符串=不聚合，填 "externalCode"=按外部编码将多行SKU归入同一单
  };
  fieldMappings: Array<{
    targetField: string;        // 目标字段名
    sourceType: "column" | "static" | "regex";  // 列索引 / 固定值 / 正则提取
    sourceColumn?: number;      // 列索引（从0开始）
    staticValue?: string;
    regexPattern?: string;      // 提取头部信息的正则
    regexGroup?: number;        // 捕获组编号（0=完整匹配，1=第一个括号）
    transform?: "trim" | "number";
  }>;
  matrixTranspose?: {           // 门店列横向转纵向
    enabled: boolean;
    storeColumns: string[];     // 门店列名，如 ["银泰","金银潭"]
    skuNameColumn: number;      // SKU名称所在列索引
    skuCodeColumn: number;      // SKU编码所在列索引
    skuSpecColumn?: number;     // 规格列索引
    quantityColumn?: number;    // 数量列索引（不指定则取交叉点值）
  };
  tailExtraction?: {            // 尾部信息提取（收货人等在数据区下方）
    enabled: boolean;
    patterns: Array<{
      field: string;            // 目标字段
      regex: string;            // 正则表达式（带捕获组）
      group: number;            // 捕获组编号
    }>;
  };
}
\`\`\`

## 目标字段（targetField）说明

| 字段 | 含义 | 说明 |
|------|------|------|
| externalCode | 外部编码/单据号 | 聚合依据，一个编码 = 一个出库单 |
| storeName | 收货门店 | 门店全称 |
| receiverName | 收货人/联系人 | |
| receiverPhone | 联系电话 | |
| receiverAddress | 收货地址 | |
| skuCode | SKU物品编码 | 每一行必须有的字段 |
| skuName | SKU物品名称 | |
| skuQuantity | SKU数量 | 出库/发货数量 |
| skuSpec | SKU规格型号 | 如"750ml*6瓶/件" |
| remark | 备注 | |

## 解析模式判定树

按优先级从高到低判断文件属于哪种模式：

1. **卡片式** → 文件包含明显分割标志（如 "▶ 调拨记录 #1"、"▶ 调拨记录 #2"），且每张卡片内自成一套（门店+SKU）。使用 cardBoundary，字段映射优先用 regex（门店/收货人）和 column（SKU物品编码/名称/规格/数量）

2. **矩阵转置** → 表头最右侧有多个门店列名（如"银泰""金银潭""金桥"），每个SKU行在对应门店列有数值标记。使用 matrixTranspose

3. **标准表格+按外部编码聚合** ⭐最常用 → 数据行包含外部编码列，同一编码有多行SKU。设置 aggregationKey: "externalCode"，skipHeaderRows 跳过标题/空行/表头等，skipFooterRows 跳过合计行和尾部信息

4. **标准表格+单条订单** → 整个数据区只有一个收货方（如配送发货单）。aggregationKey 留空，收货信息从 tailExtraction 提取

5. **纯文本** → PDF/Word 文件，行内无分隔符，需用正则从每行提取字段。如 "1饮品类ZBWP0001茶语柠听紫苏风味糖浆750ml*6瓶/件件2"

## 输出规范

- 只返回纯 JSON，不要 markdown 代码块、不要解释文字
- 字段映射的 sourceColumn 必须准确对应文件中的列位置
- 数量字段 transform 设为 "number"
- 文本字段 transform 设为 "trim"
- regex 字段用于从标题行提取门店名、从信息行提取联系人等`;

export async function generateRuleFromFileContent(
  fileContent: string,
  fileType: string,
  fileName: string
): Promise<{ config: ParseRuleConfig; name: string; confidence: "high" | "medium" | "low" }> {
  if (!AI_API_KEY) {
    console.error("DEEPSEEK_API_KEY 未配置");
    throw new Error("AI 服务未配置，请设置 DEEPSEEK_API_KEY 环境变量");
  }

  const userPrompt = `请分析以下文件并生成解析规则配置。

文件名: ${fileName}
文件类型: ${fileType}

文件内容预览（前8000字符）:
\`\`\`
${fileContent.substring(0, 8000)}
\`\`\`

具体规则：
1. 定位表头行和数据起始行，准确设置 skipHeaderRows 和 skipFooterRows
2. 如果数据包含「单据号/配送单号/汇总单号」列，必须设 aggregationKey 为 "externalCode"，同一单据号下的多行 SKU 自动聚合为一个出库单
3. 收货人/联系电话/地址如果在数据区外（首部或尾部），放入 tailExtraction
4. 多 Sheet 的 Excel，sheetIndices 留空即可
5. 只返回 JSON，不要任何额外文字`;

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
    // 去除可能的 markdown 代码块标记
    const cleanContent = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (parseErr) {
    console.error("AI 返回 JSON 解析失败:", parseErr);
    throw new Error("AI 返回的规则配置格式无效");
  }

  // 生成规则名称
  const name = fileName.replace(/\.(xlsx|xls|docx|pdf)$/i, "").slice(0, 30);

  return {
    config: parsed,
    name: `AI生成-${name}`,
    confidence: "medium",
  };
}
