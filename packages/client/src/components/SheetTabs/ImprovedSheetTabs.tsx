import React, { useState } from 'react';

interface Sheet {
  id: number;
  name: string;
  visible?: boolean;
}

interface ImprovedSheetTabsProps {
  sheets: Sheet[];
  currentSheet: number;
  onSheetChange: (sheetId: number) => void;
  onNewSheet: () => void;
  onRenameSheet?: (sheetId: number, newName: string) => void;
  onDeleteSheet?: (sheetId: number) => void;
  onDuplicateSheet?: (sheetId: number) => void;
}

/**
 * 改进的Sheet标签组件 - Luckysheet风格
 */
export default function ImprovedSheetTabs({ 
  sheets, 
  currentSheet, 
  onSheetChange, 
  onNewSheet,
  onRenameSheet,
  onDeleteSheet,
  onDuplicateSheet
}: ImprovedSheetTabsProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sheetId: number } | null>(null);
  const [editingSheet, setEditingSheet] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent, sheetId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sheetId });
  };

  // 开始重命名
  const startRename = (sheet: Sheet) => {
    setEditingSheet(sheet.id);
    setEditingName(sheet.name);
    setContextMenu(null);
  };

  // 提交重命名
  const submitRename = (sheetId: number) => {
    if (editingName.trim() && onRenameSheet) {
      onRenameSheet(sheetId, editingName.trim());
    }
    setEditingSheet(null);
    setEditingName('');
  };

  // 删除Sheet
  const handleDelete = (sheetId: number) => {
    if (sheets.length <= 1) {
      alert('至少需要保留一个工作表');
      return;
    }
    if (onDeleteSheet) {
      onDeleteSheet(sheetId);
    }
    setContextMenu(null);
  };

  // 复制Sheet
  const handleDuplicate = (sheetId: number) => {
    if (onDuplicateSheet) {
      onDuplicateSheet(sheetId);
    }
    setContextMenu(null);
  };

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  return (
    <div className="bg-gray-100 border-t border-gray-200 px-2 py-1 flex items-center justify-between relative select-none">
      {/* 左侧：Sheet导航按钮 */}
      <div className="flex items-center gap-1">
        <button 
          className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
          title="首页"
        >
          ⫷⫷
        </button>
        <button 
          className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
          title="上一页"
        >
          ‹
        </button>
        <button 
          className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
          title="下一页"
        >
          ›
        </button>
        <button 
          className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
          title="末页"
        >
          ⫸⫸
        </button>
      </div>

      {/* 中间：Sheet标签列表 */}
      <div className="flex-1 flex items-center gap-1 mx-2 overflow-x-auto">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`
              relative px-3 py-1 border-t border-l border-r rounded-t cursor-pointer text-sm min-w-24 text-center
              transition-colors duration-150
              ${sheet.id === currentSheet 
                ? 'bg-white border-gray-400 text-gray-800 border-b-0 font-medium' 
                : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 border-b'
              }
            `}
            onClick={() => onSheetChange(sheet.id)}
            onContextMenu={(e) => handleContextMenu(e, sheet.id)}
          >
            {editingSheet === sheet.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => submitRename(sheet.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitRename(sheet.id);
                  } else if (e.key === 'Escape') {
                    setEditingSheet(null);
                    setEditingName('');
                  }
                }}
                className="bg-transparent border-none outline-none text-center w-full"
                autoFocus
              />
            ) : (
              <span>{sheet.name}</span>
            )}
            
            {/* Sheet颜色指示器 */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        ))}

        {/* 新增Sheet按钮 */}
        <button
          className="w-8 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 text-sm"
          onClick={onNewSheet}
          title="插入工作表"
        >
          +
        </button>
      </div>

      {/* 右侧：控制按钮 */}
      <div className="flex items-center gap-2">
        {/* 缩放控制 */}
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs">
            -
          </button>
          <span className="text-sm text-gray-600 px-2 min-w-12 text-center">100%</span>
          <button className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs">
            +
          </button>
        </div>

        {/* 视图控制 */}
        <div className="flex items-center gap-1">
          <button 
            className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
            title="普通视图"
          >
            ⊞
          </button>
          <button 
            className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
            title="分页预览"
          >
            📄
          </button>
          <button 
            className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs"
            title="分页符预览"
          >
            📋
          </button>
        </div>
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-[9999] min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div 
            className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
            onClick={() => {
              const sheet = sheets.find(s => s.id === contextMenu.sheetId);
              if (sheet) startRename(sheet);
            }}
          >
            重命名工作表
          </div>
          <div 
            className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
            onClick={() => handleDuplicate(contextMenu.sheetId)}
          >
            复制工作表
          </div>
          <div className="border-t border-gray-100 my-1"></div>
          <div 
            className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
            onClick={() => handleDelete(contextMenu.sheetId)}
          >
            删除工作表
          </div>
          <div className="border-t border-gray-100 my-1"></div>
          <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm">
            移动到左侧
          </div>
          <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm">
            移动到右侧
          </div>
          <div className="border-t border-gray-100 my-1"></div>
          <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm">
            保护工作表
          </div>
          <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm">
            工作表属性
          </div>
        </div>
      )}
    </div>
  );
}
