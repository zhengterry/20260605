"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { executeRule } from "@/lib/ruleEngine";
import { validateOrders } from "@/lib/validator";
import { parseExcelFile } from "@/lib/fileParsers";
import { OrderData, ValidationError } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  Send,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

export default function PreviewPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [editingCell, setEditingCell] = useState<{
    row: number;
    field: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    parseFile();
  }, []);

  const parseFile = async () => {
    try {
      const ruleConfigStr = sessionStorage.getItem("previewRuleConfig");
      const fName = sessionStorage.getItem("previewFileName");
      const fileType = (sessionStorage.getItem("previewFileType") || "excel") as "excel" | "word" | "pdf";
      const fileId = sessionStorage.getItem("previewFileId");

      if (!fName) {
        setMessage("未找到解析配置，请返回重新导入");
        setLoading(false);
        return;
      }

      setFileName(fName);

      // 智能匹配模式：直接使用服务端返回的 orders
      const preOrders = sessionStorage.getItem("previewOrders");
      if (preOrders) {
        const parsedOrders = JSON.parse(preOrders);
        const validationErrors = validateOrders(parsedOrders);
        setOrders(parsedOrders);
        setErrors(validationErrors);
        setLoading(false);
        return;
      }

      // 手动规则模式：客户端重新解析
      if (ruleConfigStr && fileId) {
        const config = JSON.parse(ruleConfigStr);
        const fileDataStr = sessionStorage.getItem("previewFileData");
        if (fileDataStr) {
          const fileData = JSON.parse(fileDataStr);
          const parsedOrders = executeRule(fileData, config, fileType);
          const validationErrors = validateOrders(parsedOrders);
          setOrders(parsedOrders);
          setErrors(validationErrors);
        }
      }
    } catch (err: any) {
      console.error("解析失败:", err);
      setMessage(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getCellError = (rowIdx: number, field: string): ValidationError | undefined => {
    return errors.find((e) => e.rowIndex === rowIdx && e.field.includes(field));
  };

  const updateOrder = (rowIdx: number, field: string, value: any) => {
    setOrders((prev) => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [field]: value };
      return updated;
    });
    setEditingCell(null);
  };

  const updateItem = (rowIdx: number, itemIdx: number, field: string, value: any) => {
    setOrders((prev) => {
      const updated = [...prev];
      const items = [...updated[rowIdx].items];
      items[itemIdx] = { ...items[itemIdx], [field]: field === "skuQuantity" ? Number(value) : value };
      updated[rowIdx] = { ...updated[rowIdx], items };
      return updated;
    });
    setEditingCell(null);
  };

  const deleteOrder = (rowIdx: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const addEmptyOrder = () => {
    setOrders((prev) => [
      ...prev,
      {
        items: [{ skuCode: "", skuName: "", skuQuantity: 0 }],
        status: "pending",
      },
    ]);
  };

  const handleRevalidate = () => {
    const newErrors = validateOrders(orders);
    setErrors(newErrors);
  };

  const handleExport = () => {
    const rows: any[] = [];
    orders.forEach((order) => {
      order.items.forEach((item) => {
        rows.push({
          外部编码: order.externalCode || "",
          收货门店: order.storeName || "",
          收件人姓名: order.receiverName || "",
          收件人电话: order.receiverPhone || "",
          收件人地址: order.receiverAddress || "",
          SKU编码: item.skuCode,
          SKU名称: item.skuName,
          发货数量: item.skuQuantity,
          规格型号: item.skuSpec || "",
          备注: item.remark || order.remark || "",
        });
      });
    });

    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "出库数据");
      XLSX.writeFile(wb, `出库单_${Date.now()}.xlsx`);
    });
  };

  const handleSubmit = async () => {
    const newErrors = validateOrders(orders);
    setErrors(newErrors);

    if (newErrors.some((e) => e.severity === "error")) {
      setMessage("存在校验错误，请修正后再提交");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`提交成功！共提交 ${data.count} 条记录`);
        setTimeout(() => router.push("/orders"), 1500);
      } else {
        setMessage(data.error || "提交失败");
      }
    } catch (err) {
      setMessage("提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-gray-500">正在解析文件...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-full">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={16} />
              返回
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">数据预览</h1>
              <p className="text-xs text-gray-400">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRevalidate} className="btn-secondary text-xs">
              <CheckCircle size={14} className="mr-1 inline" />
              重新校验
            </button>
            <button onClick={handleExport} className="btn-secondary text-xs">
              <Download size={14} className="mr-1 inline" />
              导出Excel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || errorCount > 0}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> 提交中...</>
              ) : (
                <><Send size={16} /> 提交下单 ({orders.length}单)</>
              )}
            </button>
          </div>
        </div>

        {/* 错误汇总 */}
        {errors.length > 0 && (
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-4">
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <XCircle size={16} />
                  {errorCount} 个错误
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-orange-500">
                  <AlertTriangle size={16} />
                  {warningCount} 个警告
                </span>
              )}
              <span className="text-xs text-gray-400">
                共 {orders.length} 条记录 | 总物品数 {orders.reduce((s, o) => s + o.items.length, 0)} 个
              </span>
            </div>
          </div>
        )}

        {/* 数据表格 */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: "calc(100vh - 250px)" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">外部编码</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">收货门店</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">收件人姓名</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">收件人电话</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">收件人地址</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">SKU编码</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">SKU名称</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 w-20">数量</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">规格</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">备注</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, rowIdx) => {
                  const orderErrors = errors.filter((e) => e.rowIndex === rowIdx);
                  const hasError = orderErrors.some((e) => e.severity === "error");

                  return order.items.map((item, itemIdx) => (
                    <tr
                      key={`${rowIdx}-${itemIdx}`}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                        hasError ? "bg-red-50/30" : ""
                      }`}
                    >
                      {itemIdx === 0 && (
                        <>
                          <td
                            rowSpan={order.items.length}
                            className={`px-3 py-2 text-xs text-gray-400 ${
                              hasError ? "border-l-[3px] border-l-red-400" : ""
                            }`}
                          >
                            {rowIdx + 1}
                          </td>
                          <EditableCell
                            rowSpan={order.items.length}
                            value={order.externalCode || ""}
                            error={getCellError(rowIdx, "externalCode")}
                            onChange={(v) => updateOrder(rowIdx, "externalCode", v)}
                          />
                          <EditableCell
                            rowSpan={order.items.length}
                            value={order.storeName || ""}
                            error={getCellError(rowIdx, "storeName")}
                            onChange={(v) => updateOrder(rowIdx, "storeName", v)}
                          />
                          <EditableCell
                            rowSpan={order.items.length}
                            value={order.receiverName || ""}
                            error={getCellError(rowIdx, "receiverName")}
                            onChange={(v) => updateOrder(rowIdx, "receiverName", v)}
                          />
                          <EditableCell
                            rowSpan={order.items.length}
                            value={order.receiverPhone || ""}
                            error={getCellError(rowIdx, "receiverPhone")}
                            onChange={(v) => updateOrder(rowIdx, "receiverPhone", v)}
                          />
                          <EditableCell
                            rowSpan={order.items.length}
                            value={order.receiverAddress || ""}
                            error={getCellError(rowIdx, "收货信息")}
                            onChange={(v) => updateOrder(rowIdx, "receiverAddress", v)}
                          />
                        </>
                      )}
                      <EditableCell
                        value={item.skuCode}
                        error={getCellError(rowIdx, "skuCode")}
                        onChange={(v) => updateItem(rowIdx, itemIdx, "skuCode", v)}
                      />
                      <EditableCell
                        value={item.skuName}
                        error={getCellError(rowIdx, "skuName")}
                        onChange={(v) => updateItem(rowIdx, itemIdx, "skuName", v)}
                      />
                      <EditableCell
                        value={String(item.skuQuantity)}
                        error={getCellError(rowIdx, "skuQuantity")}
                        onChange={(v) => updateItem(rowIdx, itemIdx, "skuQuantity", v)}
                        type="number"
                      />
                      <EditableCell
                        value={item.skuSpec || ""}
                        onChange={(v) => updateItem(rowIdx, itemIdx, "skuSpec", v)}
                      />
                      <td className="px-3 py-2 text-xs text-gray-600">{item.remark || order.remark || ""}</td>
                      {itemIdx === 0 && (
                        <td rowSpan={order.items.length} className="px-3 py-2 text-center">
                          <button
                            onClick={() => deleteOrder(rowIdx)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 添加行按钮 */}
        <div className="mt-4">
          <button
            onClick={addEmptyOrder}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            新增空行
          </button>
        </div>

        {message && (
          <div className={`mt-4 text-sm px-3 py-2 rounded-md ${
            message.includes("成功")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}>
            {message}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// 可编辑单元格组件
function EditableCell({
  value,
  onChange,
  error,
  rowSpan,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  error?: ValidationError;
  rowSpan?: number;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSubmit = () => {
    onChange(editValue);
    setEditing(false);
  };

  if (editing) {
    return (
      <td rowSpan={rowSpan} className="px-1 py-1">
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setEditValue(value);
              setEditing(false);
            }
          }}
          className="w-full px-2 py-1 text-xs border border-primary-500 rounded 
            focus:outline-none focus:ring-1 focus:ring-primary-200"
        />
      </td>
    );
  }

  return (
    <td
      rowSpan={rowSpan}
      onClick={() => {
        setEditValue(value);
        setEditing(true);
      }}
      className={`px-3 py-2 text-xs cursor-pointer transition-colors hover:bg-gray-100 ${
        error ? "bg-red-50 text-red-600" : "text-gray-600"
      }`}
      title={error ? error.message : "点击编辑"}
    >
      {value || <span className="text-gray-300">-</span>}
    </td>
  );
}
