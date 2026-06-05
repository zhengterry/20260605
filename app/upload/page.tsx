"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { executeRule } from "@/lib/ruleEngine";
import { validateOrders } from "@/lib/validator";
import { parseExcelFile } from "@/lib/fileParsers";
import FileUploader from "@/components/FileUploader";
import RecentRules from "@/components/RecentRules";
import { ArrowRight, Zap, Loader2, FileText } from "lucide-react";

interface ParseRule {
  id: string;
  name: string;
  fileType: "excel" | "word" | "pdf";
  config: any;
}

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");

  const handleStartParse = useCallback(async () => {
    if (!selectedFile) { setMessage("请先上传文件"); return; }
    if (!selectedRule) { setMessage("请先选择解析规则"); return; }

    setParsing(true);
    setMessage("解析中...");

    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      let rawData: any;

      if (ext === "xlsx" || ext === "xls") {
        rawData = await parseExcelFile(selectedFile);
      } else {
        // Word/PDF 需要后端解析
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("文件上传失败");
        rawData = [[[""]]]; // 非 Excel 走文本路径
      }

      const config = selectedRule.config;
      const fileType = ext === "docx" ? "word" : ext === "pdf" ? "pdf" : "excel";
      const parsedOrders = executeRule(rawData, config, fileType as any);
      const parsedErrors = validateOrders(parsedOrders);

      sessionStorage.setItem("previewRuleId", selectedRule.id);
      sessionStorage.setItem("previewRuleConfig", JSON.stringify(config));
      sessionStorage.setItem("previewFileName", selectedFile.name);
      sessionStorage.setItem("previewFileType", fileType);
      sessionStorage.setItem("previewFileData", JSON.stringify(rawData));

      router.push("/preview");
    } catch (err: any) {
      setMessage(`解析失败: ${err.message}`);
    } finally {
      setParsing(false);
    }
  }, [selectedFile, selectedRule, router]);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">文件导入</h1>
          <p className="text-sm text-gray-500 mt-1">上传文件并选择解析规则进行导入</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-4">选择解析规则</h2>
              <RecentRules onSelect={setSelectedRule} selectedId={selectedRule?.id} />
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="card p-5 mb-4">
              <h2 className="text-base font-semibold text-gray-800 mb-4">上传文件</h2>
              <FileUploader file={selectedFile} onFileChange={setSelectedFile} />
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {selectedFile && (
                    <span className="flex items-center gap-2">
                      <FileText size={16} className="text-primary-500" />
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                  {selectedRule && (
                    <span className="ml-4 text-primary-600">规则：{selectedRule.name}</span>
                  )}
                </div>
                <button
                  onClick={handleStartParse}
                  disabled={parsing || !selectedFile || !selectedRule}
                  className="btn-primary flex items-center gap-2 px-6 py-2.5"
                >
                  {parsing ? (
                    <><Loader2 size={16} className="animate-spin" /> 解析中...</>
                  ) : (
                    <>开始解析 <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
              {message && (
                <div className={`mt-3 text-sm px-3 py-2 rounded-md ${message.includes("失败") ? "bg-red-50 text-red-600" : "bg-primary-50 text-primary-700"}`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
