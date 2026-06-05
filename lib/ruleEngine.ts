import { ParseRuleConfig, OrderData, OrderItem, FieldMapping } from "./types";

/**
 * 规则引擎核心执行器
 * 不包含任何硬编码的文件格式判断，完全由规则配置驱动
 */

/** 应用数据转换 */
function applyTransform(value: string, transform?: string): string | number {
  if (!value) return value;
  switch (transform) {
    case "trim":
      return value.trim();
    case "number":
      return parseFloat(value) || 0;
    case "date":
      return value;
    default:
      return value;
  }
}

/** 提取头部信息（仅适用于行级数据） */
function extractHeaderInfo(rows: any[][], config: ParseRuleConfig): Record<string, string> {
  const info: Record<string, string> = {};
  const headerRows = rows.slice(0, Math.max(0, config.rowProcessing.skipHeaderRows));
  for (const row of headerRows) {
    for (const fm of config.fieldMappings) {
      if (fm.sourceType === "regex" && fm.regexPattern) {
        for (const cell of row) {
          const str = String(cell ?? "");
          const match = str.match(new RegExp(fm.regexPattern));
          if (match) {
            info[fm.targetField] = match[fm.regexGroup ?? 0] || match[0] || "";
          }
        }
      }
    }
  }
  return info;
}

/** 提取尾部信息（用于收货人信息在文件末尾的场景） */
function extractTailInfo(allRows: any[][], config: ParseRuleConfig): Record<string, string> {
  const info: Record<string, string> = {};
  if (!config.tailExtraction?.enabled) return info;

  const tailStart = allRows.length - Math.max(0, config.tailExtraction.patterns.length * 3);
  const tailRows = allRows.slice(Math.max(0, tailStart));

  for (const row of tailRows) {
    const line = row.map(c => String(c ?? "")).join(" ");
    for (const pattern of config.tailExtraction.patterns) {
      const match = line.match(new RegExp(pattern.regex, "i"));
      if (match) {
        info[pattern.field] = match[pattern.group ?? 1]?.trim() || "";
      }
    }
  }
  return info;
}

/** 根据字段映射提取值 */
function extractValue(row: any[], fieldMapping: FieldMapping, headerInfo: Record<string, string>): string {
  if (fieldMapping.sourceType === "static") {
    return fieldMapping.staticValue || "";
  }
  if (fieldMapping.sourceType === "regex" && fieldMapping.regexPattern) {
    const line = row.map(c => String(c ?? "")).join(" ");
    const match = line.match(new RegExp(fieldMapping.regexPattern, "i"));
    return match ? (match[fieldMapping.regexGroup ?? 1] || "") : "";
  }
  if (fieldMapping.sourceType === "composite" && fieldMapping.compositeTemplate) {
    return fieldMapping.compositeTemplate.replace(/\{(\w+)\}/g, (_, key) => {
      const fm = { ...fieldMapping, targetField: key, sourceType: "column" as const };
      return extractValue(row, fm, headerInfo);
    });
  }
  if (fieldMapping.sourceType === "column") {
    if (typeof fieldMapping.sourceColumn === "number") {
      const cell = row[fieldMapping.sourceColumn];
      return String(cell ?? "").trim();
    }
    return String(row[0] ?? "").trim();
  }
  return "";
}

