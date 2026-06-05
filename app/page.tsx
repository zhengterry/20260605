"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import FileUploader from "@/components/FileUploader";
import RecentRules from "@/components/RecentRules";
import { Upload, FileText, Zap, ArrowRight } from "lucide-react";

interface ParseRule {
  id: string;
  name: string;
  fileType: "excel" | "word" | "pdf";
  config: any;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoMode, setAutoMode] = useState(false);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setMessage("");
  };

  const handleRuleSelect = (rule: ParseRule) => {
    setSelectedRule(rule);
    setAutoMode(false);
    setMessage("");
  };

  const handleNewRule = () => {
    router.push("/rules/new");
  };

  // 智能匹配：先本地规则 → 不行再 AI
  const handleAutoMatch = useCallback(async () => {
    if (!selectedFile) {
      setMessage("请先上传文件");
      return;
    }
    setLoading(true);
    setAutoMode(true);
    setMessage("正在智能匹配规则...");

    try {
      // 上传文件
      const formData = new FormData();
      formData.append("file", selectedFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "文件上传失败");

      // 调用匹配 API（本地规则 → AI 回退）
      setMessage(uploadData.fileType === "excel" ? "本地规则匹配中..." : "解析文件中...");
      const matchRes = await fetch("/api/parse/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: uploadData.fileId, fileName: uploadData.fileName, fileType: uploadData.fileType }),
      });
      const matchData = await matchRes.json();

      if (!matchRes.ok || !matchData.success) {
        throw new Error(matchData.error || "解析失败");
      }

      // 存储到 sessionStorage 供预览页使用
      sessionStorage.setItem("previewRuleId", matchData.ruleId || "auto");
      sessionStorage.setItem("previewRuleConfig", JSON.stringify(matchData.config));
      sessionStorage.setItem("previewFileName", selectedFile.name);
      sessionStorage.setItem("previewFileType", uploadData.fileType);
      sessionStorage.setItem("previewFileId", uploadData.fileId);
      sessionStorage.setItem("previewOrders", JSON.stringify(matchData.orders));

      const label = matchData.source === "ai" ? `AI 已自动生成规则「${matchData.ruleName}」` : `已匹配本地规则「${matchData.ruleName}」`;
      setMessage(`${label}，正在跳转...`);
      setTimeout(() => router.push("/preview"), 600);
    } catch (err: any) {
      setMessage(err.message || "智能匹配失败");
    } finally {
      setLoading(false);
      setAutoMode(false);
    }
  }, [selectedFile, router]);

  const handleStartImport = useCallback(async () => {
    if (!selectedFile) {
      setMessage("请先上传文件");
      return;
    }
    if (!selectedRule) {
      setMessage('请先选择一条解析规则，或点击「新建规则」');
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // 上传文件
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "文件上传失败");
      }

      // 存储到 sessionStorage 供预览页使用
      sessionStorage.setItem("previewRuleId", selectedRule.id);
      sessionStorage.setItem("previewRuleConfig", JSON.stringify(selectedRule.config));
      sessionStorage.setItem("previewFileName", selectedFile.name);
      sessionStorage.setItem("previewFileType", uploadData.fileType);
      sessionStorage.setItem("previewFileId", uploadData.fileId);

      router.push("/preview");
    } catch (err: any) {
      setMessage(err.message || "导入失败");
    } finally {
      setLoading(false);
    }
  }, [selectedFile, selectedRule, router]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">万能导入</h1>
          <p className="text-sm text-gray-500 mt-1">
            智能多格式批量下单系统 — 支持 Excel / Word / PDF 文件导入
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧：规则选择 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">
                  选择解析规则
                </h2>
                <button
                  onClick={handleNewRule}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Zap size={14} />
                  新建规则
                </button>
              </div>
              <RecentRules onSelect={handleRuleSelect} selectedId={selectedRule?.id} />
            </div>
          </div>

          {/* 右侧：文件上传 */}
          <div className="lg:col-span-3 space-y-4">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                上传文件
              </h2>
              <FileUploader file={selectedFile} onFileChange={handleFileChange} />
            </div>

            {/* 操作按钮 */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {selectedFile ? (
                    <span className="flex items-center gap-2">
                      <FileText size={16} className="text-primary-500" />
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : (
                    "请上传文件"
                  )}
                  {selectedRule && !autoMode && (
                    <span className="ml-4 text-primary-600">规则：{selectedRule.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAutoMatch}
                    disabled={loading || !selectedFile}
                    className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm"
                  >
                    {autoMode ? (
                      <><div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />智能匹配中</>
                    ) : (
                      <><Zap size={16} />智能匹配</>
                    )}
                  </button>
                  <button
                    onClick={handleStartImport}
                    disabled={loading || !selectedFile || !selectedRule}
                    className="btn-primary flex items-center gap-2 px-6 py-2.5"
                  >
                    {loading && !autoMode ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />解析中...</>
                    ) : (
                      <>
                        开始解析<ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {message && (
                <div className={`mt-3 text-sm px-3 py-2 rounded-md ${
                  message.includes("失败") || message.includes("错误")
                    ? "bg-red-50 text-red-600"
                    : "bg-primary-50 text-primary-700"
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        <div className="mt-6 p-4 bg-primary-50 border border-primary-100 rounded-lg">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary-800">智能匹配</p>
              <p className="text-xs text-primary-600 mt-1">
                上传文件后点击「智能匹配」，系统先尝试本地规则解析；如果都不匹配，自动调用 AI 分析文件结构并生成规则。
                也可手动选择一条规则后点击「开始解析」。
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
