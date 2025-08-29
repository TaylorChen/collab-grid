import React, { useEffect, useRef, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";
import GridContextMenu from "@/components/ContextMenu/GridContextMenu";

const CELL_W = 80;
const CELL_H = 24;
const HEADER_W = 48;
const HEADER_H = 24;

/**
 * 改进的表格组件 - 修复滚动同步问题
 * 参考Luckysheet的实现方式
 */
export default function ImprovedGrid({ gridId = "demo", sheetId = 0 }: { gridId?: string; sheetId?: number }) {
  console.log('🚀 ImprovedGrid rendering!', { gridId, sheetId });
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const colHeaderCanvasRef = useRef<HTMLCanvasElement>(null);
  const rowHeaderCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store state
  const { 
    rows, cols, cells, styles, rowHeights, colWidths, active, selection,
    freezeRows, freezeCols, setCell, setActive, clearSelection,
    undo, redo, canUndo, canRedo, history, historyIndex
  } = useGridStore((s: any) => ({
    rows: s.rows, cols: s.cols, cells: s.cells || {}, styles: s.styles || {},
    rowHeights: s.rowHeights || [], colWidths: s.colWidths || [], 
    active: s.active, selection: s.selection,
    freezeRows: s.freezeRows ?? 0, freezeCols: s.freezeCols ?? 0,
    setCell: s.setCell, setActive: s.setActive, 
    clearSelection: s.clearSelection || (() => {}), // 添加默认函数防止错误
    undo: s.undo, redo: s.redo, canUndo: s.canUndo, canRedo: s.canRedo,
    history: s.history || [], historyIndex: s.historyIndex ?? -1
  }));
  
  console.log('📊 Store状态:', { 
    rows, cols, 
    colWidths: colWidths?.length, 
    rowHeights: rowHeights?.length,
    activeSheetId: useGridStore.getState().activeSheetId
  });
  
  // Local state
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null);
  
  // 滚动事件处理
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      console.log('❌ 滚动容器未找到');
      return;
    }
    
    console.log('📍 设置滚动监听器');
    
    const handleScroll = () => {
      const newScroll = {
        left: scrollContainer.scrollLeft,
        top: scrollContainer.scrollTop
      };
      setScroll(newScroll);
      console.log('📍 滚动事件:', newScroll);
    };
    
    // 测试滚动容器状态
    console.log('📍 滚动容器状态:', {
      scrollWidth: scrollContainer.scrollWidth,
      scrollHeight: scrollContainer.scrollHeight,
      clientWidth: scrollContainer.clientWidth,
      clientHeight: scrollContainer.clientHeight,
      overflow: window.getComputedStyle(scrollContainer).overflow
    });
    
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
      console.log('🎯 自动选择第一个单元格 A1');
    }
    
    container.addEventListener('click', handleContainerClick);
    return () => container.removeEventListener('click', handleContainerClick);
  }, [active, setActive]);
  
  // 计算总尺寸
  console.log('🔢 计算总尺寸前:', { 
    cols, rows, 
    colWidths: colWidths?.length, 
    rowHeights: rowHeights?.length,
    firstFewColWidths: colWidths?.slice(0, 5),
    firstFewRowHeights: rowHeights?.slice(0, 5)
  });
  
  const totalWidth = colWidths.slice(0, cols).reduce((sum: number, w: number | undefined) => sum + (w ?? CELL_W), 0);
  const totalHeight = rowHeights.slice(0, rows).reduce((sum: number, h: number | undefined) => sum + (h ?? CELL_H), 0);
  
  console.log('🔢 计算总尺寸后:', { totalWidth, totalHeight });
  
  // 🚨 紧急修复：如果colWidths为空且cols>0，强制初始化
  useEffect(() => {
    if (cols > 0 && colWidths.length === 0) {
      console.log('🚨 检测到colWidths为空，强制初始化:', { cols, colWidths: colWidths.length, sheetId });
      useGridStore.getState().setActiveSheet(sheetId);
      console.log('🚨 强制调用setActiveSheet完成');
    }
  }, [cols, colWidths.length, sheetId]);
  
  // 🚨 紧急修复：如果rowHeights为空且rows>0，强制初始化  
  useEffect(() => {
    if (rows > 0 && rowHeights.length === 0) {
      console.log('🚨 检测到rowHeights为空，强制初始化:', { rows, rowHeights: rowHeights.length, sheetId });
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
      console.log('❌ 主Canvas未找到');
      return;
    }
    
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    
    console.log('🎨 渲染主Canvas:', { totalWidth, totalHeight });
    
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
    
    let y = 0;
    for (let r = 0; r < rows; r++) {
      const rh = rowHeights[r] ?? CELL_H;
      let x = 0;
      
      for (let c = 0; c < cols; c++) {
        const cw = colWidths[c] ?? CELL_W;
        
        // 网格线
        ctx.beginPath();
        ctx.rect(x + 0.5, y + 0.5, cw - 1, rh - 1);
        ctx.stroke();
        
        // 内容和样式
        const cellKey = `${r}:${c}`;
        const value = cells[cellKey];
        const style = styles[cellKey];
        
        // 应用背景色
        if (style?.bg) {
          ctx.fillStyle = style.bg;
          ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
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
          
          // 计算文字位置
          let textX = x + 4;
          if (style?.align === 'center') {
            const textWidth = ctx.measureText(text).width;
            textX = x + cw / 2 - textWidth / 2;
          } else if (style?.align === 'right') {
            const textWidth = ctx.measureText(text).width;
            textX = x + cw - 4 - textWidth;
          }
          
          ctx.fillText(text, textX, y + rh / 2);
          
          // 绘制下划线
          if (style?.underline) {
            const textWidth = ctx.measureText(text).width;
            ctx.beginPath();
            ctx.moveTo(textX, y + rh / 2 + 2);
            ctx.lineTo(textX + textWidth, y + rh / 2 + 2);
            ctx.strokeStyle = style?.color || '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
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
    
  }, [cells, styles, colWidths, rowHeights, rows, cols, totalWidth, totalHeight, selection, active, isDragging, dragStart, dragEnd]);
  
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
    console.log('🔍 clearSelection类型:', typeof clearSelection);
    if (typeof clearSelection === 'function') {
      clearSelection();
      console.log('✅ clearSelection调用成功');
    } else {
      console.warn('⚠️ clearSelection函数不存在');
    }
    
    console.log('🖱️ 开始拖拽选择:', { row, col });
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
      
      console.log('✅ 完成拖拽选择:', {
        从: `${String.fromCharCode(65 + startCol)}${startRow + 1}`,
        到: `${String.fromCharCode(65 + endCol)}${endRow + 1}`,
        区域: `${endRow - startRow + 1}行 × ${endCol - startCol + 1}列`
      });
    }
    
    setDragStart(null);
    setDragEnd(null);
  };

  // 简化的点击事件 - 主要用于非拖拽的单击
  const handleMainClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 如果刚完成拖拽，不触发点击
    if (isDragging) return;
    
    console.log('🖱️ 单击事件 (非拖拽)');
    
    // 使用新的统一方法获取行列
    const { row, col } = getRowColFromMousePos(e);
    
    if (row < rows && col < cols) {
      setActive(row, col);
      console.log('✅ 设置活动单元格:', { row, col });
    } else {
      console.log('❌ 坐标超出范围');
    }
  };
  
  // 双击编辑
  const handleMainDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🖱️ Canvas双击事件触发');
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
    
    console.log('🖱️ 双击计算得到单元格:', { row, col });
    
    if (row < rows && col < cols) {
      const cellKey = `${row}:${col}`;
      const currentValue = cells[cellKey] || '';
      setEditing({ row, col, value: String(currentValue) });
      console.log('✏️ 开始编辑:', { row, col, value: currentValue });
    }
  };
  
  // 提交编辑
  const handleCommitEdit = () => {
    if (!editing) return;
    setCell(editing.row, editing.col, editing.value);
    setEditing(null);
    console.log('💾 提交编辑:', editing);
  };
  
  // 复制选中内容到剪贴板
  const copyToClipboard = async () => {
    let textToCopy = '';
    
    if (selection?.type === 'cell' && selection.row !== undefined && selection.col !== undefined) {
      // 单个单元格
      const cellKey = `${selection.row}:${selection.col}`;
      textToCopy = String(cells[cellKey] || '');
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
            row.push(String(cells[cellKey] || ''));
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
        const cellKey = `${selection.row}:${c}`;
        row.push(String(cells[cellKey] || ''));
      }
      textToCopy = row.join('\t');
    } else if (selection?.type === 'col' && selection.col !== undefined) {
      // 整列
      const col: string[] = [];
      for (let r = 0; r < rows; r++) {
        const cellKey = `${r}:${selection.col}`;
        col.push(String(cells[cellKey] || ''));
      }
      textToCopy = col.join('\n');
    }
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        console.log('📋 复制成功:', textToCopy.length > 50 ? textToCopy.substring(0, 50) + '...' : textToCopy);
        
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
      
      console.log('📌 粘贴内容:', text.length > 50 ? text.substring(0, 50) + '...' : text);
      
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
          const cellKey = `${active.row}:${active.col}`;
          const currentValue = cells[cellKey] || '';
          setEditing({ row: active.row, col: active.col, value: String(currentValue) });
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
            setEditing({ row: active.row, col: active.col, value: e.key });
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
      console.log('🖱️ 右键菜单:', { row, col, x: e.clientX, y: e.clientY });
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
      console.log('🔗 全局鼠标释放 - 拖拽结束');
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
          console.log('📍 内联滚动事件:', e.currentTarget.scrollLeft, e.currentTarget.scrollTop);
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
            width: (colWidths[editing.col] ?? CELL_W) - 4,
            height: (rowHeights[editing.row] ?? CELL_H) - 4,
          }}
        />
      )}
      
      {/* 活动单元格高亮边框 */}
      {active && !editing && (
        <div
          className="absolute border-2 border-blue-500 pointer-events-none z-40"
          style={{
            left: HEADER_W + (() => {
              let x = 0;
              for (let c = 0; c < active.col; c++) x += (colWidths[c] ?? CELL_W);
              return x - scroll.left;
            })(),
            top: HEADER_H + (() => {
              let y = 0;
              for (let r = 0; r < active.row; r++) y += (rowHeights[r] ?? CELL_H);
              return y - scroll.top;
            })(),
            width: (colWidths[active.col] ?? CELL_W),
            height: (rowHeights[active.row] ?? CELL_H),
          }}
        />
      )}

      {/* 调试信息和测试控制 */}
      <div className="absolute top-2 right-2 bg-blue-100 p-3 rounded text-xs z-50 space-y-2">
        <div className="font-bold">📊 ImprovedGrid调试</div>
        <div>滚动: {scroll.left}, {scroll.top}</div>
        <div>容器: {containerSize.width}×{containerSize.height}</div>
        <div>总尺寸: {totalWidth}×{totalHeight} (cols:{cols}, colWidths:{colWidths.length})</div>
        <div className="text-xs">Sheet:{sheetId}, activeSheetId:{useGridStore.getState().activeSheetId}</div>
        <div>冻结: {freezeRows}行 {freezeCols}列</div>
        {active && <div>活动: {active.row}:{active.col}</div>}
        {editing && <div>✏️ 编辑: {editing.row}:{editing.col}</div>}
        <div>历史: {historyIndex + 1}/{history.length} (可撤销: {historyIndex >= 0 ? '是' : '否'}, 可重做: {historyIndex < history.length - 1 ? '是' : '否'})</div>
        <div className="text-xs text-gray-500">
          historyIndex: {historyIndex}, history.length: {history.length}
        </div>
        {history.length > 0 && (
          <div className="text-green-600">
            最近: {history[historyIndex]?.description || '无'}
          </div>
        )}
        
        <div className="space-y-1 pt-2 border-t">
          <button 
            onClick={() => {
              console.log('🧪 手动触发滚动测试');
              const container = scrollContainerRef.current;
              if (container) {
                container.scrollTo(100, 100);
                console.log('🧪 滚动到 100,100');
              }
            }}
            className="w-full px-2 py-1 bg-green-500 text-white rounded text-xs"
          >
            测试滚动
          </button>
          
          <button 
            onClick={() => {
              console.log('🧪 手动设置活动单元格');
              setActive(2, 3);
            }}
            className="w-full px-2 py-1 bg-purple-500 text-white rounded text-xs"
          >
            测试选择C3
          </button>
          
          <button 
            onClick={() => {
              console.log('🧪 手动开始编辑');
              setEditing({ row: 1, col: 1, value: 'TEST' });
            }}
            className="w-full px-2 py-1 bg-orange-500 text-white rounded text-xs"
          >
            测试编辑B2
          </button>
          
          <button 
            onClick={() => {
              console.log('🧪 手动修改数据测试历史');
              console.log('🧪 setCell函数类型:', typeof setCell);
              console.log('🧪 当前cells状态:', cells);
              console.log('🧪 当前history状态:', history);
              console.log('🧪 当前historyIndex:', historyIndex);
              const randomValue = Math.random().toString(36).substring(7);
              const newValue = `测试${randomValue}`;
              console.log('🧪 准备设置值:', newValue);
              
              // 手动实现带历史记录的setCell
              console.log('🧪 手动实现带历史记录的setCell:');
              const store = useGridStore.getState();
              const key = `0:0`;
              const oldValue = (store.cells || {})[key];
              console.log('🧪 oldValue:', oldValue, 'newValue:', newValue);
              
              if (oldValue !== newValue) {
                // 创建历史记录
                const historyEntry = {
                  type: 'cell_change' as const,
                  timestamp: Date.now(),
                  changes: [{
                    row: 0,
                    col: 0,
                    oldValue,
                    newValue
                  }],
                  description: `手动编辑单元格 A1`
                };
                
                // 更新状态
                const currentHistory = store.history || [];
                const currentIndex = store.historyIndex ?? -1;
                const newHistory = currentHistory.slice(0, currentIndex + 1);
                newHistory.push(historyEntry);
                
                console.log('🧪 历史记录信息:', {
                  currentHistory: currentHistory.length,
                  currentIndex,
                  newHistoryLength: newHistory.length
                });
                
                useGridStore.setState({
                  cells: { ...(store.cells || {}), [key]: newValue },
                  history: newHistory,
                  historyIndex: newHistory.length - 1
                });
                
                console.log('🧪 手动创建历史记录成功');
              } else {
                console.log('🧪 值未变化，不创建历史记录');
              }
              
              // 延迟检查状态
              setTimeout(() => {
                const state = useGridStore.getState();
                console.log('🧪 延迟检查状态:', {
                  historyLength: state.history?.length || 0,
                  historyIndex: state.historyIndex || -1,
                  cellValue: state.cells?.['0:0'] || 'undefined',
                  stateKeys: Object.keys(state)
                });
              }, 100);
            }}
            className="w-full px-2 py-1 bg-teal-500 text-white rounded text-xs"
          >
            修改A1测试历史
          </button>
          
          <button 
            onClick={() => {
              console.log('🧪 直接添加历史记录测试');
              const randomValue = Math.random().toString(36).substring(7);
              const historyEntry = {
                type: 'cell_change' as const,
                timestamp: Date.now(),
                changes: [{
                  row: 0,
                  col: 0,
                  oldValue: cells['0:0'],
                  newValue: `直接${randomValue}`
                }],
                description: `直接添加历史测试`
              };
              // 直接调用store的addToHistory方法
              const store = useGridStore.getState();
              if (typeof store.addToHistory === 'function') {
                store.addToHistory(historyEntry);
                console.log('🧪 直接添加历史记录成功');
              } else {
                console.log('❌ addToHistory方法不存在');
              }
            }}
            className="w-full px-2 py-1 bg-pink-500 text-white rounded text-xs"
          >
            直接添加历史测试
          </button>
          
          <button 
            onClick={() => {
              console.log('🧪 强制检查canUndo状态');
              const store = useGridStore.getState();
              // 手动检查canUndo逻辑
              const historyLength = (store.history || []).length;
              const historyIndex = store.historyIndex ?? -1;
              const manualCanUndo = historyIndex >= 0;
              const manualCanRedo = historyIndex < historyLength - 1;
              
              console.log('🧪 当前store状态:', {
                historyLength,
                historyIndex,
                canUndoResult: store.canUndo ? store.canUndo() : 'function not found',
                manualCanUndo,
                manualCanRedo
              });
              // 强制重新渲染
              useGridStore.setState({});
            }}
            className="w-full px-2 py-1 bg-cyan-500 text-white rounded text-xs"
          >
            检查canUndo状态
          </button>
          
          <div className="flex space-x-1">
            <button 
              onClick={() => {
                console.log('🔍 撤销按钮被点击');
                console.log('🔍 当前历史状态:', { history: history.length, historyIndex });
                
                if (historyIndex >= 0 && history[historyIndex]) {
                  const entry = history[historyIndex];
                  console.log('⏪ 执行撤销:', entry.description);
                  
                  // 手动实现撤销逻辑
                  const store = useGridStore.getState();
                  const currentCells = store.cells || {};
                  
                  // 应用撤销
                  entry.changes.forEach((change: any) => {
                    const key = `${change.row}:${change.col}`;
                    if (change.oldValue !== undefined) {
                      currentCells[key] = change.oldValue;
                    } else {
                      delete currentCells[key];
                    }
                  });
                  
                  // 更新状态
                  useGridStore.setState({
                    cells: { ...currentCells },
                    historyIndex: historyIndex - 1
                  });
                  
                  console.log('✅ 手动撤销完成');
                  showNotification('已撤销', 'success');
                } else {
                  console.log('❌ 无法撤销');
                  showNotification('无法撤销', 'warning');
                }
              }}
              disabled={!(historyIndex >= 0)}
              className={`flex-1 px-2 py-1 rounded text-xs ${
                (historyIndex >= 0) 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ⏪ 撤销
            </button>
            <button 
              onClick={() => {
                console.log('🔍 重做按钮被点击');
                console.log('🔍 当前历史状态:', { history: history.length, historyIndex });
                
                if (historyIndex < history.length - 1) {
                  const targetIndex = historyIndex + 1;
                  const entry = history[targetIndex];
                  console.log('⏩ 执行重做:', entry.description);
                  
                  // 手动实现重做逻辑
                  const store = useGridStore.getState();
                  const currentCells = store.cells || {};
                  
                  // 应用重做
                  entry.changes.forEach((change: any) => {
                    const key = `${change.row}:${change.col}`;
                    if (change.newValue !== undefined) {
                      currentCells[key] = change.newValue;
                    } else {
                      delete currentCells[key];
                    }
                  });
                  
                  // 更新状态
                  useGridStore.setState({
                    cells: { ...currentCells },
                    historyIndex: targetIndex
                  });
                  
                  console.log('✅ 手动重做完成');
                  showNotification('已重做', 'success');
                } else {
                  console.log('❌ 无法重做');
                  showNotification('无法重做', 'warning');
                }
              }}
              disabled={!(historyIndex < history.length - 1)}
              className={`flex-1 px-2 py-1 rounded text-xs ${
                (historyIndex < history.length - 1) 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ⏩ 重做
            </button>
          </div>
        </div>
      </div>
      
      {/* 右键上下文菜单 */}
      {contextMenu && (
        <GridContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          row={contextMenu.row}
          col={contextMenu.col}
          onClose={() => setContextMenu(null)}
          gridId={gridId}
          sheetId={sheetId}
        />
      )}
    </div>
  );
}

