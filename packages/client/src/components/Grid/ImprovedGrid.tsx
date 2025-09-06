import React, { useEffect, useRef, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { useUserStore } from "@/stores/userStore";
import { getWS } from "@/services/websocket";
import GridContextMenu from "@/components/ContextMenu/GridContextMenu";
import { toast } from '@/stores/toastStore';

const CELL_W = 80;
const CELL_H = 24;
const HEADER_W = 48;
const HEADER_H = 24;

/**
 * 改进的表格组件 - 修复滚动同步问题
 * 参考Luckysheet的实现方式
 */
interface ImprovedGridProps {
  gridId?: string;
  sheetId?: number;
  isProtected?: boolean;
  userPermission?: string | null;
}

export default function ImprovedGrid({ gridId = "demo", sheetId = 0, isProtected = false, userPermission }: ImprovedGridProps) {
  
  // 检查当前Sheet是否受保护或用户无编辑权限
  const isSheetProtected = () => {
    const isReadOnly = userPermission === 'read';
    const result = isProtected || isReadOnly;
    return result;
  };
  
  // 获取保护提示信息
  const getProtectionMessage = () => {
    if (userPermission === 'read') {
      return '您只有只读权限，无法编辑此表格。';
    }
    return '此工作表受到保护，无法编辑单元格。\n要编辑单元格，请先取消工作表保护。';
  };

  // 生成编辑token用于锁机制
  const generateEditToken = () => `edit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // 当前编辑会话的token
  const [currentEditToken, setCurrentEditToken] = useState<string | null>(null);

  // 获取单元格锁
  const acquireCellLock = (row: number, col: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = getWS();
      if (!socket) {
        resolve(false);
        return;
      }

      const token = generateEditToken();
      setCurrentEditToken(token);

      // 监听锁获取结果
      const handleLockGranted = ({ cellKey, token: grantedToken }: any) => {
        if (grantedToken === token) {
          socket.off('cell:lock:granted', handleLockGranted);
          socket.off('cell:lock:denied', handleLockDenied);
          resolve(true);
        }
      };

      const handleLockDenied = ({ cellKey, holder, token: deniedToken }: any) => {
        if (deniedToken === token) {
          socket.off('cell:lock:granted', handleLockGranted);
          socket.off('cell:lock:denied', handleLockDenied);
          
          // 显示锁被拒绝的提示
          if (holder?.displayName || holder?.name) {
            toast.warning(`${holder.displayName || holder.name} 正在编辑此单元格`, 3000);
          } else {
            toast.warning('其他用户正在编辑此单元格', 3000);
          }
          resolve(false);
        }
      };

      socket.on('cell:lock:granted', handleLockGranted);
      socket.on('cell:lock:denied', handleLockDenied);

      // 请求锁
      socket.emit('cell:lock:acquire', {
        gridId,
        sheetId,
        row,
        col,
        token
      });

      // 5秒超时
      setTimeout(() => {
        socket.off('cell:lock:granted', handleLockGranted);
        socket.off('cell:lock:denied', handleLockDenied);
        resolve(false);
      }, 5000);
    });
  };

  // 释放单元格锁
  const releaseCellLock = (row: number, col: number) => {
    const socket = getWS();
    if (!socket || !currentEditToken) return;

    socket.emit('cell:lock:release', {
      gridId,
      sheetId,
      row,
      col,
      token: currentEditToken
    });
    
    setCurrentEditToken(null);
  };

  // 检查单元格是否被锁定
  const isCellLocked = (row: number, col: number) => {
    const cellKey = `${sheetId}:${row}:${col}`;
    const lock = lockByCell[cellKey];
    if (!lock) return false;
    
    // 如果是当前用户锁定，则不算被锁定
    const currentUserId = user?.id ? String(user.id) : null;
    return lock.userId !== currentUserId;
  };

  // 获取锁定此单元格的用户信息
  const getCellLockHolder = (row: number, col: number) => {
    const cellKey = `${sheetId}:${row}:${col}`;
    return lockByCell[cellKey];
  };
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const colHeaderCanvasRef = useRef<HTMLCanvasElement>(null);
  const rowHeaderCanvasRef = useRef<HTMLCanvasElement>(null);
  const colHeaderCursorRef = useRef<string>('default');
  const rowHeaderCursorRef = useRef<string>('default');
  const [resizing, setResizing] = useState<{ mode: 'col' | 'row'; index: number; startPos: number; startSize: number } | null>(null);
  
  // Store state
  const { 
    rows, cols, cells, styles, rowHeights, colWidths, active, selection,
    freezeRows, freezeCols, setCell, setActive, clearSelection,
    setRowHeight, setColWidth,
    undo, redo, canUndo, canRedo, history, historyIndex, mergedCells, getMergedCell, getCellDisplayValue,
    mergeCells, unmergeCells
  } = useGridStore((s: any) => {
    
    return {
    rows: s.rows, cols: s.cols, cells: s.cells || {}, styles: s.styles || {},
    rowHeights: s.rowHeights || [], colWidths: s.colWidths || [], 
    active: s.active, selection: s.selection,
    freezeRows: s.freezeRows ?? 0, freezeCols: s.freezeCols ?? 0,
    setCell: s.setCell, setActive: s.setActive, 
    setRowHeight: s.setRowHeight, setColWidth: s.setColWidth,
    clearSelection: s.clearSelection || (() => {}), // 添加默认函数防止错误
    undo: s.undo, redo: s.redo, canUndo: s.canUndo, canRedo: s.canRedo,
      history: s.history || [], historyIndex: s.historyIndex ?? -1,
      mergedCells: s.mergedCells || {}, 
      getMergedCell: s.getMergedCell || (() => null), // 添加默认函数防止错误
      getCellDisplayValue: s.getCellDisplayValue || ((row: number, col: number) => s.cells?.[`${row}:${col}`] || ''), // 添加默认函数防止错误
      mergeCells: s.mergeCells,
      unmergeCells: s.unmergeCells
    };
  });

  // Realtime state
  const { lockByCell, presenceByCell } = useRealtimeStore((s: any) => ({
    lockByCell: s.lockByCell || {},
    presenceByCell: s.presenceByCell || {}
  }));

  // User state
  const { user } = useUserStore((s) => ({
    user: s.user
  }));
  
  
  // Local state
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null);

  // 组件卸载时清理锁
  useEffect(() => {
    return () => {
      if (editing && currentEditToken) {
        releaseCellLock(editing.row, editing.col);
      }
    };
  }, []);

  // 向服务器广播当前激活单元格的存在（presence），帮助其他协作者知晓多人关注/操作同一格
  useEffect(() => {
    const socket = getWS();
    if (!socket) return;
    const target = editing ?? active;
    if (!target) return;
    const cellKey = `${sheetId}:${target.row}:${target.col}`;
    try {
      const name = user?.name || user?.displayName || '我';
      socket.emit('cell:presence', { gridId, sheetId, cellKey, user: { userId: user?.id || 'me', displayName: name } });
    } catch {}
  }, [gridId, sheetId, active?.row, active?.col, editing?.row, editing?.col]);

  // 监听编辑状态变化，定期续期锁
  useEffect(() => {
    if (!editing || !currentEditToken) return;

    const renewInterval = setInterval(() => {
      const socket = getWS();
      if (socket) {
        socket.emit('cell:lock:renew', {
          gridId,
          sheetId,
          row: editing.row,
          col: editing.col,
          token: currentEditToken
        });
      }
    }, 2000); // 每2秒续期一次

    return () => clearInterval(renewInterval);
  }, [editing, currentEditToken, gridId, sheetId]);
  
  // 滚动事件处理
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    
    
    const handleScroll = () => {
      const newScroll = {
        left: scrollContainer.scrollLeft,
        top: scrollContainer.scrollTop
      };
      setScroll(newScroll);
    };
    
    // 测试滚动容器状态已移除
    
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 容器尺寸监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    
    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);
  

  
  // 键盘焦点管理和初始化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleContainerClick = () => {
      const canvas = mainCanvasRef.current;
      if (canvas) canvas.focus();
    };
    
    // 自动选择第一个单元格
    if (!active) {
      setActive(0, 0);
    }
    
    container.addEventListener('click', handleContainerClick);
    return () => container.removeEventListener('click', handleContainerClick);
  }, [active, setActive]);
  
  // 计算总尺寸
  
  const totalWidth = colWidths.slice(0, cols).reduce((sum: number, w: number | undefined) => sum + (w ?? CELL_W), 0);
  const totalHeight = rowHeights.slice(0, rows).reduce((sum: number, h: number | undefined) => sum + (h ?? CELL_H), 0);
  
  
  // 🚨 紧急修复：如果colWidths为空且cols>0，强制初始化
  useEffect(() => {
    if (cols > 0 && colWidths.length === 0) {
      useGridStore.getState().setActiveSheet(sheetId);
    }
  }, [cols, colWidths.length, sheetId]);
  
  // 🚨 紧急修复：如果rowHeights为空且rows>0，强制初始化  
  useEffect(() => {
    if (rows > 0 && rowHeights.length === 0) {
      // setActiveSheet会同时处理rowHeights和colWidths
    }
  }, [rows, rowHeights.length, sheetId]);
  
  // 渲染列标题
  useEffect(() => {
    const canvas = colHeaderCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = containerSize.width - HEADER_W;
    const h = HEADER_H;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);
    
    // 计算可见列范围
    let startCol = 0;
    let offset = scroll.left;
    
    // 跳过冻结列
    if (freezeCols > 0) {
      for (let i = 0; i < freezeCols; i++) {
        offset += (colWidths[i] ?? CELL_W);
      }
      startCol = freezeCols;
    }
    
    while (startCol < cols && offset > 0) {
      const cw = colWidths[startCol] ?? CELL_W;
      if (offset < cw) break;
      offset -= cw;
      startCol++;
    }
    
    ctx.textBaseline = 'middle';
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#e5e7eb';
    
    const getColName = (n: number) => {
      let s = '';
      let t = n;
      do {
        s = String.fromCharCode(65 + (t % 26)) + s;
        t = Math.floor(t / 26) - 1;
      } while (t >= 0);
      return s;
    };
    
    let x = -offset;
    
    // 渲染冻结列头
    if (freezeCols > 0) {
      let frozenX = 0;
      for (let c = 0; c < freezeCols && c < cols; c++) {
        const cw = colWidths[c] ?? CELL_W;
        
        // 背景
        ctx.fillStyle = '#e5f3ff';
        ctx.fillRect(frozenX, 0, cw, h);
        
        // 文本
        ctx.fillStyle = '#374151';
        const label = getColName(c);
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, frozenX + cw / 2 - tw / 2, h / 2);
        
        // 边框
        ctx.beginPath();
        ctx.moveTo(frozenX + cw - 0.5, 0);
        ctx.lineTo(frozenX + cw - 0.5, h);
        ctx.stroke();
        
        frozenX += cw;
      }
      
      x += frozenX;
    }
    
    // 渲染滚动列头
    for (let c = startCol; c < cols && x < w; c++) {
      const cw = colWidths[c] ?? CELL_W;
      
      // 文本
      const label = getColName(c);
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, x + cw / 2 - tw / 2, h / 2);
      
      // 边框
      ctx.beginPath();
      ctx.moveTo(x + cw - 0.5, 0);
      ctx.lineTo(x + cw - 0.5, h);
      ctx.stroke();
      
      x += cw;
    }
    
    // 底部边框
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();
    
  }, [scroll.left, containerSize.width, colWidths, cols, freezeCols]);

  // Header edge helpers
  const findColEdgeNear = (x: number, tolerance = 4): number | null => {
    let acc = 0;
    for (let c = 0; c < cols; c++) {
      const cw = colWidths[c] ?? CELL_W;
      const edge = acc + cw;
      if (Math.abs(edge - x) <= tolerance) return c;
      acc += cw;
    }
    return null;
  };
  const findRowEdgeNear = (y: number, tolerance = 3): number | null => {
    let acc = 0;
    for (let r = 0; r < rows; r++) {
      const rh = rowHeights[r] ?? CELL_H;
      const edge = acc + rh;
      if (Math.abs(edge - y) <= tolerance) return r;
      acc += rh;
    }
    return null;
  };
  
  // 渲染行标题
  useEffect(() => {
    const canvas = rowHeaderCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = HEADER_W;
    const h = containerSize.height - HEADER_H;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);
    
    // 计算可见行范围
    let startRow = 0;
    let offset = scroll.top;
    
    // 跳过冻结行
    if (freezeRows > 0) {
      for (let i = 0; i < freezeRows; i++) {
        offset += (rowHeights[i] ?? CELL_H);
      }
      startRow = freezeRows;
    }
    
    while (startRow < rows && offset > 0) {
      const rh = rowHeights[startRow] ?? CELL_H;
      if (offset < rh) break;
      offset -= rh;
      startRow++;
    }
    
    ctx.textBaseline = 'middle';
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#e5e7eb';
    
    let y = -offset;
    
    // 渲染冻结行头
    if (freezeRows > 0) {
      let frozenY = 0;
      for (let r = 0; r < freezeRows && r < rows; r++) {
        const rh = rowHeights[r] ?? CELL_H;
        
        // 背景
        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(0, frozenY, w, rh);
        
        // 文本
        ctx.fillStyle = '#374151';
        const label = String(r + 1);
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, w / 2 - tw / 2, frozenY + rh / 2);
        
        // 边框
        ctx.beginPath();
        ctx.moveTo(0, frozenY + rh - 0.5);
        ctx.lineTo(w, frozenY + rh - 0.5);
        ctx.stroke();
        
        frozenY += rh;
      }
      
      y += frozenY;
    }
    
    // 渲染滚动行头
    for (let r = startRow; r < rows && y < h; r++) {
      const rh = rowHeights[r] ?? CELL_H;
      
      // 文本
      const label = String(r + 1);
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, w / 2 - tw / 2, y + rh / 2);
      
      // 边框
      ctx.beginPath();
      ctx.moveTo(0, y + rh - 0.5);
      ctx.lineTo(w, y + rh - 0.5);
      ctx.stroke();
      
      y += rh;
    }
    
    // 右边框
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 1, 0);
    ctx.lineTo(w - 1, h);
    ctx.stroke();
    
  }, [scroll.top, containerSize.height, rowHeights, rows, freezeRows]);
  
  // 渲染主内容
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) {
      return;
    }
    
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    
    
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, totalWidth, totalHeight);
    
    // 渲染网格和内容
    ctx.strokeStyle = '#e5e7eb';
    ctx.fillStyle = '#000';
    ctx.font = '12px system-ui';
    ctx.textBaseline = 'middle';
    
    // 记录跳过的单元格（被合并的单元格）
    const skippedCells = new Set<string>();
    

    
    let y = 0;
    for (let r = 0; r < rows; r++) {
      const rh = rowHeights[r] ?? CELL_H;
      let x = 0;
      
      for (let c = 0; c < cols; c++) {
        const cw = colWidths[c] ?? CELL_W;
        const cellKey = `${r}:${c}`;
        
        // 检查是否在合并区域内但不是左上角单元格
        if (skippedCells.has(cellKey)) {
          x += cw;
          continue;
        }
        
        // 合并功能已禁用，所有单元格正常渲染
        let shouldRender = true;
        let actualWidth = cw;
        let actualHeight = rh;
        
        // 如果不应该渲染，跳过这个单元格
        if (!shouldRender) {
          x += cw;
          continue;
        }
        
        // 默认网格线（浅色）
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(x + 0.5, y + 0.5, actualWidth - 1, actualHeight - 1);
        ctx.stroke();
        
        
        
        // 内容和样式
        // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
        const value = getCellDisplayValue ? getCellDisplayValue(r, c) : cells[cellKey];
        const style = styles[cellKey];
        
        // 应用背景色
        if (style?.bg) {
          ctx.fillStyle = style.bg;
          ctx.fillRect(x + 1, y + 1, actualWidth - 2, actualHeight - 2);
        }
        
        if (value != null && value !== '') {
          const text = String(value);
          
          // 设置字体样式
          let fontStr = '';
          if (style?.bold) fontStr += 'bold ';
          if (style?.italic) fontStr += 'italic ';
          fontStr += `${style?.fontSize || 12}px system-ui`;
          ctx.font = fontStr;
          
          // 设置文字颜色
          ctx.fillStyle = style?.color || '#000';
          
          // 计算文字位置（适配合并单元格）
          let textX = x + 4;
          if (style?.align === 'center') {
            const textWidth = ctx.measureText(text).width;
            textX = x + actualWidth / 2 - textWidth / 2;
          } else if (style?.align === 'right') {
            const textWidth = ctx.measureText(text).width;
            textX = x + actualWidth - 4 - textWidth;
          }
          
          ctx.fillText(text, textX, y + actualHeight / 2);
          
          // 绘制下划线
          if (style?.underline) {
            const textWidth = ctx.measureText(text).width;
            ctx.beginPath();
            ctx.moveTo(textX, y + actualHeight / 2 + 2);
            ctx.lineTo(textX + textWidth, y + actualHeight / 2 + 2);
            ctx.strokeStyle = style?.color || '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        
        // 绘制自定义边框
        if (style?.border) {
          const border = style.border;
          ctx.save();
          
          // 解析边框样式 "1px solid #000000"
          const parseBorderStyle = (borderStr: string) => {
            if (!borderStr || borderStr === 'none') return null;
            const parts = borderStr.split(' ');
            return {
              width: parseInt(parts[0]) || 1,
              color: parts[2] || '#000000'
            };
          };
          
          // 上边框
          if (border.top) {
            const borderStyle = parseBorderStyle(border.top);
            if (borderStyle) {
              ctx.strokeStyle = borderStyle.color;
              ctx.lineWidth = borderStyle.width;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + actualWidth, y);
              ctx.stroke();
            }
          }
          
          // 右边框
          if (border.right) {
            const borderStyle = parseBorderStyle(border.right);
            if (borderStyle) {
              ctx.strokeStyle = borderStyle.color;
              ctx.lineWidth = borderStyle.width;
              ctx.beginPath();
              ctx.moveTo(x + actualWidth, y);
              ctx.lineTo(x + actualWidth, y + actualHeight);
              ctx.stroke();
            }
          }
          
          // 下边框
          if (border.bottom) {
            const borderStyle = parseBorderStyle(border.bottom);
            if (borderStyle) {
              ctx.strokeStyle = borderStyle.color;
              ctx.lineWidth = borderStyle.width;
              ctx.beginPath();
              ctx.moveTo(x, y + actualHeight);
              ctx.lineTo(x + actualWidth, y + actualHeight);
              ctx.stroke();
            }
          }
          
          // 左边框
          if (border.left) {
            const borderStyle = parseBorderStyle(border.left);
            if (borderStyle) {
              ctx.strokeStyle = borderStyle.color;
              ctx.lineWidth = borderStyle.width;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + actualHeight);
              ctx.stroke();
            }
          }
          
          ctx.restore();
        }
        
        x += cw;
      }
      y += rh;
    }
    
    // 活动单元格背景高亮
    if (active) {
      ctx.save();
      let cellX = 0;
      for (let c = 0; c < active.col; c++) cellX += (colWidths[c] ?? CELL_W);
      let cellY = 0;
      for (let r = 0; r < active.row; r++) cellY += (rowHeights[r] ?? CELL_H);
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(cellX, cellY, colWidths[active.col] ?? CELL_W, rowHeights[active.row] ?? CELL_H);
      ctx.restore();
    }
    
    // 选择高亮
    if (selection) {
      ctx.save();
      if (selection.type === 'cell' && selection.row !== undefined && selection.col !== undefined) {
        let cellX = 0;
        for (let c = 0; c < selection.col; c++) cellX += (colWidths[c] ?? CELL_W);
        let cellY = 0;
        for (let r = 0; r < selection.row; r++) cellY += (rowHeights[r] ?? CELL_H);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(cellX, cellY, colWidths[selection.col] ?? CELL_W, rowHeights[selection.row] ?? CELL_H);
      } else if (selection.type === 'multi' && selection.selectedCells) {
        // 多选区域高亮
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'; // 紫色
        selection.selectedCells.forEach((cellKey: string) => {
          const [r, c] = cellKey.split(':').map(Number);
          if (r < rows && c < cols) {
            let cellX = 0;
            for (let col = 0; col < c; col++) cellX += (colWidths[col] ?? CELL_W);
            let cellY = 0;
            for (let row = 0; row < r; row++) cellY += (rowHeights[row] ?? CELL_H);
            
            ctx.fillRect(cellX, cellY, colWidths[c] ?? CELL_W, rowHeights[r] ?? CELL_H);
          }
        });
        
        // 绘制选择边框
        ctx.strokeStyle = 'rgb(99, 102, 241)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        selection.selectedCells.forEach((cellKey: string) => {
          const [r, c] = cellKey.split(':').map(Number);
          if (r < rows && c < cols) {
            let cellX = 0;
            for (let col = 0; col < c; col++) cellX += (colWidths[col] ?? CELL_W);
            let cellY = 0;
            for (let row = 0; row < r; row++) cellY += (rowHeights[row] ?? CELL_H);
            
            ctx.strokeRect(cellX, cellY, colWidths[c] ?? CELL_W, rowHeights[r] ?? CELL_H);
          }
        });
      }
      ctx.restore();
    }
    
    // 拖拽选择区域预览
    if (isDragging && dragStart && dragEnd) {
      ctx.save();
      const startRow = Math.min(dragStart.row, dragEnd.row);
      const endRow = Math.max(dragStart.row, dragEnd.row);
      const startCol = Math.min(dragStart.col, dragEnd.col);
      const endCol = Math.max(dragStart.col, dragEnd.col);
      
      // 计算区域坐标
      let startX = 0;
      for (let c = 0; c < startCol; c++) startX += (colWidths[c] ?? CELL_W);
      let startY = 0;
      for (let r = 0; r < startRow; r++) startY += (rowHeights[r] ?? CELL_H);
      
      let endX = startX;
      for (let c = startCol; c <= endCol; c++) endX += (colWidths[c] ?? CELL_W);
      let endY = startY;
      for (let r = startRow; r <= endRow; r++) endY += (rowHeights[r] ?? CELL_H);
      
      // 半透明背景
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'; // 绿色
      ctx.fillRect(startX, startY, endX - startX, endY - startY);
      
      // 虚线边框
      ctx.strokeStyle = 'rgb(34, 197, 94)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      
      ctx.restore();
    }
    
  }, [cells, styles, colWidths, rowHeights, rows, cols, totalWidth, totalHeight, selection, active, isDragging, dragStart, dragEnd, mergedCells]);

  // Global move/up handlers for resizing
  // Throttled broadcast during drag for real-time preview on peers
  let lastEmit = 0;
  const saveLayoutLocally = () => {
    try {
      const key = `grid:layout:${gridId}:${sheetId}`;
      localStorage.setItem(key, JSON.stringify({ rows, cols, rowHeights, colWidths }));
    } catch {}
  };
  const onGlobalMouseMove = (ev: MouseEvent) => {
    if (!resizing) return;
    if (resizing.mode === 'col') {
      const delta = ev.clientX - resizing.startPos;
      const next = Math.max(32, resizing.startSize + delta);
      setColWidth(resizing.index, next);
      const now = Date.now();
      if (now - lastEmit > 100) {
        lastEmit = now;
        try {
          const s = getWS();
          if (s) {
            const state = useGridStore.getState();
            const latestColWidths = state.colWidths;
            console.log('📡 实时广播列宽(拖动中):', { gridId, sheetId, col: resizing.index, width: next, len: latestColWidths?.length });
            s.emit('grid:operation', { id: String(now), gridId, sheetId, type: 'grid:resize', payload: { colWidths: latestColWidths } });
          } else {
            console.warn('⚠️ WebSocket未连接，无法广播列宽(拖动中)');
          }
        } catch {}
      }
    } else {
      const delta = ev.clientY - resizing.startPos;
      const next = Math.max(18, resizing.startSize + delta);
      setRowHeight(resizing.index, next);
      const now = Date.now();
      if (now - lastEmit > 100) {
        lastEmit = now;
        try {
          const s = getWS();
          if (s) {
            const state = useGridStore.getState();
            const latestRowHeights = state.rowHeights;
            console.log('📡 实时广播行高(拖动中):', { gridId, sheetId, row: resizing.index, height: next, len: latestRowHeights?.length });
            s.emit('grid:operation', { id: String(now), gridId, sheetId, type: 'grid:resize', payload: { rowHeights: latestRowHeights } });
          } else {
            console.warn('⚠️ WebSocket未连接，无法广播行高(拖动中)');
          }
        } catch {}
      }
    }
  };
  const onGlobalMouseUp = () => {
    if (!resizing) return;
    try {
      const socket = getWS();
      if (socket) {
        // 广播完整布局，确保他端同步且服务端可持久化
        const state = useGridStore.getState();
        const finalRows = state.rows;
        const finalCols = state.cols;
        const finalRowHeights = state.rowHeights;
        const finalColWidths = state.colWidths;
        const payload = {
          id: crypto.randomUUID?.() || String(Date.now()),
          gridId,
          sheetId,
          type: 'grid:resize',
          payload: { rows: finalRows, cols: finalCols, rowHeights: finalRowHeights, colWidths: finalColWidths }
        };
        console.log('📡 最终提交布局:', { gridId, sheetId, rows: finalRows, cols: finalCols, rowHeightsLen: finalRowHeights.length, colWidthsLen: finalColWidths.length });
        socket.emit('grid:operation', payload);
      }
    } catch {}
    // fallback: local persistence for demo/offline
    saveLayoutLocally();
    setResizing(null);
    window.removeEventListener('mousemove', onGlobalMouseMove);
    window.removeEventListener('mouseup', onGlobalMouseUp);
  };

  
  // 获取鼠标位置对应的行列
  const getRowColFromMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 计算列
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] ?? CELL_W) < x) {
      sumX += (colWidths[col] ?? CELL_W);
      col++;
    }
    
    // 计算行
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] ?? CELL_H) < y) {
      sumY += (rowHeights[row] ?? CELL_H);
      row++;
    }
    
    return { row: Math.min(row, rows - 1), col: Math.min(col, cols - 1) };
  };

  // 鼠标按下 - 开始拖拽选择
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // 只处理左键
    
    const { row, col } = getRowColFromMousePos(e);
    
    // 如果是单击（不是拖拽），设置活动单元格
    setActive(row, col);
    
    // 开始拖拽选择
    setIsDragging(true);
    setDragStart({ row, col });
    setDragEnd({ row, col });
    
    // 清除已有选择
    if (typeof clearSelection === 'function') {
      clearSelection();
    } else {
      console.warn('⚠️ clearSelection函数不存在');
    }
    
  };

  // 鼠标移动 - 更新拖拽选择区域
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart) return;
    
    const { row, col } = getRowColFromMousePos(e);
    setDragEnd({ row, col });
    
    // 计算选择区域
    const startRow = Math.min(dragStart.row, row);
    const endRow = Math.max(dragStart.row, row);
    const startCol = Math.min(dragStart.col, col);
    const endCol = Math.max(dragStart.col, col);
    
    // 更新多选状态
    const selectedCells = new Set<string>();
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        selectedCells.add(`${r}:${c}`);
      }
    }
    
    // 设置多选状态
    useGridStore.setState({
      selection: {
        type: 'multi',
        selectedCells
      }
    });
  };

  // 鼠标释放 - 完成拖拽选择
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (dragStart && dragEnd) {
      const startRow = Math.min(dragStart.row, dragEnd.row);
      const endRow = Math.max(dragStart.row, dragEnd.row);
      const startCol = Math.min(dragStart.col, dragEnd.col);
      const endCol = Math.max(dragStart.col, dragEnd.col);
    }
    
    setDragStart(null);
    setDragEnd(null);
  };

  // 🔀 Luckysheet 风格：查找包含指定位置的合并单元格
  const findMergedCellContaining = (row: number, col: number) => {
    // 检查是否为合并区域的左上角
    const directKey = `${row}_${col}`;
    if (mergedCells[directKey]) {
      return mergedCells[directKey];
    }
    
    // 检查是否在某个合并区域内
    for (const cell of Object.values(mergedCells || {})) {
      const { r, c, rs, cs } = cell;
      if (
        row >= r && row < r + rs &&
        col >= c && col < c + cs
      ) {
        return cell;
      }
    }
    return null;
  };

  // 简化的点击事件 - 主要用于非拖拽的单击
  const handleMainClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 如果刚完成拖拽，不触发点击
    if (isDragging) return;
    
    
    // 使用新的统一方法获取行列
    const { row, col } = getRowColFromMousePos(e);
    
    if (row < rows && col < cols) {
      // 🔀 检查点击位置是否在合并单元格内
      const mergedCell = findMergedCellContaining(row, col);
      
      if (mergedCell) {
        // 点击了合并单元格区域，激活主单元格（左上角）
        setActive(mergedCell.r, mergedCell.c);
      } else {
        // 正常单元格
      setActive(row, col);
      }
    } else {
    }
  };
  
  // 双击编辑
  const handleMainDoubleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    
    // 检查Sheet是否受保护
    const protectedStatus = isSheetProtected();
    if (protectedStatus) {
      toast.warning(getProtectionMessage(), 4000);
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 计算行列
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] ?? CELL_W) < x) {
      sumX += (colWidths[col] ?? CELL_W);
      col++;
    }
    
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] ?? CELL_H) < y) {
      sumY += (rowHeights[row] ?? CELL_H);
      row++;
    }
    
    
    if (row < rows && col < cols) {
      // 🔀 检查双击位置是否在合并单元格内
      const mergedCell = findMergedCellContaining(row, col);
      
      let editRow = row;
      let editCol = col;
      
      if (mergedCell) {
        // 双击了合并单元格区域，编辑主单元格（左上角）
        editRow = mergedCell.r;
        editCol = mergedCell.c;
      }
      
      // 检查单元格是否被锁定（使用实际要编辑的单元格坐标）
      if (isCellLocked(editRow, editCol)) {
        const lockHolder = getCellLockHolder(editRow, editCol);
        if (lockHolder?.displayName || lockHolder?.name) {
          toast.warning(`${lockHolder.displayName || lockHolder.name} 正在编辑此单元格`, 3000);
        } else {
          toast.warning('其他用户正在编辑此单元格', 3000);
        }
        return;
      }

      // 尝试获取锁（使用实际要编辑的单元格坐标）
      const lockAcquired = await acquireCellLock(editRow, editCol);
      if (!lockAcquired) {
        return;
      }

      // 锁获取成功，开始编辑
      // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
      const currentValue = getCellDisplayValue(editRow, editCol) || '';
      setEditing({ row: editRow, col: editCol, value: String(currentValue) });
    }
  };
  
  // 提交编辑
  const handleCommitEdit = () => {
    if (!editing) return;
    
    // 检查Sheet是否受保护
    if (isSheetProtected()) {
      toast.warning(getProtectionMessage(), 4000);
      // 释放锁
      releaseCellLock(editing.row, editing.col);
      setEditing(null);
      return;
    }
    
    // 更新本地状态
    setCell(editing.row, editing.col, editing.value);
    
    // 发送到服务器保存
    const socket = getWS();
    if (socket) {
      socket.emit("grid:operation", {
        id: crypto.randomUUID?.() || String(Date.now()),
        gridId,
        sheetId,
        actorId: null, // 添加actorId字段
        type: "cell:update",
        payload: { row: editing.row, col: editing.col, value: editing.value }
      });
    } else {
      console.warn('⚠️ WebSocket未连接，无法保存到服务器');
    }
    
    // 释放锁
    releaseCellLock(editing.row, editing.col);
    
    setEditing(null);
  };
  
  // 复制选中内容到剪贴板
  const copyToClipboard = async () => {
    let textToCopy = '';
    
    if (selection?.type === 'cell' && selection.row !== undefined && selection.col !== undefined) {
      // 单个单元格
      // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
      textToCopy = String(getCellDisplayValue(selection.row, selection.col) || '');
    } else if (selection?.type === 'multi' && selection.selectedCells) {
      // 多选单元格 - 按行列顺序组织
      const cellArray: string[][] = [];
      const cellKeys = Array.from(selection.selectedCells);
      
      // 找到选择区域的边界
      const positions = cellKeys.map((key: string) => {
        const [r, c] = key.split(':').map(Number);
        return { row: r, col: c };
      });
      
      const minRow = Math.min(...positions.map(p => p.row));
      const maxRow = Math.max(...positions.map(p => p.row));
      const minCol = Math.min(...positions.map(p => p.col));
      const maxCol = Math.max(...positions.map(p => p.col));
      
      // 构建二维数组
      for (let r = minRow; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const cellKey = `${r}:${c}`;
          if (selection.selectedCells.has(cellKey)) {
            // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
            row.push(String(getCellDisplayValue(r, c) || ''));
          } else {
            row.push(''); // 空单元格
          }
        }
        cellArray.push(row);
      }
      
      // 转换为制表符分隔的文本
      textToCopy = cellArray.map(row => row.join('\t')).join('\n');
    } else if (selection?.type === 'row' && selection.row !== undefined) {
      // 整行
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
        row.push(String(getCellDisplayValue(selection.row, c) || ''));
      }
      textToCopy = row.join('\t');
    } else if (selection?.type === 'col' && selection.col !== undefined) {
      // 整列
      const col: string[] = [];
      for (let r = 0; r < rows; r++) {
        // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
        col.push(String(getCellDisplayValue(r, selection.col) || ''));
      }
      textToCopy = col.join('\n');
    }
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        
        // 显示复制反馈
        showNotification('已复制到剪贴板', 'success');
      } catch (error) {
        console.error('复制失败:', error);
        showNotification('复制失败', 'error');
      }
    }
  };

  // 从剪贴板粘贴内容
  const pasteFromClipboard = async () => {
    if (!active) {
      showNotification('请先选择一个单元格', 'warning');
      return;
    }
    
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      
      
      // 解析粘贴内容
      const lines = text.split('\n');
      const startRow = active.row;
      const startCol = active.col;
      
      // 逐行粘贴
      lines.forEach((line, rowOffset) => {
        const targetRow = startRow + rowOffset;
        if (targetRow >= rows) return; // 超出行范围
        
        if (line.includes('\t')) {
          // 多列数据（制表符分隔）
          const values = line.split('\t');
          values.forEach((value, colOffset) => {
            const targetCol = startCol + colOffset;
            if (targetCol < cols) { // 不超出列范围
              setCell(targetRow, targetCol, value.trim());
            }
          });
        } else {
          // 单列数据
          setCell(targetRow, startCol, line.trim());
        }
      });
      
      showNotification(`已粘贴 ${lines.length} 行数据`, 'success');
    } catch (error) {
      console.error('粘贴失败:', error);
      showNotification('粘贴失败', 'error');
    }
  };

  // 简单的通知函数
  const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    // 创建临时通知元素
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded shadow-lg text-white z-[10000] transition-opacity duration-300 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-yellow-500'
    }`;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommitEdit();
      } else if (e.key === 'Escape') {
        // 释放锁并取消编辑
        releaseCellLock(editing.row, editing.col);
        setEditing(null);
      }
    } else if (active) {
      // 非编辑模式下的键盘导航
      let newRow = active.row;
      let newCol = active.col;
      
      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, active.row - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(rows - 1, active.row + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, active.col - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(cols - 1, active.col + 1);
          break;
        case 'Enter':
        case 'F2':
          // 检查单元格是否被锁定
          if (isCellLocked(active.row, active.col)) {
            const lockHolder = getCellLockHolder(active.row, active.col);
            if (lockHolder?.displayName || lockHolder?.name) {
              toast.warning(`${lockHolder.displayName || lockHolder.name} 正在编辑此单元格`, 3000);
            } else {
              toast.warning('其他用户正在编辑此单元格', 3000);
            }
            return;
          }

          // 异步获取锁并开始编辑
          (async () => {
            const lockAcquired = await acquireCellLock(active.row, active.col);
            if (lockAcquired) {
              // 🔀 使用 getCellDisplayValue 确保获取正确的值（考虑合并单元格）
              const currentValue = getCellDisplayValue(active.row, active.col) || '';
          setEditing({ row: active.row, col: active.col, value: String(currentValue) });
            }
          })();
          return;
        default:
          // 处理复制粘贴快捷键
          if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            copyToClipboard();
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            pasteFromClipboard();
            return;
          }
          
          // 处理撤销重做快捷键
          if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            // 手动撤销逻辑
            if (historyIndex >= 0 && history[historyIndex]) {
              const entry = history[historyIndex];
              const store = useGridStore.getState();
              const currentCells = store.cells || {};
              
              entry.changes.forEach((change: any) => {
                const key = `${change.row}:${change.col}`;
                if (change.oldValue !== undefined) {
                  currentCells[key] = change.oldValue;
                } else {
                  delete currentCells[key];
                }
              });
              
              useGridStore.setState({
                cells: { ...currentCells },
                historyIndex: historyIndex - 1
              });
              
              showNotification('已撤销', 'success');
            } else {
              showNotification('无法撤销', 'warning');
            }
            return;
          }
          if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            // 手动重做逻辑
            if (historyIndex < history.length - 1) {
              const targetIndex = historyIndex + 1;
              const entry = history[targetIndex];
              const store = useGridStore.getState();
              const currentCells = store.cells || {};
              
              entry.changes.forEach((change: any) => {
                const key = `${change.row}:${change.col}`;
                if (change.newValue !== undefined) {
                  currentCells[key] = change.newValue;
                } else {
                  delete currentCells[key];
                }
              });
              
              useGridStore.setState({
                cells: { ...currentCells },
                historyIndex: targetIndex
              });
              
              showNotification('已重做', 'success');
            } else {
              showNotification('无法重做', 'warning');
            }
            return;
          }
          
          // 直接输入字符开始编辑
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // 检查单元格是否被锁定
            if (isCellLocked(active.row, active.col)) {
              const lockHolder = getCellLockHolder(active.row, active.col);
              if (lockHolder?.displayName || lockHolder?.name) {
                toast.warning(`${lockHolder.displayName || lockHolder.name} 正在编辑此单元格`, 3000);
              } else {
                toast.warning('其他用户正在编辑此单元格', 3000);
              }
              return;
            }

            // 异步获取锁
            (async () => {
              const lockAcquired = await acquireCellLock(active.row, active.col);
              if (lockAcquired) {
            setEditing({ row: active.row, col: active.col, value: e.key });
              }
            })();
            return;
          }
      }
      
      if (newRow !== active.row || newCol !== active.col) {
        setActive(newRow, newCol);
        
        // 自动滚动到可视区域
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          let targetX = 0;
          for (let c = 0; c < newCol; c++) targetX += (colWidths[c] ?? CELL_W);
          let targetY = 0;
          for (let r = 0; r < newRow; r++) targetY += (rowHeights[r] ?? CELL_H);
          
          const containerRect = scrollContainer.getBoundingClientRect();
          const cellW = colWidths[newCol] ?? CELL_W;
          const cellH = rowHeights[newRow] ?? CELL_H;
          
          // 水平滚动
          if (targetX < scrollContainer.scrollLeft) {
            scrollContainer.scrollLeft = targetX;
          } else if (targetX + cellW > scrollContainer.scrollLeft + containerRect.width) {
            scrollContainer.scrollLeft = targetX + cellW - containerRect.width;
          }
          
          // 垂直滚动
          if (targetY < scrollContainer.scrollTop) {
            scrollContainer.scrollTop = targetY;
          } else if (targetY + cellH > scrollContainer.scrollTop + containerRect.height) {
            scrollContainer.scrollTop = targetY + cellH - containerRect.height;
          }
        }
      }
    }
  };
  
  // 右键菜单事件
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 计算行列
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] ?? CELL_W) < x) {
      sumX += (colWidths[col] ?? CELL_W);
      col++;
    }
    
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] ?? CELL_H) < y) {
      sumY += (rowHeights[row] ?? CELL_H);
      row++;
    }
    
    if (row < rows && col < cols) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        row,
        col
      });
    }
  };
  
  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // 全局鼠标事件监听 - 处理拖拽时鼠标离开Canvas的情况
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 模拟Canvas事件
      const mockEvent = {
        currentTarget: canvas,
        clientX: e.clientX,
        clientY: e.clientY
      } as React.MouseEvent<HTMLCanvasElement>;

      const { row, col } = getRowColFromMousePos(mockEvent);
      setDragEnd({ row, col });

      // 更新选择状态
      if (dragStart) {
        const startRow = Math.min(dragStart.row, row);
        const endRow = Math.max(dragStart.row, row);
        const startCol = Math.min(dragStart.col, col);
        const endCol = Math.max(dragStart.col, col);

        const selectedCells = new Set<string>();
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            selectedCells.add(`${r}:${c}`);
          }
        }

        useGridStore.setState({
          selection: {
            type: 'multi',
            selectedCells
          }
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, rows, cols]);
  
  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden">
      {/* 滚动容器 */}
      <div 
        ref={scrollContainerRef}
        className="absolute overflow-auto bg-gray-50"
        style={{
          top: HEADER_H,
          left: HEADER_W,
          right: 0,
          bottom: 0,
        }}
        onScroll={(e) => {
        }}
      >
        {/* 滚动区域占位 - 确保有足够内容可滚动 */}
        <div 
          style={{ 
            width: Math.max(totalWidth, 2000), // 确保足够宽
            height: Math.max(totalHeight, 1500), // 确保足够高
            position: 'relative',
            background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* 主内容Canvas */}
          <canvas 
            ref={mainCanvasRef}
            onClick={handleMainClick}
            onDoubleClick={handleMainDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            className="absolute top-0 left-0 bg-white"
            style={{ cursor: isDragging ? 'crosshair' : 'cell' }}
            tabIndex={0}
          />
        </div>
      </div>
      
      {/* 固定列头 */}
      <canvas 
        ref={colHeaderCanvasRef}
        className="absolute bg-gray-50 border-b border-gray-300 cursor-pointer z-40"
        style={{
          top: 0,
          left: HEADER_W,
          right: 0,
          height: HEADER_H,
        }}
        onMouseMove={(e) => {
          if (resizing?.mode === 'col') return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left + scroll.left;
          const edge = findColEdgeNear(x);
          e.currentTarget.style.cursor = edge != null ? 'col-resize' : 'default';
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left + scroll.left;
          const edge = findColEdgeNear(x);
          if (edge == null) return;
          setResizing({ mode: 'col', index: edge, startPos: e.clientX, startSize: colWidths[edge] ?? CELL_W });
          window.addEventListener('mousemove', onGlobalMouseMove);
          window.addEventListener('mouseup', onGlobalMouseUp);
          e.preventDefault();
        }}
      />
      
      {/* 固定行头 */}
      <canvas 
        ref={rowHeaderCanvasRef}
        className="absolute bg-gray-50 border-r border-gray-300 cursor-pointer z-40"
        style={{
          top: HEADER_H,
          left: 0,
          bottom: 0,
          width: HEADER_W,
        }}
        onMouseMove={(e) => {
          if (resizing?.mode === 'row') return;
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top + scroll.top;
          const edge = findRowEdgeNear(y);
          e.currentTarget.style.cursor = edge != null ? 'row-resize' : 'default';
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top + scroll.top;
          const edge = findRowEdgeNear(y);
          if (edge == null) return;
          setResizing({ mode: 'row', index: edge, startPos: e.clientY, startSize: rowHeights[edge] ?? CELL_H });
          window.addEventListener('mousemove', onGlobalMouseMove);
          window.addEventListener('mouseup', onGlobalMouseUp);
          e.preventDefault();
        }}
      />
      
      {/* 左上角 */}
      <div 
        className="absolute bg-gray-100 border-r border-b border-gray-300 cursor-pointer hover:bg-gray-200 z-50 flex items-center justify-center"
        style={{
          top: 0,
          left: 0,
          width: HEADER_W,
          height: HEADER_H,
        }}
      >
        <div className="text-xs text-gray-600">⚏</div>
      </div>
      
      {/* 锁定单元格指示器 */}
      {Object.entries(lockByCell).map(([cellKey, lockHolder]) => {
        if (!lockHolder) return null;
        
        const [sheetIdStr, rowStr, colStr] = cellKey.split(':');
        const lockSheetId = parseInt(sheetIdStr);
        const lockRow = parseInt(rowStr);
        const lockCol = parseInt(colStr);
        
        // 只显示当前Sheet的锁
        if (lockSheetId !== sheetId) return null;
        
        // 如果是当前用户在编辑，则不显示锁定指示器（已经有编辑框了）
        const currentUserId = user?.id ? String(user.id) : null;
        if (lockHolder.userId === currentUserId) return null;
        
        // 计算位置
        let x = 0;
        for (let c = 0; c < lockCol; c++) x += (colWidths[c] ?? CELL_W);
        let y = 0;
        for (let r = 0; r < lockRow; r++) y += (rowHeights[r] ?? CELL_H);
        
        return (
          <div
            key={cellKey}
            className="absolute pointer-events-none z-40"
            style={{
              left: HEADER_W + x - scroll.left,
              top: HEADER_H + y - scroll.top,
              width: colWidths[lockCol] ?? CELL_W,
              height: rowHeights[lockRow] ?? CELL_H,
            }}
          >
            {/* 锁定边框 */}
            <div 
              className="absolute inset-0 border-2 border-orange-500 bg-orange-100 bg-opacity-20"
              style={{
                borderColor: lockHolder.color || '#f97316'
              }}
            />
            
            {/* 用户标签 */}
            <div 
              className="absolute -top-5 left-0 px-1 py-0.5 text-xs rounded text-white shadow-sm whitespace-nowrap"
              style={{
                backgroundColor: lockHolder.color || '#f97316',
                fontSize: '10px'
              }}
            >
              👤 {lockHolder.displayName || lockHolder.name || '正在编辑...'}
            </div>
          </div>
        );
      })}
      
      {/* 编辑框 */}
      {editing && (
        <input
          autoFocus
          type="text"
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={handleCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommitEdit();
            } else if (e.key === 'Escape') {
              // 释放锁并取消编辑
              releaseCellLock(editing.row, editing.col);
              setEditing(null);
            }
          }}
          className="absolute border-2 border-blue-500 bg-white px-2 py-1 text-sm z-50"
          style={{
            left: HEADER_W + (() => {
              let x = 0;
              for (let c = 0; c < editing.col; c++) x += (colWidths[c] ?? CELL_W);
              return x - scroll.left;
            })(),
            top: HEADER_H + (() => {
              let y = 0;
              for (let r = 0; r < editing.row; r++) y += (rowHeights[r] ?? CELL_H);
              return y - scroll.top;
            })(),
            // 🔀 对于合并单元格，编辑框应该跨越整个合并区域
            width: (() => {
              // 检查当前编辑位置是否是合并单元格的主单元格
              const mergedCell = findMergedCellContaining(editing.row, editing.col);
              if (mergedCell) {
                // 计算合并区域的总宽度
                let totalWidth = 0;
                const startCol = mergedCell.startCol || mergedCell.c || editing.col;
                const endCol = mergedCell.endCol || (mergedCell.c + mergedCell.cs - 1) || editing.col;
                for (let c = startCol; c <= endCol; c++) {
                  totalWidth += colWidths[c] ?? CELL_W;
                }
                return totalWidth - 4;
              }
              return (colWidths[editing.col] ?? CELL_W) - 4;
            })(),
            height: (rowHeights[editing.row] ?? CELL_H) - 4,
          }}
        />
      )}
      
      {/* 活动单元格高亮边框 - 支持合并单元格 */}
      {active && !editing && (
        (() => {
          // 🔀 检查活动单元格是否在合并区域内
          const mergedCell = findMergedCellContaining(active.row, active.col);
          
          let displayRow = active.row;
          let displayCol = active.col;
          let displayWidth = colWidths[active.col] ?? CELL_W;
          let displayHeight = rowHeights[active.row] ?? CELL_H;
          
          if (mergedCell) {
            // 如果是合并单元格，高亮整个合并区域
            const startRow = mergedCell.startRow || mergedCell.r || active.row;
            const startCol = mergedCell.startCol || mergedCell.c || active.col;
            const endRow = mergedCell.endRow || (mergedCell.r + mergedCell.rs - 1) || active.row;
            const endCol = mergedCell.endCol || (mergedCell.c + mergedCell.cs - 1) || active.col;
            
            displayRow = startRow;
            displayCol = startCol;
            
            // 计算合并区域的总尺寸
            displayWidth = 0;
            for (let c = startCol; c <= endCol; c++) {
              displayWidth += colWidths[c] ?? CELL_W;
            }
            displayHeight = 0;
            for (let r = startRow; r <= endRow; r++) {
              displayHeight += rowHeights[r] ?? CELL_H;
            }
          }
          
          return (
        <div
          className="absolute border-2 border-blue-500 pointer-events-none z-40"
          style={{
            left: HEADER_W + (() => {
              let x = 0;
                  for (let c = 0; c < displayCol; c++) x += (colWidths[c] ?? CELL_W);
              return x - scroll.left;
            })(),
            top: HEADER_H + (() => {
              let y = 0;
                  for (let r = 0; r < displayRow; r++) y += (rowHeights[r] ?? CELL_H);
              return y - scroll.top;
            })(),
                width: displayWidth,
                height: displayHeight,
              }}
            />
          );
        })()
      )}


      {/* 合并测试按钮已移除 */}

      {/* 多人关注同一单元格的悬浮提示（presence） */}
      {(() => {
        const target = editing ?? active;
        if (!target) return null;
        const key = `${sheetId}:${target.row}:${target.col}`;
        const users: any[] = (presenceByCell as any)[key] || [];
        // 过滤当前用户，仅显示其他人
        const others = users.filter((u) => u?.userId && u.userId !== user?.id);
        if (others.length === 0) return null;

        // 计算该单元格的位置用于定位提示
        let x = HEADER_W;
        for (let c = 0; c < target.col; c++) x += (colWidths[c] ?? CELL_W);
        let y = HEADER_H;
        for (let r = 0; r < target.row; r++) y += (rowHeights[r] ?? CELL_H);
        x = x - scroll.left;
        y = y - scroll.top;

        const label = others.length === 1 ? `${others[0].displayName || '协作者'} 也在此` : `${others.length} 人也在此`;

        return (
          <div
            className="absolute text-xs px-2 py-1 rounded bg-gray-900/90 text-white shadow"
            style={{ left: x + (colWidths[target.col] ?? CELL_W) - 4, top: y - 20, transform: 'translateX(-100%)' }}
          >
            {label}
          </div>
        );
      })()}

      {contextMenu && (
        <GridContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          row={contextMenu.row}
          col={contextMenu.col}
          onClose={() => setContextMenu(null)}
          gridId={gridId}
          sheetId={sheetId}
          userPermission={userPermission}
        />
      )}

    </div>
  );
}