/** 执行标准表格解析 */
function parseStandardTable(sheetData: any[][], config: ParseRuleConfig): OrderData[] {
  const orders: OrderData[] = [];
  const headerRows = config.rowProcessing.skipHeaderRows;
  const footerRows = config.rowProcessing.skipFooterRows;
  const dataRows = sheetData.slice(headerRows, sheetData.length - footerRows);
  const headerInfo = extractHeaderInfo(sheetData, config);
  const tailInfo = extractTailInfo(sheetData, config);

  if (dataRows.length === 0) return orders;

  // 聚合逻辑：有 aggregationKey 时按该字段聚合
  if (config.rowProcessing.aggregationKey) {
    const groups = new Map<string, { order: Partial<OrderData>; items: OrderItem[] }>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row.some(c => String(c ?? "").trim())) continue;

      const orderData: Record<string, string> = {};
      for (const fm of config.fieldMappings) {
        const val = extractValue(row, fm, headerInfo);
        orderData[fm.targetField] = String(applyTransform(val, fm.transform));
      }

      const aggKey = orderData[config.rowProcessing.aggregationKey] || `row_${i}`;

      if (!groups.has(aggKey)) {
        groups.set(aggKey, {
          order: {
            externalCode: orderData.externalCode || aggKey,
            storeName: orderData.storeName || tailInfo.storeName,
            receiverName: orderData.receiverName || tailInfo.receiverName,
            receiverPhone: orderData.receiverPhone || tailInfo.receiverPhone,
            receiverAddress: orderData.receiverAddress || tailInfo.receiverAddress,
          },
          items: [],
        });
      }

      const group = groups.get(aggKey)!;
      group.items.push({
        skuCode: orderData.skuCode || "",
        skuName: orderData.skuName || "",
        skuQuantity: parseFloat(orderData.skuQuantity) || 0,
        skuSpec: orderData.skuSpec || "",
        remark: orderData.remark || "",
      });
    }

    for (const [, group] of groups) {
      orders.push({
        ...group.order,
        externalCode: group.order.externalCode || tailInfo.externalCode,
        storeName: group.order.storeName || tailInfo.storeName,
        receiverName: group.order.receiverName || tailInfo.receiverName,
        receiverPhone: group.order.receiverPhone || tailInfo.receiverPhone,
        receiverAddress: group.order.receiverAddress || tailInfo.receiverAddress,
        items: group.items,
        status: "pending",
      } as OrderData);
    }
  } else {
    // 非聚合模式：所有SKU行归入一条订单
    let currentGroup: string | null = null;
    let currentOrder: Partial<OrderData> = {};
    let currentItems: OrderItem[] = [];

    const flushOrder = () => {
      if (currentItems.length > 0) {
        orders.push({
          ...currentOrder,
          externalCode: currentOrder.externalCode || tailInfo.externalCode,
          storeName: currentOrder.storeName || tailInfo.storeName,
          receiverName: currentOrder.receiverName || tailInfo.receiverName,
          receiverPhone: currentOrder.receiverPhone || tailInfo.receiverPhone,
          receiverAddress: currentOrder.receiverAddress || tailInfo.receiverAddress,
          items: [...currentItems],
          status: "pending",
        } as OrderData);
      }
      currentItems = [];
      currentOrder = {};
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const hasContent = row.some(c => String(c ?? "").trim());
      if (!hasContent) {
        if (i === dataRows.length - 1) flushOrder();
        continue;
      }

      const rowData: Record<string, string> = {};
      for (const fm of config.fieldMappings) {
        const val = extractValue(row, fm, headerInfo);
        rowData[fm.targetField] = String(applyTransform(val, fm.transform));
      }

      const skuCode = rowData.skuCode || "";
      const skuName = rowData.skuName || "";
      const hasSku = skuCode || skuName;

      if (hasSku) {
        currentItems.push({
          skuCode,
          skuName,
          skuQuantity: parseFloat(rowData.skuQuantity) || 0,
          skuSpec: rowData.skuSpec || "",
          remark: rowData.remark || "",
        });

        if (!currentOrder.externalCode) {
          currentOrder = {
            externalCode: rowData.externalCode || headerInfo.externalCode || tailInfo.externalCode,
            storeName: rowData.storeName || headerInfo.storeName || tailInfo.storeName,
            receiverName: rowData.receiverName || headerInfo.receiverName || tailInfo.receiverName,
            receiverPhone: rowData.receiverPhone || headerInfo.receiverPhone || tailInfo.receiverPhone,
            receiverAddress: rowData.receiverAddress || tailInfo.receiverAddress,
          };
        }
      }

      // 如果是最后一行则刷新订单
      if (i === dataRows.length - 1) {
        flushOrder();
      }
    }
  }

  return orders;
}

