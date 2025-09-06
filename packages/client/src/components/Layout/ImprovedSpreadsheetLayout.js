import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import FormattingToolbar from '@/components/Toolbar/FormattingToolbar';
import ImprovedGrid from '@/components/Grid/ImprovedGrid';
import StatusBar from '@/components/StatusBar/StatusBar';
import ImprovedSheetTabs from '@/components/SheetTabs/ImprovedSheetTabs';
import InviteModal from '@/components/Collaboration/InviteModal';
import ToastContainer from '@/components/Toast/ToastContainer';
import { useToastStore } from '@/stores/toastStore';
/**
 * 改进的电子表格布局 - 包含格式化工具栏
 */
export default function ImprovedSpreadsheetLayout({ gridId, sheetId, sheets = [{ id: 0, name: 'Sheet1' }], userPermission, onSheetChange = () => { }, onNewSheet = () => { }, onRenameSheet = () => { }, onDeleteSheet = () => { }, onDuplicateSheet = () => { }, onMoveSheet = () => { }, onProtectSheet = () => { } }) {
    const [showInviteModal, setShowInviteModal] = useState(false);
    const { toasts, removeToast } = useToastStore((s) => ({
        toasts: s.toasts,
        removeToast: s.removeToast
    }));
    // 计算当前Sheet的保护状态
    const currentSheet = sheets.find(s => s.id === sheetId);
    const isCurrentSheetProtected = currentSheet?.is_protected || false;
    // 计算用户是否有写权限
    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
    const isReadOnly = userPermission === 'read';
    console.log('🔒 当前Sheet保护状态:', { sheetId, isProtected: isCurrentSheetProtected, currentSheet });
    console.log('👤 用户权限状态:', { userPermission, hasWritePermission, isReadOnly });
    return (_jsxs("div", { className: "h-full flex flex-col bg-gray-50", children: [_jsxs("div", { className: "bg-white border-b border-gray-200 px-4 py-2 flex items-center", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "text-lg font-semibold text-gray-800", children: "Collab Grid" }), _jsx("div", { className: "text-sm text-gray-500", children: "\u7535\u5B50\u8868\u683C\u534F\u4F5C\u5DE5\u5177" })] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [isReadOnly && (_jsx("span", { className: "text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded", children: "\uD83D\uDC41\uFE0F \u53EA\u8BFB\u6A21\u5F0F" })), hasWritePermission && (_jsx("button", { className: "px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600", onClick: () => setShowInviteModal(true), children: "\uD83D\uDC65 \u9080\u8BF7\u534F\u4F5C" }))] })] }), _jsx(FormattingToolbar, { gridId: gridId, sheetId: sheetId, userPermission: userPermission, disabled: isReadOnly }), _jsx("div", { className: "flex-1 relative", children: _jsx(ImprovedGrid, { gridId: gridId, sheetId: sheetId, isProtected: isCurrentSheetProtected || isReadOnly, userPermission: userPermission }) }), _jsx(ImprovedSheetTabs, { sheets: sheets, currentSheet: sheetId, userPermission: userPermission, onSheetChange: onSheetChange, onNewSheet: hasWritePermission ? onNewSheet : undefined, onRenameSheet: hasWritePermission ? onRenameSheet : undefined, onDeleteSheet: hasWritePermission ? onDeleteSheet : undefined, onDuplicateSheet: hasWritePermission ? onDuplicateSheet : undefined, onMoveSheet: hasWritePermission ? onMoveSheet : undefined, onProtectSheet: hasWritePermission ? onProtectSheet : undefined }), _jsx(StatusBar, { gridId: gridId, sheetId: sheetId }), showInviteModal && (_jsx(InviteModal, { gridId: gridId, onClose: () => setShowInviteModal(false) })), _jsx(ToastContainer, { toasts: toasts, onRemoveToast: removeToast })] }));
}
