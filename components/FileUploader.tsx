"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";

interface FileUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function FileUploader({ file, onFileChange }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const ext = droppedFile.name.split(".").pop()?.toLowerCase();
        if (["xlsx", "xls", "docx", "pdf"].includes(ext || "")) {
          onFileChange(droppedFile);
        }
      }
    },
    [onFileChange]
  );

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      onFileChange(selected);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!file ? handleClick : undefined}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer 
          transition-all duration-200
          ${dragOver
            ? "border-primary-500 bg-primary-50"
            : file
              ? "border-primary-200 bg-primary-50/30"
              : "border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/20"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.docx,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <FileText size={24} className="text-white" />
            </div>
            <p className="text-sm font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="mt-1 flex items-center gap-1 text-xs text-red-500 
                hover:text-red-600 transition-colors"
            >
              <X size={14} />
              移除文件
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
              <Upload size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                拖拽文件到此处，或点击上传
              </p>
              <p className="text-xs text-gray-400 mt-1">
                支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 格式
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
