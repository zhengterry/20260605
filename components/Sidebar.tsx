"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  List,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "首页", href: "/" },
  { icon: Upload, label: "文件导入", href: "/upload" },
  { icon: List, label: "已导入运单", href: "/orders" },
  { icon: Settings, label: "解析规则", href: "/rules" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-sidebar text-white z-50 
        flex flex-col transition-all duration-300 shadow-lg
        ${collapsed ? "w-[64px]" : "w-[200px]"}`}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold truncate text-white">
              万能导入
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg
                text-sm transition-all duration-200 group
                ${
                  isActive
                    ? "bg-primary-500 text-white font-medium shadow-md"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 border-t border-white/10 flex items-center justify-center
          text-gray-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
