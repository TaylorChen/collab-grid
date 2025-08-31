import React, { useState } from 'react';
import { useGridStore } from '@/stores/gridStore';
import { getWS } from '@/services/websocket';
import { toast } from '@/stores/toastStore';

interface GridContextMenuProps {
  x: number;
  y: number;
  row: number;
  col: number;
  onClose: () => void;
  gridId: string;
  sheetId: number;
  userPermission?: string | null;
}

/**
 * 表格右键上下文菜单 - Luckysheet风格
 */
export default function GridContextMenu({ x, y, row, col, onClose, gridId, sheetId, userPermission }: GridContextMenuProps) {
  const { cells, setCell, setStyle, styles } = useGridStore((s) => ({
    cells: s.cells || {},
    setCell: s.setCell,
    setStyle: s.setStyle,
    styles: s.styles || {}
  }));

  const [showFormatMenu, setShowFormatMenu] = useState(false);
  
  const cellKey = `${row}:${col}`;
  const currentValue = cells[cellKey];
  const currentStyle = styles[cellKey];
  
  // 检查用户是否有编辑权限
  const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
  const isReadOnly = userPermission === 'read';

  // 辅助函数：发送单元格更新到服务器
  const sendCellUpdate = (newValue: string | null) => {
    const socket = getWS();
    if (socket) {
      socket.emit("grid:operation", {
        id: crypto.randomUUID?.() || String(Date.now()),
        gridId,
        sheetId,
        actorId: null,
        type: "cell:update",
        payload: { row, col, value: newValue }
      });
      console.log('📡 发送WebSocket保存事件:', { row, col, value: newValue });
    } else {
      console.warn('⚠️ WebSocket未连接，无法保存到服务器');
    }
  };

  // 复制
  const handleCopy = () => {
    if (currentValue != null) {
      navigator.clipboard.writeText(String(currentValue));
      console.log('📋 复制内容:', currentValue);
    }
    onClose();
  };

  // 剪切
  const handleCut = () => {
    if (isReadOnly) {
      toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
      onClose();
      return;
    }
    if (currentValue != null) {
      navigator.clipboard.writeText(String(currentValue));
      setCell(row, col, '');
      sendCellUpdate('');
      console.log('✂️ 剪切内容:', currentValue);
    }
    onClose();
  };

  // 粘贴
  const handlePaste = async () => {
    if (isReadOnly) {
      toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
      onClose();
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      setCell(row, col, text);
      sendCellUpdate(text);
      console.log('📌 粘贴内容:', text);
    } catch (error) {
      console.error('粘贴失败:', error);
    }
    onClose();
  };

  // 清除内容
  const handleClearContent = () => {
    if (isReadOnly) {
      toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
      onClose();
      return;
    }
    setCell(row, col, '');
    sendCellUpdate('');
    console.log('🗑️ 清除内容');
    onClose();
  };

  // 清除格式
  const handleClearFormat = () => {
    setStyle(row, col, {});
    console.log('🎨 清除格式');
    onClose();
  };

  // 插入行
  const handleInsertRow = (position: 'above' | 'below') => {
    console.log(`➕ 插入行 ${position === 'above' ? '上方' : '下方'}`);
    // TODO: 实现插入行逻辑
    onClose();
  };

  // 插入列
  const handleInsertCol = (position: 'left' | 'right') => {
    console.log(`➕ 插入列 ${position === 'left' ? '左侧' : '右侧'}`);
    // TODO: 实现插入列逻辑
    onClose();
  };

  // 删除行
  const handleDeleteRow = () => {
    console.log('🗑️ 删除行');
    // TODO: 实现删除行逻辑
    onClose();
  };

  // 删除列
  const handleDeleteCol = () => {
    console.log('🗑️ 删除列');
    // TODO: 实现删除列逻辑
    onClose();
  };

  // 快速格式化
  const handleQuickFormat = (format: any) => {
    setStyle(row, col, { ...currentStyle, ...format });
    console.log('⚡ 快速格式化:', format);
    onClose();
  };

  return (
    <div 
      className="fixed bg-white border border-gray-300 rounded shadow-lg py-1 z-[9999] min-w-[180px] text-sm select-none"
      style={{ left: x, top: y }}
    >
      {/* 剪贴板操作 */}
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleCopy}>
        <span className="text-gray-500">📋</span>
        <span>复制</span>
        <span className="ml-auto text-xs text-gray-400">Ctrl+C</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleCut}>
        <span className="text-gray-500">✂️</span>
        <span>剪切</span>
        <span className="ml-auto text-xs text-gray-400">Ctrl+X</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handlePaste}>
        <span className="text-gray-500">📌</span>
        <span>粘贴</span>
        <span className="ml-auto text-xs text-gray-400">Ctrl+V</span>
      </div>

      <div className="border-t border-gray-100 my-1"></div>

      {/* 插入操作 */}
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={() => handleInsertRow('above')}>
        <span className="text-gray-500">⬆️</span>
        <span>在上方插入行</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={() => handleInsertRow('below')}>
        <span className="text-gray-500">⬇️</span>
        <span>在下方插入行</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={() => handleInsertCol('left')}>
        <span className="text-gray-500">⬅️</span>
        <span>在左侧插入列</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={() => handleInsertCol('right')}>
        <span className="text-gray-500">➡️</span>
        <span>在右侧插入列</span>
      </div>

      <div className="border-t border-gray-100 my-1"></div>

      {/* 删除操作 */}
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleDeleteRow}>
        <span className="text-gray-500">🗑️</span>
        <span>删除行</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleDeleteCol}>
        <span className="text-gray-500">🗑️</span>
        <span>删除列</span>
      </div>

      <div className="border-t border-gray-100 my-1"></div>

      {/* 清除操作 */}
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleClearContent}>
        <span className="text-gray-500">🧹</span>
        <span>清除内容</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2" onClick={handleClearFormat}>
        <span className="text-gray-500">🎨</span>
        <span>清除格式</span>
      </div>

      <div className="border-t border-gray-100 my-1"></div>

      {/* 快速格式化 */}
      <div 
        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 relative"
        onMouseEnter={() => setShowFormatMenu(true)}
        onMouseLeave={() => setShowFormatMenu(false)}
      >
        <span className="text-gray-500">⚡</span>
        <span>快速格式化</span>
        <span className="ml-auto text-xs text-gray-400">▶</span>
        
        {/* 快速格式化子菜单 */}
        {showFormatMenu && (
          <div className="absolute left-full top-0 ml-1 bg-white border border-gray-300 rounded shadow-lg py-1 min-w-[140px]">
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ bold: true })}>
              <span className="font-bold">加粗</span>
            </div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ italic: true })}>
              <span className="italic">斜体</span>
            </div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ underline: true })}>
              <span className="underline">下划线</span>
            </div>
            <div className="border-t border-gray-100 my-1"></div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ color: '#ff0000' })}>
              <span style={{ color: '#ff0000' }}>红色文字</span>
            </div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ bg: '#ffff00' })}>
              <span style={{ backgroundColor: '#ffff00' }}>黄色背景</span>
            </div>
            <div className="border-t border-gray-100 my-1"></div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ fontSize: 16 })}>
              大字体 (16px)
            </div>
            <div className="px-3 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => handleQuickFormat({ fontSize: 10 })}>
              小字体 (10px)
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 my-1"></div>

      {/* 其他操作 */}
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
        <span className="text-gray-500">🔗</span>
        <span>插入超链接</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
        <span className="text-gray-500">💬</span>
        <span>插入批注</span>
      </div>
      <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
        <span className="text-gray-500">⚙️</span>
        <span>单元格属性</span>
      </div>

      {/* 调试信息 */}
      <div className="border-t border-gray-100 my-1"></div>
      <div className="px-3 py-1 text-xs text-gray-500">
        单元格: {String.fromCharCode(65 + col)}{row + 1}
      </div>
    </div>
  );
}
