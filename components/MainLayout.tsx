"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar />
      <Header />
      <main className="ml-[200px] pt-14 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
