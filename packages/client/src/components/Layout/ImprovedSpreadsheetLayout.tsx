import React from 'react';
import FormattingToolbar from '@/components/Toolbar/FormattingToolbar';
import ImprovedGrid from '@/components/Grid/ImprovedGrid';
import StatusBar from '@/components/StatusBar/StatusBar';
import ImprovedSheetTabs from '@/components/SheetTabs/ImprovedSheetTabs';

interface Sheet {
  id: number;
  name: string;
  visible?: boolean;
}

interface ImprovedSpreadsheetLayoutProps {
  gridId: string;
  sheetId: number;
  sheets?: Sheet[];
  onSheetChange?: (sheetId: number) => void;
  onNewSheet?: () => void;
  onRenameSheet?: (sheetId: number, newName: string) => void;
  onDeleteSheet?: (sheetId: number) => void;
}

/**
 * 改进的电子表格布局 - 包含格式化工具栏
 */
export default function ImprovedSpreadsheetLayout({ 
  gridId, 
  sheetId, 
  sheets = [{ id: 0, name: 'Sheet1' }],
  onSheetChange = () => {},
  onNewSheet = () => {},
  onRenameSheet = () => {},
  onDeleteSheet = () => {}
}: ImprovedSpreadsheetLayoutProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold text-gray-800">Collab Grid</div>
          <div className="text-sm text-gray-500">电子表格协作工具</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            保存
          </button>
          <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
            分享
          </button>
        </div>
      </div>

      {/* 格式化工具栏 */}
      <FormattingToolbar gridId={gridId} sheetId={sheetId} />

      {/* 主表格区域 */}
      <div className="flex-1 relative">
        <ImprovedGrid gridId={gridId} sheetId={sheetId} />
      </div>

      {/* Sheet标签 */}
      <ImprovedSheetTabs 
        sheets={sheets}
        currentSheet={sheetId}
        onSheetChange={onSheetChange}
        onNewSheet={onNewSheet}
        onRenameSheet={onRenameSheet}
        onDeleteSheet={onDeleteSheet}
      />

      {/* 底部状态栏 */}
      <StatusBar gridId={gridId} sheetId={sheetId} />
    </div>
  );
}