/** 执行矩阵转置解析（门店列横向转纵向） */
function parseMatrix(sheetData: any[][], config: ParseRuleConfig): OrderData[] {
  if (!config.matrixTranspose?.enabled) return [];
  const orders: OrderData[] = [];
  const mt = config.matrixTranspose;

  const headerRows = config.rowProcessing.skipHeaderRows;
  // 列头位于 skipHeaderRows-1 行（跳过标题行后第一行即为列头）
  const columnHeaders = sheetData[headerRows - 1] || [];
  const dataRows = sheetData.slice(headerRows);

  // 找到门店列在列头中的索引
  const storeColMap: Record<string, number> = {};
  for (const storeName of mt.storeColumns) {
    const idx = columnHeaders.findIndex(
      (h: any) => String(h ?? "").trim() === storeName
    );
    if (idx >= 0) storeColMap[storeName] = idx;
  }

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const skuName = String(row[mt.skuNameColumn] ?? "").trim();
    const skuCode = String(row[mt.skuCodeColumn] ?? "").trim();
    if (!skuName && !skuCode) continue;

    const skuSpec = mt.skuSpecColumn != null
      ? String(row[mt.skuSpecColumn] ?? "").trim()
      : "";

    // 遍历每个门店列
    for (const [storeName, colIdx] of Object.entries(storeColMap)) {
      const cellVal = String(row[colIdx] ?? "").trim();
      if (!cellVal || cellVal === "0") continue;

      // 数量优先用 quantityColumn，否则用交叉点的值
      const qtyStr = mt.quantityColumn != null
        ? String(row[mt.quantityColumn] ?? "").trim()
        : cellVal;
      const quantity = parseFloat(qtyStr);

      const item: OrderItem = {
        skuCode,
        skuName,
        skuQuantity: isNaN(quantity) ? 0 : quantity,
        skuSpec: skuSpec || undefined,
      };

      const existing = orders.find(o => o.storeName === storeName);
      if (existing) {
        existing.items.push(item);
      } else {
        orders.push({
          storeName,
          items: [item],
          status: "pending",
        });
      }
    }
  }

  return orders;
}

/** 解析卡片式结构 */
function parseCards(sheetData: any[][], config: ParseRuleConfig): OrderData[] {
  if (!config.rowProcessing.cardBoundary) return [];
  const orders: OrderData[] = [];
  const markerPattern = config.rowProcessing.cardBoundary.markerPattern;

  // 按卡片边界分组
  let currentCard: any[][] = [];
  let inCard = false;

  for (const row of sheetData) {
    const firstCell = String(row[0] || "");
    if (new RegExp(markerPattern).test(firstCell)) {
      if (currentCard.length > 0) {
        orders.push(processCard(currentCard, config));
      }
      currentCard = config.rowProcessing.cardBoundary.includeMarker ? [row] : [];
      inCard = true;
    } else if (inCard) {
      currentCard.push(row);
    }
  }

  if (currentCard.length > 0) {
    orders.push(processCard(currentCard, config));
  }

  return orders;
}

/** 处理单个卡片 */
function processCard(cardRows: any[][], config: ParseRuleConfig): OrderData {
  const order: OrderData = { items: [], status: "pending" };
  const headerInfo = extractHeaderInfo(cardRows, config);

  for (const row of cardRows) {
    const rowData: Record<string, string> = {};
    for (const fm of config.fieldMappings) {
      rowData[fm.targetField] = String(applyTransform(extractValue(row, fm, headerInfo), fm.transform));
    }

    if (!order.externalCode) order.externalCode = rowData.externalCode;
    if (!order.storeName) order.storeName = rowData.storeName;
    if (!order.receiverName) order.receiverName = rowData.receiverName;
    if (!order.receiverPhone) order.receiverPhone = rowData.receiverPhone;
    if (!order.receiverAddress) order.receiverAddress = rowData.receiverAddress;

    // 判断是否是真正的SKU行：物品编码通常为字母+数字组合（如ZBWP0001）
    const isValidSku = (rowData.skuCode || "").match(/^[A-Z]{2,}\d{4,}$/);
    if (rowData.skuCode || rowData.skuName) {
      // 只接受真正的SKU行：skuCode必须为字母+数字格式的产品编码
      if (isValidSku) {
        order.items.push({
          skuCode: rowData.skuCode || "",
          skuName: rowData.skuName || "",
          skuQuantity: parseFloat(rowData.skuQuantity) || 0,
          skuSpec: rowData.skuSpec || "",
          remark: rowData.remark || "",
        });
      }
    }
  }

  return order;
}

/** 纯文本解析（Word 文档） */
function parseTextLines(lines: string[], config: ParseRuleConfig): OrderData[] {
  const orders: OrderData[] = [];
  const tailInfo = extractTailInfo(lines.map(l => [l]), config);

  // 按分隔线分组
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^[━─═]+$/.test(line.trim())) {
      if (currentLines.length > 0) {
        const order = processTextBlock(currentLines, config, tailInfo);
        if (order) orders.push(order);
        currentLines = [];
      }
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    const order = processTextBlock(currentLines, config, tailInfo);
    if (order) orders.push(order);
  }

  return orders;
}

