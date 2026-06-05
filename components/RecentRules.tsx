"use client";

import { useState, useEffect } from "react";
import { FileSpreadsheet, FileText, FileDigit, Check } from "lucide-react";

interface ParseRule {
  id: string;
  name: string;
  fileType: "excel" | "word" | "pdf";
  config: any;
  description?: string;
  createdAt: string;
}

interface RecentRulesProps {
  onSelect: (rule: ParseRule) => void;
  selectedId?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet size={16} className="text-green-500" />,
  word: <FileText size={16} className="text-blue-500" />,
  pdf: <FileDigit size={16} className="text-red-500" />,
};

const typeLabels: Record<string, string> = {
  excel: "Excel",
  word: "Word",
  pdf: "PDF",
};

export default function RecentRules({ onSelect, selectedId }: RecentRulesProps) {
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/rules?limit=10");
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

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-8">
        <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">暂无解析规则</p>
        <p className="text-xs text-gray-300 mt-1">点击"新建规则"创建第一条规则</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
      {rules.map((rule) => {
        const isSelected = rule.id === selectedId;
        return (
          <button
            key={rule.id}
            onClick={() => onSelect(rule)}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-200
              ${
                isSelected
                  ? "border-primary-500 bg-primary-50 shadow-sm"
                  : "border-gray-100 bg-white hover:border-primary-200 hover:bg-gray-50"
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0">
                  {typeIcons[rule.fileType] || typeIcons.excel}
                </span>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {rule.name}
                </span>
              </div>
              {isSelected && (
                <Check size={16} className="text-primary-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 pl-6">
              <span className="text-xs text-gray-400">
                {typeLabels[rule.fileType]}
              </span>
              {rule.description && (
                <span className="text-xs text-gray-300 truncate">
                  {rule.description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
