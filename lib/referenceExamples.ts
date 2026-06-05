/**
 * AI 解析规则参考库
 * 每个数据文件对应一个标准规则 + 文件内容示例
 * 调用 AI 时自动匹配最相似的规则作为 few-shot 示例
 */

export interface RefExample {
  name: string;
  fileType: "excel" | "word" | "pdf";
  description: string;
  features: string[];
  /** 文件内容示例片段（用于 AI 参考） */
  sampleContent: string;
  /** 正确的解析规则配置 */
  config: any;
}

export const examples: RefExample[] = [
  // ======== 文件1: 配送发货单 ========
  {
    name: "配送发货单-单店",
    fileType: "excel",
    description: "单店配送发货单。前4行=标题+机构信息+状态+表头，后4行=合计+单据号+收货人+备注。10行×42列",
    features: [
      "配送发货单", "收货机构", "供货机构", "黎明屯",
      "单据状态", "发货操作时间", "分拣状态", "复审状态",
      "物品编码", "物品名称", "规格型号", "发货数量",
      "单据号", "合计", "收货人", "收货电话", "收货地址",
    ],
    sampleContent: `Row0: 黎明屯铁锅炖配送中心-配送发货单PS2512220005001
Row1: 收货机构 | 黎明屯铁锅炖（海口龙湖天街店） | 供货机构 | 黎明屯铁锅炖配送中心
Row2: 发货操作时间 | 单据状态 | 待发货 | 分拣状态 | 待分拣 | 复审状态 | 未复审
Row3: [表头] 序号 | 物品分类 | 物品编码 | 物品名称 | 品牌 | 规格型号 | ... | 发货数量(col14)
Row4: 1 | 食材 | LMTZ0160009 | 成品锅包肉(含汁) | | 1kg*10袋*箱 | ... | 20
Row5: 2 | 工服 | LMTZ1040002 | 大花工帽鸭舌帽 | | 1*1顶 | ... | 10
Row6: 合计 | | | | | | | 30 | 30 | 30
Row7: 单据号 | PS2512220005001 | 上游单据 | DH2512220006
Row8: 收货人 | 张锦峰 | | 收货电话 | 18533660999 | | 收货地址 | 海南省海口市龙华区...
Row9: 备注 | | 收货机构备注 | | 收货人签字 |`,
    config: {
      dataSource: { sheetIndices: [0] },
      rowProcessing: { skipHeaderRows: 4, skipFooterRows: 4, aggregationKey: "" },
      fieldMappings: [
        { targetField: "skuCode",     sourceType: "column", sourceColumn: 2,  transform: "trim" },
        { targetField: "skuName",     sourceType: "column", sourceColumn: 3,  transform: "trim" },
        { targetField: "skuSpec",     sourceType: "column", sourceColumn: 5,  transform: "trim" },
        { targetField: "skuQuantity", sourceType: "column", sourceColumn: 14, transform: "number" },
      ],
      tailExtraction: {
        enabled: true,
        patterns: [
          { field: "storeName",       regex: "收货机构[：:\\s]+(.+?)(?:\\s+供货|$)", group: 1 },
          { field: "externalCode",    regex: "单据号[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverName",    regex: "收货人[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverPhone",   regex: "收货电话[：:\\s]+([\\d-]+)", group: 1 },
          { field: "receiverAddress", regex: "收货地址[：:\\s]+(.+?)(?:\\s+null|\\s+收货|$)", group: 1 },
        ],
      },
    },
  },

  // ======== 文件2: 多门店分Sheet出库单 ========
  {
    name: "多门店分Sheet出库单",
    fileType: "excel",
    description: "每个Sheet=一个门店出库单。Sheet名含店名。每个Sheet: 标题(R0)+日期(R1)+空行(R2)+表头(R3)+数据行+合计+收货信息",
    features: [
      "出库单", "出库日期", "银泰店", "金桥店", "金银潭店",
      "物品编码", "物品名称", "规格型号", "出库数量",
      "收货门店", "联系人", "联系电话", "收货地址",
    ],
    sampleContent: `Sheet名: 银泰店 (共3个Sheet: 银泰店/金桥店/金银潭店)
Row0: 尹三顺自助烤肉（银泰店）出库单
Row1: 出库日期：2026-05-30 | 仓库：武汉配送中心 | 配送方式：冷链车
Row2: [空行]
Row3: [表头] 序号 | 物品编码(col1) | 物品名称(col2) | 规格型号(col3) | 单位 | 出库数量(col5) | 仓库 | 备注
Row4: 1 | ZBWP0001 | 茶语柠听紫苏风味糖浆 | 750ml*6瓶/件 | 件 | 3 | 武汉配送中心
Row5: 2 | ZBWP0015 | 寨寨香肠片 | 2.5kg*6包/件 | 件 | 5 | 武汉配送中心
...数据区结束...
合计行: 合计 | | | | | 29
收货门店：银泰店 | 联系人：王店长 | 联系电话：13900001111 | 收货地址：汉口解放大道688号银泰百货B1层`,
    config: {
      dataSource: { sheetIndices: [] },
      rowProcessing: { skipHeaderRows: 4, skipFooterRows: 3, aggregationKey: "" },
      fieldMappings: [
        { targetField: "skuCode",     sourceType: "column", sourceColumn: 1, transform: "trim" },
        { targetField: "skuName",     sourceType: "column", sourceColumn: 2, transform: "trim" },
        { targetField: "skuSpec",     sourceType: "column", sourceColumn: 3, transform: "trim" },
        { targetField: "skuQuantity", sourceType: "column", sourceColumn: 5, transform: "number" },
      ],
      tailExtraction: {
        enabled: true,
        patterns: [
          { field: "storeName",       regex: "收货门店[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverName",    regex: "联系人[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverPhone",   regex: "联系电话[：:\\s]+([\\d-]+)", group: 1 },
          { field: "receiverAddress", regex: "收货地址[：:\\s]+(.+?)(?:\\s|$)", group: 1 },
        ],
      },
    },
  },

  // ======== 文件3: 欢乐牧场模板(矩阵转置) ========
  {
    name: "矩阵转置-门店库存分配",
    fileType: "excel",
    description: "SKU行在左(仓库+名称+编码+库存)，门店列在右横向排列(银泰/金银潭/金桥/门店B/门店D/下单后结余)。114行×20列，行列交叉点为分配数量",
    features: [
      "仓库名称", "货主名称", "SKU", "库存状态",
      "银泰", "金银潭", "金桥", "门店", "下单后结余",
      "在库数量", "可用数量", "分配数量", "冻结数量",
    ],
    sampleContent: `Row0: [表头] 仓库名称 | 货主名称 | SKU名称(col2) | SKU条码 | 外部商品编码 | 库存状态 | 单位 | 规格(col7) | 在库数量 | 可用数量 | ... | 银泰(col13) | 金银潭(col14) | 金桥(col15) | 门店B | 门店D | 下单后结余
Row1: 武汉汉阳仓 | 欢乐牧场 | 26/30海老盒装熟虾4KG | 07010747 | ... | 120 | 120 | ... | null | null | null | null | null | 120
Row2: 武汉汉阳仓 | 欢乐牧场 | 100g牛油火锅底料 | 05010138 | ... | 45 | 45 | ... | 1 | null | null | null | null | 44
Row3: 武汉汉阳仓 | 欢乐牧场 | 穆林农场肥牛25kg | SP03442 | ... | 40 | 40 | ... | null | 1 | null | null | null | 39`,
    config: {
      dataSource: { sheetIndices: [0] },
      rowProcessing: { skipHeaderRows: 1, skipFooterRows: 0, aggregationKey: "" },
      fieldMappings: [
        { targetField: "skuCode",   sourceType: "column", sourceColumn: 3, transform: "trim" },
        { targetField: "skuName",   sourceType: "column", sourceColumn: 2, transform: "trim" },
        { targetField: "skuSpec",   sourceType: "column", sourceColumn: 7, transform: "trim" },
      ],
      matrixTranspose: {
        enabled: true,
        storeColumns: ["银泰", "金银潭", "金桥", "门店B", "门店D"],
        skuNameColumn: 2,
        skuCodeColumn: 3,
        skuSpecColumn: 7,
      },
    },
  },

  // ======== 文件4: 湖南仓(标准表格+汇总单聚合) ========
  {
    name: "标准表格-汇总单号聚合",
    fileType: "excel",
    description: "多列标准表格，配送汇总单号(PSHZ)列聚合多行SKU。169行×31列。前2行=提示+表头",
    features: [
      "汇总单发货明细", "收货机构", "配送汇总单号", "配送单号",
      "物品行号", "物品编码", "物品名称", "规格型号", "发货数量",
      "收货人", "收货电话", "收货地址", "发货仓库",
    ],
    sampleContent: `Row0: [提示] 带有*的字段为必填项...
Row1: [表头] 收货机构(col0) | 配送汇总单号(col1) | 配送单号(col2) | 物品行号(col3) | 分类(col4) | 物品编码(col5) | 物品名称(col6) | 规格型号(col8) | ... | 发货数量(col12) | 仓库(col13) | ... | 收货人(col26) | 收货电话(col27) | 收货地址(col28)
Row2: 尹三顺自助烤肉屋（五一悦方店）| PSHZ2605290027 | PS2605290033 | 1 | 蘸料调料 | ZBWP0127 | 尹三顺秘制蘸料（特辣）| 1kg*10袋 | 1 | 湖南仓库 | ... | 邹生 | 13537459614 | 湖南省长沙市天心区坡子街216号
Row3: 尹三顺自助烤肉屋（五一悦方店）| PSHZ2605290027 | PS2605290033 | 2 | 蘸料调料 | ZBWP0144 | 尹三顺秘制蘸料（香辣）| 1kg*10袋 | 1 | 湖南仓库 | ... | 邹生 | 13537459614 | 湖南省长沙市天心区坡子街216号
Row4: 尹三顺自助烤肉屋（五一悦方店）| PSHZ2605290028 | PS2605290032 | 1 | 原切类 | ZBWP0269 | 熹厨工场猪肋排 | 15KG/件 | 2 | 湖南仓库 | ... | 邹生 | 13537459614 | 湖南省长沙市天心区坡子街216号`,
    config: {
      dataSource: { sheetIndices: [0] },
      rowProcessing: { skipHeaderRows: 2, skipFooterRows: 0, aggregationKey: "externalCode" },
      fieldMappings: [
        { targetField: "externalCode",      sourceType: "column", sourceColumn: 1,  transform: "trim" },
        { targetField: "storeName",         sourceType: "column", sourceColumn: 0,  transform: "trim" },
        { targetField: "skuCode",           sourceType: "column", sourceColumn: 5,  transform: "trim" },
        { targetField: "skuName",           sourceType: "column", sourceColumn: 6,  transform: "trim" },
        { targetField: "skuSpec",           sourceType: "column", sourceColumn: 8,  transform: "trim" },
        { targetField: "skuQuantity",       sourceType: "column", sourceColumn: 12, transform: "number" },
        { targetField: "receiverName",      sourceType: "column", sourceColumn: 26, transform: "trim" },
        { targetField: "receiverPhone",     sourceType: "column", sourceColumn: 27, transform: "trim" },
        { targetField: "receiverAddress",   sourceType: "column", sourceColumn: 28, transform: "trim" },
      ],
    },
  },

  // ======== 文件5: 门店调拨单(卡片式) ========
  {
    name: "卡片式调拨单",
    fileType: "excel",
    description: "文件含多个'▶ 调拨记录 #N'卡片，每卡片=门店信息(3行)+SKU表头(1行)+数据行。28行总览",
    features: [
      "▶", "调拨记录", "调拨单", "调拨单号",
      "调入门店", "收货人", "电话", "收货地址",
      "物品编码", "物品名称", "规格", "数量",
    ],
    sampleContent: `Row0: 武汉配送中心 · 门店调拨单
Row1: 调拨单号：DB20260530001 | 调出仓库：武汉配送中心 | 调拨日期：2026-05-30
Row2: [空行]
Row3: ▶ 调拨记录 #1
Row4: 调入门店 | 尹三顺自助烤肉（银泰店） | 收货人 | 王店长 | 电话 | 13900001111
Row5: 收货地址 | 汉口解放大道688号银泰百货B1层
Row6: [表头] 物品编码(col0) | 物品名称(col1) | 规格(col2) | 数量(col3)
Row7: ZBWP0001 | 茶语柠听紫苏风味糖浆 | 750ml*6瓶/件 | 3
Row8: ZBWP0015 | 寨寨香肠片 | 2.5kg*6包/件 | 5
Row9: ZBWP0028 | Q寨寨五常香米 | 25kg/包 | 10
Row10: [空行]
Row11: ▶ 调拨记录 #2 ...`,
    config: {
      dataSource: { sheetIndices: [0] },
      rowProcessing: {
        skipHeaderRows: 3,
        skipFooterRows: 1,
        cardBoundary: { markerPattern: "^▶\\s*调拨记录", includeMarker: false },
        aggregationKey: "",
      },
      fieldMappings: [
        { targetField: "storeName",       sourceType: "regex", regexPattern: "调入门店[：:\\s]+(.+)",       regexGroup: 1, transform: "trim" },
        { targetField: "receiverName",    sourceType: "regex", regexPattern: "收货人[：:\\s]+(.+)",         regexGroup: 1, transform: "trim" },
        { targetField: "receiverPhone",   sourceType: "regex", regexPattern: "电话[：:\\s]+([\\d-]+)",      regexGroup: 1, transform: "trim" },
        { targetField: "receiverAddress", sourceType: "regex", regexPattern: "收货地址[：:\\s]+(.+)",       regexGroup: 1, transform: "trim" },
        { targetField: "skuCode",         sourceType: "column", sourceColumn: 0, transform: "trim" },
        { targetField: "skuName",         sourceType: "column", sourceColumn: 1, transform: "trim" },
        { targetField: "skuSpec",         sourceType: "column", sourceColumn: 2, transform: "trim" },
        { targetField: "skuQuantity",     sourceType: "column", sourceColumn: 3, transform: "number" },
      ],
    },
  },

  // ======== 文件6: PDF 配送单 ========
  {
    name: "PDF纯文本配送单",
    fileType: "pdf",
    description: "PDF展开为纯文本，2页。头部=单据号/状态/日期/机构，数据行=分类+编码+名称+规格+数量(每行无分隔符)，尾部=制单人/收货人/电话/地址",
    features: [
      "配送单", "单据编号", "单据状态", "收货机构", "供货机构",
      "物品类别", "物品编码", "物品名称", "规格型号", "订货单位", "发货数量",
      "制单日期", "收货人", "收货电话", "收货地址", "合计",
    ],
    sampleContent: `Page1:
黔寨寨贵州烙锅（鞍山首店）-配送单
单据编号：PS2604210007 单据状态：已发货 复审状态：未复审
收货机构：黔寨寨贵州烙锅（鞍山首店） 订货机构：黔寨寨贵州烙锅（鞍山首店）
供货机构：武汉配送中心 送货机构：武汉配送中心 业务模式：统采统配
配送重量：1937.16 kg

1饮品类ZBWP0001茶语柠听紫苏风味糖浆750ml*6瓶/件件2
2饮品类ZBWP0002茶语柠听石榴复合果汁1L*12瓶/件件2
3饮品类ZBWP0003可可小麦草汁饮料浓浆1L*12瓶/件瓶2
4饮品类ZBWP0004唐吉家青提汁饮料浓浆1L*12瓶/件件1
...（共41行SKU数据）...

Page2 尾部:
合计：350
制单日期：2026/04/21 14:10:19 创建人：陈燕 发货人：张慧
收货人：荣丽 收货电话：13130093946
收货地址：辽宁省鞍山市铁东区建国大道700号万象汇（常温货地址）`,
    config: {
      dataSource: { sheetIndices: [0] },
      rowProcessing: { skipHeaderRows: 5, skipFooterRows: 3, aggregationKey: "" },
      fieldMappings: [
        { targetField: "skuCode",     sourceType: "regex", regexPattern: "\\d+\\S*?([A-Z]+\\d{2,})", regexGroup: 1, transform: "trim" },
        { targetField: "skuName",     sourceType: "regex", regexPattern: "[A-Z]+\\d{2,}\\s*([\\u4e00-\\u9fa5()（）\\d]+)", regexGroup: 1, transform: "trim" },
        { targetField: "skuSpec",     sourceType: "regex", regexPattern: "[\\u4e00-\\u9fa5()（）]+\\s+(\\d+\\S*?/[^\\s]{1,5})\\s", regexGroup: 1, transform: "trim" },
        { targetField: "skuQuantity", sourceType: "regex", regexPattern: "[:：、\\s](\\d+)$", regexGroup: 1, transform: "number" },
      ],
      tailExtraction: {
        enabled: true,
        patterns: [
          { field: "storeName",       regex: "收货机构[：:\\s]+(.+?)(?:\\s+|订货)", group: 1 },
          { field: "externalCode",    regex: "单据编号[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverName",    regex: "收货人[：:\\s]+(\\S+)", group: 1 },
          { field: "receiverPhone",   regex: "收货电话[：:\\s]+([\\d-]+)", group: 1 },
          { field: "receiverAddress", regex: "收货地址[：:\\s]+(.+?)(?:\\s*\\(|$)", group: 1 },
        ],
      },
    },
  },
];

