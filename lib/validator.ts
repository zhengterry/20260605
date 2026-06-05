import { ValidationError, OrderData } from "./types";

/** 数据校验器 - 全量错误一次性返回 */

export function validateOrders(orders: OrderData[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];

    // A组/B组二选一校验
    const hasStore = !!order.storeName?.trim();
    const hasName = !!order.receiverName?.trim();
    const hasPhone = !!order.receiverPhone?.trim();
    const hasAddress = !!order.receiverAddress?.trim();

    const groupAOk = hasStore;
    const groupBOk = hasName && hasPhone && hasAddress;

    if (!groupAOk && !groupBOk) {
      errors.push({
        rowIndex: i,
        field: "收货信息",
        message: "收货门店（A组）和收件人信息（B组）至少填写一组，当前两组均不完整",
        severity: "error",
      });
    }

    if (groupBOk && !hasPhone) {
      errors.push({
        rowIndex: i,
        field: "收件人电话",
        message: "B组模式下收件人电话不能为空",
        severity: "error",
      });
    }

    // 电话格式校验
    if (order.receiverPhone?.trim()) {
      const phoneClean = order.receiverPhone.replace(/[^\d]/g, "");
      if (phoneClean.length < 7 || phoneClean.length > 15) {
        errors.push({
          rowIndex: i,
          field: "收件人电话",
          message: `电话格式不正确：${order.receiverPhone}`,
          severity: "error",
        });
      }
    }

    // SKU 物品校验
    if (!order.items || order.items.length === 0) {
      errors.push({
        rowIndex: i,
        field: "物品列表",
        message: "订单没有物品明细",
        severity: "error",
      });
    } else {
      for (let j = 0; j < order.items.length; j++) {
        const item = order.items[j];

        if (!item.skuCode?.trim()) {
          errors.push({
            rowIndex: i,
            field: `物品[${j}] SKU编码`,
            message: "SKU物品编码不能为空",
            severity: "error",
          });
        }

        if (!item.skuName?.trim()) {
          errors.push({
            rowIndex: i,
            field: `物品[${j}] SKU名称`,
            message: "SKU物品名称不能为空",
            severity: "error",
          });
        }

        if (item.skuQuantity <= 0 || isNaN(item.skuQuantity)) {
          errors.push({
            rowIndex: i,
            field: `物品[${j}] 发货数量`,
            message: `发货数量必须为正数，当前值：${item.skuQuantity}`,
            severity: "error",
          });
        }
      }
    }
  }

  // 外部编码重复检测
  const codeMap = new Map<string, number[]>();
  for (let i = 0; i < orders.length; i++) {
    const code = orders[i].externalCode?.trim();
    if (code) {
      if (!codeMap.has(code)) {
        codeMap.set(code, []);
      }
      codeMap.get(code)?.push(i);
    }
  }

  for (const [code, indices] of codeMap) {
    if (indices.length > 1) {
      for (const idx of indices) {
        errors.push({
          rowIndex: idx,
          field: "外部编码",
          message: `外部编码 "${code}" 在批次内重复，与第 ${indices.filter(i => i !== idx).map(i => i + 1).join("、")} 行重复`,
          severity: "warning",
        });
      }
    }
  }

  return errors;
}
