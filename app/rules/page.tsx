"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Zap,
  FileSpreadsheet,
  FileText,
  FileDigit,
  Search,
} from "lucide-react";

interface ParseRule {
  id: string;
  name: string;
  description?: string;
  fileType: "excel" | "word" | "pdf";
  config: any;
  aiGenerated?: boolean;
  createdAt: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet size={20} className="text-green-500" />,
  word: <FileText size={20} className="text-blue-500" />,
  pdf: <FileDigit size={20} className="text-red-500" />,
};

const typeLabels: Record<string, string> = {
  excel: "Excel",
  word: "Word",
  pdf: "PDF",
};

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/rules${params}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error("加载规则失败:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此规则？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules(rules.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  const handleCopy = async (rule: ParseRule) => {
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${rule.name} (副本)`,
          description: rule.description,
          fileType: rule.fileType,
          config: rule.config,
        }),
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">解析规则管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理文件解析规则，支持 AI 辅助生成
            </p>
          </div>
          <button
            onClick={() => router.push("/rules/new")}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            <Plus size={16} />
            新建规则
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="card p-4 mb-4">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索规则名称..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && fetchRules()}
              className="input-field pl-9"
            />
          </div>
        </div>

        {/* 规则卡片列表 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-50 rounded w-full mb-2" />
                <div className="h-3 bg-gray-50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="card p-12 text-center">
            <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">暂无解析规则</p>
            <p className="text-sm text-gray-400 mb-4">
              创建解析规则以开始导入文件
            </p>
            <button
              onClick={() => router.push("/rules/new")}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} />
              创建第一条规则
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div key={rule.id} className="card card-hover p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {typeIcons[rule.fileType] || typeIcons.excel}
                    <h3 className="text-base font-medium text-gray-800 truncate">
                      {rule.name}
                    </h3>
                  </div>
                  {rule.aiGenerated && (
                    <span className="tag tag-primary flex-shrink-0 ml-2">
                      <Zap size={10} className="mr-1" />
                      AI生成
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {typeLabels[rule.fileType]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString("zh-CN") : "-"}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => router.push(`/rules/${rule.id}`)}
                    className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded transition-colors"
                    title="编辑"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => handleCopy(rule)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="复制"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