// ======== 智能匹配逻辑 ========

function extractFeatures(text: string): string[] {
  const keywords = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const codes = text.match(/[A-Z]{2,6}\d{4,10}/g) || [];
  return Array.from(new Set([...keywords, ...codes]));
}

function featureSimilarity(refFeats: string[], fileFeats: string[]): number {
  const set = new Set(fileFeats);
  let match = 0;
  for (const f of refFeats) {
    if (set.has(f)) match++;
  }
  return refFeats.length > 0 ? match / refFeats.length : 0;
}

/** 根据文件内容匹配最佳参考示例 */
export function matchExamples(fileContent: string, fileType: string): RefExample[] {
  const feats = extractFeatures(fileContent);

  const scored = examples
    .filter(e => e.fileType === fileType)
    .map(e => ({ example: e, score: featureSimilarity(e.features, feats) }))
    .sort((a, b) => b.score - a.score);

  const best = scored.filter(s => s.score > 0.15).slice(0, 3);
  if (best.length === 0 && scored.length > 0) {
    return [scored[0].example];
  }
  return best.map(s => s.example);
}

export function getAllExampleDescriptions(fileType: string): string {
  return examples
    .filter(e => e.fileType === fileType)
    .map(e => `【${e.name}】${e.description}`)
    .join("\n");
}
