"use client";

import { Bell, User } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed top-0 right-0 left-[200px] h-14 bg-white 
      border-b border-gray-100 flex items-center justify-between px-6 z-40
      shadow-sm">
      {/* Left: breadcrumb or title */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">智能多格式批量下单系统</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 
          rounded-lg transition-colors">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
          <div className="w-8 h-8 bg-primary-50 text-primary-600 rounded-full 
            flex items-center justify-center text-sm font-medium">
            <User size={16} />
          </div>
          <span className="text-sm text-gray-600">管理员</span>
        </div>
      </div>
    </header>
  );
}
