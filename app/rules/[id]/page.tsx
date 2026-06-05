"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";

export default function EditRulePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"excel" | "word" | "pdf">("excel");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<any>({
    dataSource: {},
    rowProcessing: { skipHeaderRows: 0, skipFooterRows: 0 },
    fieldMappings: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) fetchRule();
  }, [id]);

  const fetchRule = async () => {
    try {
      const res = await fetch(`/api/rules?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        const rule = data.rule;
        setName(rule.name);
        setFileType(rule.fileType);
        setDescription(rule.description || "");
        setConfig(rule.config);
      } else {
        setMessage("规则不存在");
      }
    } catch (err) {
      setMessage("加载规则失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, fileType, description, config }),
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

  const handleDelete = async () => {
    if (!confirm("确定删除此规则？")) return;
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/rules");
      }
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  const addFieldMapping = () => {
    setConfig({
      ...config,
      fieldMappings: [...config.fieldMappings, { targetField: "", sourceType: "column", sourceColumn: 0 }],
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={16} /> 返回
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">编辑解析规则</h1>
          <button onClick={handleDelete} className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 size={14} /> 删除规则
          </button>
        </div>

        <div className="card p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">规则名称 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">文件类型</label>
              <select value={fileType} onChange={(e) => setFileType(e.target.value as any)} className="input-field">
                <option value="excel">Excel (.xlsx/.xls)</option>
                <option value="word">Word (.docx)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">描述</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">行处理配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">跳过头部行数</label>
              <input type="number" value={config.rowProcessing.skipHeaderRows} onChange={(e) => setConfig({ ...config, rowProcessing: { ...config.rowProcessing, skipHeaderRows: parseInt(e.target.value) || 0 } })} className="input-field" min={0} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">跳过尾部行数</label>
              <input type="number" value={config.rowProcessing.skipFooterRows} onChange={(e) => setConfig({ ...config, rowProcessing: { ...config.rowProcessing, skipFooterRows: parseInt(e.target.value) || 0 } })} className="input-field" min={0} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">聚合字段（可选）</label>
              <input type="text" value={config.rowProcessing.aggregationKey || ""} onChange={(e) => setConfig({ ...config, rowProcessing: { ...config.rowProcessing, aggregationKey: e.target.value || undefined } })} className="input-field" placeholder="例如：externalCode" />
            </div>
          </div>
        </div>

        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">字段映射</h2>
            <button onClick={addFieldMapping} className="btn-secondary text-xs px-3 py-1.5">+ 添加映射</button>
          </div>
          {config.fieldMappings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">暂无字段映射</p>
          ) : (
            <div className="space-y-2">
              {config.fieldMappings.map((fm: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <select value={fm.targetField} onChange={(e) => updateFieldMapping(idx, { targetField: e.target.value })} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                    <option value="">选择字段</option>
                    {targetFields.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                  <select value={fm.sourceType} onChange={(e) => updateFieldMapping(idx, { sourceType: e.target.value })} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                    <option value="column">列映射</option>
                    <option value="static">静态值</option>
                    <option value="regex">正则提取</option>
                  </select>
                  {fm.sourceType === "column" && (
                    <input type="number" value={fm.sourceColumn ?? ""} onChange={(e) => updateFieldMapping(idx, { sourceColumn: parseInt(e.target.value) || 0 })} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white w-16" />
                  )}
                  {fm.sourceType === "static" && (
                    <input type="text" value={fm.staticValue || ""} onChange={(e) => updateFieldMapping(idx, { staticValue: e.target.value })} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-1" />
                  )}
                  <button onClick={() => removeFieldMapping(idx)} className="text-xs text-red-400 hover:text-red-600">删除</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={() => router.back()} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> 保存中...</> : <><Save size={16} /> 保存修改</>}
          </button>
        </div>

        {message && <div className={`mt-4 text-sm px-3 py-2 rounded-md ${message.includes("失败") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{message}</div>}
      </div>
    </MainLayout>
  );
}
