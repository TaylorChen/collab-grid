import React, { useState, useEffect, useRef } from 'react';
import { useGridStore } from '@/stores/gridStore';

interface FormattingToolbarProps {
  gridId: string;
  sheetId: number;
  userPermission?: string | null;
  disabled?: boolean;
}

/**
 * 格式化工具栏 - Luckysheet风格
 */
export default function FormattingToolbar({ gridId, sheetId, userPermission, disabled = false }: FormattingToolbarProps) {
  const { active, styles, setStyle } = useGridStore((s) => ({
    active: s.active,
    styles: s.styles || {},
    setStyle: s.setStyle
  }));

  // 获取当前选中单元格的样式
  const currentStyle = active ? styles[`${active.row}:${active.col}`] : null;
  
  // 本地状态
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  
  // Refs
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭颜色选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(event.target as Node)) {
        setShowBgColorPicker(false);
      }
    };

    if (showColorPicker || showBgColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker, showBgColorPicker]);

  // 应用样式
  const applyStyle = (styleUpdate: any) => {
    if (!active || disabled) return;
    setStyle(active.row, active.col, styleUpdate);
    console.log('🎨 应用样式:', styleUpdate, '到单元格:', active);
  };

  // 切换粗体
  const toggleBold = () => {
    applyStyle({ bold: !currentStyle?.bold });
  };

  // 切换斜体
  const toggleItalic = () => {
    applyStyle({ italic: !currentStyle?.italic });
  };

  // 切换下划线
  const toggleUnderline = () => {
    applyStyle({ underline: !currentStyle?.underline });
  };

  // 设置字体大小
  const setFontSize = (size: number) => {
    applyStyle({ fontSize: size });
  };

  // 设置对齐方式
  const setAlign = (align: 'left' | 'center' | 'right') => {
    applyStyle({ align });
  };

  // 设置文字颜色
  const setTextColor = (color: string) => {
    applyStyle({ color });
    setShowColorPicker(false);
  };

  // 设置背景颜色
  const setBgColor = (color: string) => {
    applyStyle({ bg: color });
    setShowBgColorPicker(false);
  };

  // 预设颜色
  const presetColors = [
    '#000000', '#444444', '#666666', '#999999', '#cccccc', '#eeeeee', '#f3f3f3', '#ffffff',
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
    '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0',
    '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79'
  ];

  return (
    <div className={`bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-1 select-none ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* 只读模式提示 */}
      {disabled && (
        <div className="mr-4 text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded flex items-center gap-1">
          👁️ 只读模式 - 格式化功能已禁用
        </div>
      )}
      
      {/* 字体大小 */}
      <div className="flex items-center gap-1 mr-2">
        <select 
          value={currentStyle?.fontSize || 12}
          onChange={(e) => setFontSize(Number(e.target.value))}
          disabled={disabled}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value={9}>9</option>
          <option value={10}>10</option>
          <option value={11}>11</option>
          <option value={12}>12</option>
          <option value={14}>14</option>
          <option value={16}>16</option>
          <option value={18}>18</option>
          <option value={20}>20</option>
          <option value={24}>24</option>
          <option value={28}>28</option>
          <option value={36}>36</option>
        </select>
      </div>

      {/* 分割线 */}
      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 粗体、斜体、下划线 */}
      <button
        onClick={toggleBold}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.bold ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="粗体 (Ctrl+B)"
      >
        <span className="font-bold text-sm">B</span>
      </button>

      <button
        onClick={toggleItalic}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.italic ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="斜体 (Ctrl+I)"
      >
        <span className="italic text-sm">I</span>
      </button>

      <button
        onClick={toggleUnderline}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.underline ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="下划线 (Ctrl+U)"
      >
        <span className="underline text-sm">U</span>
      </button>

      {/* 分割线 */}
      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 文字颜色 */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-8 h-8 flex flex-col items-center justify-center rounded hover:bg-gray-100"
          title="文字颜色"
        >
          <span className="text-xs">A</span>
          <div 
            className="w-6 h-1 rounded"
            style={{ backgroundColor: currentStyle?.color || '#000000' }}
          ></div>
        </button>

        {showColorPicker && (
          <div ref={colorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50">
            <div className="grid grid-cols-8 gap-1 w-64">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setTextColor(color)}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 背景颜色 */}
      <div className="relative">
        <button
          onClick={() => setShowBgColorPicker(!showBgColorPicker)}
          className="w-8 h-8 flex flex-col items-center justify-center rounded hover:bg-gray-100"
          title="背景颜色"
        >
          <span className="text-xs">🎨</span>
          <div 
            className="w-6 h-1 rounded"
            style={{ backgroundColor: currentStyle?.bg || '#ffffff' }}
          ></div>
        </button>

        {showBgColorPicker && (
          <div ref={bgColorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50">
            <div className="grid grid-cols-8 gap-1 w-64">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setBgColor(color)}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 分割线 */}
      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 对齐方式 */}
      <button
        onClick={() => setAlign('left')}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.align === 'left' ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="左对齐"
      >
        <span className="text-xs">⫸</span>
      </button>

      <button
        onClick={() => setAlign('center')}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.align === 'center' ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="居中对齐"
      >
        <span className="text-xs">≡</span>
      </button>

      <button
        onClick={() => setAlign('right')}
        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${
          currentStyle?.align === 'right' ? 'bg-blue-100 text-blue-600' : ''
        }`}
        title="右对齐"
      >
        <span className="text-xs">⫷</span>
      </button>

      {/* 分割线 */}
      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 边框按钮（预留） */}
      <button
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
        title="边框"
      >
        <span className="text-xs">⊞</span>
      </button>

      {/* 合并单元格（预留） */}
      <button
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
        title="合并单元格"
      >
        <span className="text-xs">⊕</span>
      </button>

      {/* 当前选中信息 */}
      <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
        {active && (
          <>
            <span>单元格: {String.fromCharCode(65 + active.col)}{active.row + 1}</span>
            {currentStyle && (
              <span className="text-xs">
                ({currentStyle.fontSize || 12}px, {currentStyle.bold ? '粗体' : '正常'})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
