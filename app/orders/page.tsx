"use client";

import { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

interface OrderRecord {
  id: string;
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  items: Array<{
    skuCode: string;
    skuName: string;
    skuQuantity: number;
    skuSpec?: string;
  }>;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (searchCode) params.set("externalCode", searchCode);
      if (searchName) params.set("receiverName", searchName);

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("加载订单失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条运单？此操作不可恢复。`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchOrders();
      }
    } catch (err) {
      console.error("批量删除失败:", err);
    } finally {
      setDeleting(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "submitted":
        return <span className="tag tag-green">已提交</span>;
      case "failed":
        return <span className="tag tag-red">失败</span>;
      default:
        return <span className="tag tag-orange">待提交</span>;
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">已导入运单</h1>
          <p className="text-sm text-gray-500 mt-1">
            查看所有历史已导入的运单记录
          </p>
        </div>

        {/* 筛选栏 */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="外部编码..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="input-field max-w-[200px]"
            />
            <input
              type="text"
              placeholder="收件人姓名..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="input-field max-w-[200px]"
            />
            <button onClick={handleSearch} className="btn-primary text-sm">
              搜索
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                disabled={deleting}
                className="btn-danger flex items-center gap-1 text-xs px-3 py-1.5"
              >
                <Trash2 size={14} />
                {deleting ? "删除中..." : `删除选中(${selectedIds.size})`}
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              共 {total} 条记录
            </span>
          </div>
        </div>

        {/* 列表 */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-gray-50 rounded mb-2 animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-2">暂无运单记录</p>
              <p className="text-sm text-gray-400 mb-4">导入并提交文件后将在此显示</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-center w-10">
                      <button onClick={toggleSelectAll} className="text-gray-400 hover:text-primary-500">
                        {selectedIds.size === orders.length && orders.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">外部编码</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">收货门店</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">收件人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">电话</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">物品数</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">导入时间</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-1 py-3 text-center">
                        <button onClick={() => toggleSelect(order.id)} className="text-gray-400 hover:text-primary-500">
                          {selectedIds.has(order.id)
                            ? <CheckSquare size={16} className="text-primary-500" />
                            : <Square size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {order.externalCode || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {order.storeName || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {order.receiverName || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {order.receiverPhone || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-gray-600">
                        {order.items?.length || 0} 件
                      </td>
                      <td className="px-4 py-3 text-center">
                        {statusLabel(order.status)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString("zh-CN")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-gray-400 hover:text-primary-500 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* 详情抽屉 */}
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-black/30 z-50 flex justify-end"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="w-[480px] h-full bg-white shadow-xl overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">运单详情</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">外部编码</span>
                    <p className="text-gray-700 mt-0.5">{selectedOrder.externalCode || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">状态</span>
                    <p className="mt-0.5">{statusLabel(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">收货门店</span>
                    <p className="text-gray-700 mt-0.5">{selectedOrder.storeName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">收件人</span>
                    <p className="text-gray-700 mt-0.5">{selectedOrder.receiverName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">电话</span>
                    <p className="text-gray-700 mt-0.5">{selectedOrder.receiverPhone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">导入时间</span>
                    <p className="text-gray-700 mt-0.5">
                      {new Date(selectedOrder.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
                {selectedOrder.receiverAddress && (
                  <div className="text-sm">
                    <span className="text-gray-400">收货地址</span>
                    <p className="text-gray-700 mt-0.5">{selectedOrder.receiverAddress}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-400">物品明细</span>
                  <table className="w-full mt-2 text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs text-gray-500">SKU编码</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-500">名称</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500">数量</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-500">规格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 text-xs">{item.skuCode}</td>
                          <td className="px-3 py-2 text-xs">{item.skuName}</td>
                          <td className="px-3 py-2 text-xs text-right">{item.skuQuantity}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{item.skuSpec || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
