import React, { useState } from 'react';
import FormattingToolbar from '@/components/Toolbar/FormattingToolbar';
import ImprovedGrid from '@/components/Grid/ImprovedGrid';
import StatusBar from '@/components/StatusBar/StatusBar';
import ImprovedSheetTabs from '@/components/SheetTabs/ImprovedSheetTabs';
import InviteModal from '@/components/Collaboration/InviteModal';
import ToastContainer from '@/components/Toast/ToastContainer';
import { useToastStore } from '@/stores/toastStore';

interface Sheet {
  id: number;
  name: string;
  visible?: boolean;
  is_protected?: boolean;
}

interface ImprovedSpreadsheetLayoutProps {
  gridId: string;
  sheetId: number;
  sheets?: Sheet[];
  userPermission?: string | null;
  onSheetChange?: (sheetId: number) => void;
  onNewSheet?: () => void;
  onRenameSheet?: (sheetId: number, newName: string) => void;
  onDeleteSheet?: (sheetId: number) => void;
  onDuplicateSheet?: (sheetId: number) => void;
  onMoveSheet?: (sheetId: number, direction: 'left' | 'right') => void;
  onProtectSheet?: (sheetId: number) => void;
}

/**
 * 改进的电子表格布局 - 包含格式化工具栏
 */
export default function ImprovedSpreadsheetLayout({ 
  gridId, 
  sheetId, 
  sheets = [{ id: 0, name: 'Sheet1' }],
  userPermission,
  onSheetChange = () => {},
  onNewSheet = () => {},
  onRenameSheet = () => {},
  onDeleteSheet = () => {},
  onDuplicateSheet = () => {},
  onMoveSheet = () => {},
  onProtectSheet = () => {}
}: ImprovedSpreadsheetLayoutProps) {
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
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold text-gray-800">Collab Grid</div>
          <div className="text-sm text-gray-500">电子表格协作工具</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 权限标识 */}
          {isReadOnly && (
            <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
              👁️ 只读模式
            </span>
          )}
          {/* 只有拥有者和写权限用户可以邀请协作者 */}
          {hasWritePermission && (
            <button 
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => setShowInviteModal(true)}
            >
              👥 邀请协作
            </button>
          )}
        </div>
      </div>

      {/* 格式化工具栏 */}
      <FormattingToolbar 
        gridId={gridId} 
        sheetId={sheetId} 
        userPermission={userPermission}
        disabled={isReadOnly}
      />

      {/* 主表格区域 */}
      <div className="flex-1 relative">
        <ImprovedGrid 
          gridId={gridId} 
          sheetId={sheetId} 
          isProtected={isCurrentSheetProtected || isReadOnly} 
          userPermission={userPermission}
        />
      </div>

      {/* Sheet标签 */}
      <ImprovedSheetTabs 
        sheets={sheets}
        currentSheet={sheetId}
        userPermission={userPermission}
        onSheetChange={onSheetChange}
        onNewSheet={hasWritePermission ? onNewSheet : undefined}
        onRenameSheet={hasWritePermission ? onRenameSheet : undefined}
        onDeleteSheet={hasWritePermission ? onDeleteSheet : undefined}
        onDuplicateSheet={hasWritePermission ? onDuplicateSheet : undefined}
        onMoveSheet={hasWritePermission ? onMoveSheet : undefined}
        onProtectSheet={hasWritePermission ? onProtectSheet : undefined}
      />

      {/* 底部状态栏 */}
      <StatusBar gridId={gridId} sheetId={sheetId} />
      
      {/* 邀请协作模态框 */}
      {showInviteModal && (
        <InviteModal 
          gridId={gridId}
          onClose={() => setShowInviteModal(false)}
        />
      )}
      
      {/* Toast 气泡提示 */}
      <ToastContainer 
        toasts={toasts}
        onRemoveToast={removeToast}
      />
    </div>
  );
}
