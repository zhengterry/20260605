"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { ArrowLeft, Zap, Save, Play, Loader2 } from "lucide-react";

export default function NewRulePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"excel" | "word" | "pdf">("excel");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<any>({
    dataSource: {},
    rowProcessing: { skipHeaderRows: 0, skipFooterRows: 0 },
    fieldMappings: [],
  });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sampleFile, setSampleFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage("请输入规则名称");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, fileType, description, config }),
      });
      if (res.ok) {
        router.push("/rules");
      } else {
        const data = await res.json();
        setMessage(data.error || "保存失败");
      }
    } catch (err) {
      setMessage("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!sampleFile) {
      setMessage("请先上传一个样例文件用于 AI 分析");
      return;
    }
    setAiLoading(true);
    setMessage("");

    try {
      // 直接发送文件给 AI 解析（不存盘）
      const formData = new FormData();
      formData.append("file", sampleFile);

      const res = await fetch("/api/ai-gen", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.config);
        setName(data.name || `AI生成-${sampleFile.name.replace(/\.\w+$/, "")}`);
        setMessage("AI 已生成规则配置，请检查并手动微调后保存");
      } else {
        setMessage(data.error || "AI 生成失败");
      }
    } catch (err: any) {
      setMessage("AI 生成失败: " + (err.message || "未知错误"));
    } finally {
      setAiLoading(false);
    }
  };

  const addFieldMapping = () => {
    setConfig({
      ...config,
      fieldMappings: [
        ...config.fieldMappings,
        {
          targetField: "",
          sourceType: "column",
          sourceColumn: 0,
        },
      ],
    });
  };

  const updateFieldMapping = (index: number, updates: any) => {
    const mappings = [...config.fieldMappings];
    mappings[index] = { ...mappings[index], ...updates };
    setConfig({ ...config, fieldMappings: mappings });
  };

  const removeFieldMapping = (index: number) => {
    setConfig({
      ...config,
      fieldMappings: config.fieldMappings.filter((_: any, i: number) => i !== index),
    });
  };

  const targetFields = [
    "externalCode", "storeName", "receiverName", "receiverPhone",
    "receiverAddress", "skuCode", "skuName", "skuQuantity", "skuSpec", "remark",
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={16} />
          返回
        </button>

        <h1 className="text-2xl font-semibold text-gray-900 mb-6">新建解析规则</h1>

        {/* 基本信息 */}
        <div className="card p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">规则名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="例如：湖南仓标准模板"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">文件类型</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as any)}
                className="input-field"
              >
                <option value="excel">Excel (.xlsx/.xls)</option>
                <option value="word">Word (.docx)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="简要描述此规则的用途"
              />
            </div>
          </div>
        </div>

        {/* AI 辅助生成 */}
        <div className="card p-5 mb-4 bg-primary-50/30 border border-primary-100">
          <div className="flex items-center gap-3 mb-3">
            <Zap size={20} className="text-primary-500" />
            <h2 className="text-base font-semibold text-gray-800">AI 辅助生成规则</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            上传一个样例文件，AI 将自动分析文件结构并生成推荐的解析规则配置
          </p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".xlsx,.xls,.docx,.pdf"
              onChange={(e) => setSampleFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 
                file:rounded-md file:border-0 file:text-sm file:bg-primary-50 
                file:text-primary-700 hover:file:bg-primary-100"
            />
            <button
              onClick={handleAIGenerate}
              disabled={aiLoading || !sampleFile}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {aiLoading ? (
                <><Loader2 size={14} className="animate-spin" /> 分析中...</>
              ) : (
                <><Zap size={14} /> 生成规则</>
              )}
            </button>
          </div>
          {message && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-md ${
              message.includes("失败")
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-700"
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* 行处理配置 */}
        <div className="card p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">行处理配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">跳过头部行数</label>
              <input
                type="number"
                value={config.rowProcessing.skipHeaderRows}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rowProcessing: {
                      ...config.rowProcessing,
                      skipHeaderRows: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="input-field"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">跳过尾部行数</label>
              <input
                type="number"
                value={config.rowProcessing.skipFooterRows}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rowProcessing: {
                      ...config.rowProcessing,
                      skipFooterRows: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="input-field"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">聚合字段（可选）</label>
              <input
                type="text"
                value={config.rowProcessing.aggregationKey || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rowProcessing: {
                      ...config.rowProcessing,
                      aggregationKey: e.target.value || undefined,
                    },
                  })
                }
                className="input-field"
                placeholder="例如：externalCode"
              />
            </div>
          </div>
        </div>

        {/* 字段映射 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">字段映射</h2>
            <button onClick={addFieldMapping} className="btn-secondary text-xs px-3 py-1.5">
              + 添加映射
            </button>
          </div>

          {config.fieldMappings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              暂无字段映射，点击"添加映射"或使用 AI 辅助生成
            </p>
          ) : (
            <div className="space-y-2">
              {config.fieldMappings.map((fm: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <select
                    value={fm.targetField}
                    onChange={(e) => updateFieldMapping(idx, { targetField: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-shrink-0"
                  >
                    <option value="">选择字段</option>
                    {targetFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    value={fm.sourceType}
                    onChange={(e) => updateFieldMapping(idx, { sourceType: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-shrink-0"
                  >
                    <option value="column">列映射</option>
                    <option value="static">静态值</option>
                    <option value="regex">正则提取</option>
                  </select>
                  {fm.sourceType === "column" && (
                    <input
                      type="number"
                      value={fm.sourceColumn ?? ""}
                      onChange={(e) =>
                        updateFieldMapping(idx, {
                          sourceColumn: parseInt(e.target.value) || 0,
                        })
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white w-16"
                      placeholder="列号"
                    />
                  )}
                  {fm.sourceType === "static" && (
                    <input
                      type="text"
                      value={fm.staticValue || ""}
                      onChange={(e) =>
                        updateFieldMapping(idx, { staticValue: e.target.value })
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-1"
                      placeholder="静态值"
                    />
                  )}
                  {fm.sourceType === "regex" && (
                    <input
                      type="text"
                      value={fm.regexPattern || ""}
                      onChange={(e) =>
                        updateFieldMapping(idx, { regexPattern: e.target.value })
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-1"
                      placeholder="正则表达式"
                    />
                  )}
                  <button
                    onClick={() => removeFieldMapping(idx)}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => router.back()} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> 保存中...</>
            ) : (
              <><Save size={16} /> 保存规则</>
            )}
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
