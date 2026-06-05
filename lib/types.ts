/** 解析规则配置类型定义 */

export interface DataSource {
  sheetIndices?: number[];
  pageRange?: string;
  tableSelector?: string;
}

export interface CardBoundary {
  markerPattern: string;
  includeMarker: boolean;
}

export interface RowProcessing {
  skipHeaderRows: number;
  skipFooterRows: number;
  cardBoundary?: CardBoundary;
  aggregationKey?: string;
}

export interface TailPattern {
  field: string;
  regex: string;
  group?: number;
}

export interface TailExtraction {
  enabled: boolean;
  patterns: TailPattern[];
}

export interface FieldMapping {
  targetField: string;
  sourceType: "column" | "static" | "regex" | "composite";
  sourceColumn?: string | number;
  staticValue?: string;
  regexPattern?: string;
  regexGroup?: number;
  compositeTemplate?: string;
  splitSeparator?: string;
  transform?: "trim" | "number" | "date";
  defaultValue?: string;
}

export interface MatrixTranspose {
  enabled: boolean;
  /** 门店列名（用于匹配列头） */
  storeColumns: string[];
  /** SKU名称所在列索引（从0开始） */
  skuNameColumn: number;
  /** SKU编码所在列索引（从0开始） */
  skuCodeColumn: number;
  /** SKU规格所在列索引（从0开始） */
  skuSpecColumn?: number;
  /** 数量所在列索引，若指定则用该列的值；否则用矩阵交叉点的值 */
  quantityColumn?: number;
}

export interface ParseRuleConfig {
  dataSource: DataSource;
  rowProcessing: RowProcessing;
  fieldMappings: FieldMapping[];
  matrixTranspose?: MatrixTranspose;
  tailExtraction?: TailExtraction;
}

export interface ParseRule {
  id: string;
  name: string;
  description?: string;
  fileType: "excel" | "word" | "pdf";
  config: ParseRuleConfig;
  aiGenerated?: boolean;
  confidence?: "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  skuCode: string;
  skuName: string;
  skuQuantity: number;
  skuSpec?: string;
  remark?: string;
}

export interface OrderData {
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  remark?: string;
  items: OrderItem[];
  status?: "pending" | "submitted" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParseResult {
  orders: OrderData[];
  errors: ValidationError[];
  stats: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    parseTime: number;
  };
}