/** 处理文本块 */
function processTextBlock(
  blockLines: string[],
  config: ParseRuleConfig,
  tailInfo: Record<string, string>
): OrderData | null {
  const order: OrderData = { items: [], status: "pending" };

  for (const line of blockLines) {
    for (const fm of config.fieldMappings) {
      if (fm.sourceType === "regex" && fm.regexPattern) {
        const match = line.match(new RegExp(fm.regexPattern, "i"));
        if (match) {
          const val = match[fm.regexGroup ?? 1]?.trim() || "";
          (order as any)[fm.targetField] = String(applyTransform(val, fm.transform));
        }
      }
    }
    // 检查是否是物品行
    // 标准格式：编号. 编码 | 名称 | 规格 | 数量
    const itemMatch = line.match(/^\d+\.\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\S*)\s*\|\s*(\d+)/);
    if (itemMatch) {
      order.items.push({
        skuCode: itemMatch[1],
        skuName: itemMatch[2],
        skuSpec: itemMatch[3] || undefined,
        skuQuantity: parseInt(itemMatch[4]) || 0,
      });
      continue;
    }
    // PDF串联格式：1饮品类ZBWP0001茶语柠听紫苏风味糖浆750ml*6瓶/件件2
    const pdfItemMatch = line.match(/^(\d+)\D+?([A-Z]+\d{4,})\s*(.+?)(\d+)$/);
    if (pdfItemMatch) {
      // 尝试从名称中分离规格信息：名称中通常包含 数字+单位 的规格模式
      let skuName = pdfItemMatch[3].trim();
      let skuSpec = "";
      const specMatch = skuName.match(/^(.+?)(\d+\S*(?:瓶|袋|包|kg|KG|件|箱|顶|桶|块|个|杯)(?:\/\S+)?)$/);
      if (specMatch) {
        skuName = specMatch[1].trim();
        skuSpec = specMatch[2] || "";
      }
      order.items.push({
        skuCode: pdfItemMatch[2],
        skuName: skuName.endsWith(skuSpec) ? skuName.slice(0, -skuSpec.length).trim() : skuName,
        skuSpec: skuSpec || undefined,
        skuQuantity: parseInt(pdfItemMatch[4]) || 0,
      });
      continue;
    }
  }

  // 补充尾部信息
  if (!order.storeName) order.storeName = tailInfo.storeName;
  if (!order.receiverName) order.receiverName = tailInfo.receiverName;
  if (!order.receiverPhone) order.receiverPhone = tailInfo.receiverPhone;
  if (!order.receiverAddress) order.receiverAddress = tailInfo.receiverAddress;

  return order.items.length > 0 ? order : null;
}

/** 复合单元格拆分 */
function splitCompositeCells(orders: OrderData[]): OrderData[] {
  const result: OrderData[] = [];

  for (const order of orders) {
    const hasComplex = order.items.some(
      item => (item.skuName || "").includes("\n") || (item.skuName || "").includes("x")
    );

    if (hasComplex) {
      const newItems: OrderItem[] = [];
      for (const item of order.items) {
        const lines = item.skuName.split("\n").filter(Boolean);
        if (lines.length > 1) {
          for (const line of lines) {
            const parts = line.match(/^(.+?)\s*[x×]\s*(\d+)$/);
            if (parts) {
              newItems.push({
                ...item,
                skuName: parts[1].trim(),
                skuQuantity: parseInt(parts[2]) || item.skuQuantity,
              });
            } else {
              newItems.push({ ...item, skuName: line.trim() });
            }
          }
        } else {
          newItems.push(item);
        }
      }
      result.push({ ...order, items: newItems });
    } else {
      result.push(order);
    }
  }

  return result;
}

/** 主入口：执行规则解析 */
export function executeRule(
  rawData: any[][][] | string[],
  config: ParseRuleConfig,
  fileType: "excel" | "word" | "pdf"
): OrderData[] {
  let orders: OrderData[] = [];

  if ((fileType === "word" || fileType === "pdf") && Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === "string") {
    // Word / PDF: 纯文本行数组
    orders = parseTextLines(rawData as string[], config);
  } else if (fileType === "excel") {
    // Excel / PDF: 二维数组（可能多Sheet）
    const sheets = rawData as any[][][];

    if (config.rowProcessing.cardBoundary && config.rowProcessing.cardBoundary.markerPattern) {
      // 卡片式解析
      for (const sheet of sheets) {
        orders.push(...parseCards(sheet, config));
      }
    } else if (config.matrixTranspose?.enabled) {
      // 矩阵转置解析
      for (const sheet of sheets) {
        orders.push(...parseMatrix(sheet, config));
      }
    } else {
      // 标准表格解析
      for (const sheet of sheets) {
        orders.push(...parseStandardTable(sheet, config));
      }
    }
  }

  // 后处理：复合单元格拆分
  orders = splitCompositeCells(orders);

  return orders;
}
