import React, { useEffect, useRef, useState } from "react";

// 安全的简化版CanvasGrid，用于调试
export default function CanvasGridSafe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 设置canvas尺寸
      canvas.width = 800;
      canvas.height = 600;

      // 清空canvas
      ctx.clearRect(0, 0, 800, 600);

      // 绘制简单的网格
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;

      // 绘制垂直线
      for (let x = 0; x <= 800; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, 600);
        ctx.stroke();
      }

      // 绘制水平线
      for (let y = 0; y <= 600; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(800, y + 0.5);
        ctx.stroke();
      }

      // 添加一些示例文本
      ctx.fillStyle = "#111827";
      ctx.font = "12px system-ui";
      ctx.fillText("Safe Canvas Grid", 10, 20);
      ctx.fillText("这是一个安全的测试版本", 10, 40);

    } catch (err) {
      console.error("Canvas rendering error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <h3 className="text-red-800 font-bold">Canvas渲染错误:</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        className="border border-gray-300"
        style={{ 
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      />
    </div>
  );
}



