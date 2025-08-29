import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useRealtime } from "@/hooks/useRealtime";
import { useUserStore } from "@/stores/userStore";
import { api } from "@/services/api";
import { useGridStore } from "@/stores/gridStore";
import ImprovedSpreadsheetLayout from "@/components/Layout/ImprovedSpreadsheetLayout";
 

export default function GridEditor() {
  const { id } = useParams();
  const token = useUserStore((s) => s.token);
  const user = useUserStore((s) => s.user);
  const [title, setTitle] = React.useState<string>("Loading...");
  const [ownerId, setOwnerId] = React.useState<number | null>(null);
  const [sheets, setSheets] = React.useState<Array<{ id: number; public_id?: string; name: string }>>([]);
  const [currentSheet, setCurrentSheet] = React.useState<number>(0);
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
 


  React.useEffect(() => {
    (async () => {
      try {
        if (!id || !token) return;
        const res: any = await api.getGrid(token, id);
        if (res?.success) {
          setTitle(res.data?.title || `#${id}`);
          setOwnerId(res.data?.owner_id ?? null);
          setSheets(res.data?.sheets || []);
          if (res.data?.sheets?.[0]?.id) setCurrentSheet(res.data.sheets[0].id);
        } else setTitle(`#${id}`);
      } catch {
        setTitle(`#${id}`);
      }
    })();
  }, [id, token]);

  useRealtime(id || "demo", currentSheet, token || undefined);

  // 切换激活 sheet 时，同步到 store，用于尺寸隔离
  React.useEffect(() => {
    if (currentSheet != null) {
      useGridStore.getState().setActiveSheet(currentSheet);
    }
  }, [currentSheet]);

 

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1">
        <ImprovedSpreadsheetLayout 
          gridId={id || "demo"} 
          sheetId={currentSheet}
          sheets={sheets}
          onSheetChange={(sheetId) => {
            setCurrentSheet(sheetId);
            useGridStore.getState().setActiveSheet(sheetId);
          }}
          onNewSheet={async () => {
            if (!token || !id) return;
            const name = `Sheet${(sheets?.length || 0) + 1}`;
            console.log('🆕 创建新Sheet:', { name, currentSheets: sheets?.length });
            const res: any = await api.createSheet(token, id, name);
            if (res?.success) {
              setSheets(res.data);
              if (res.data?.length) {
                const newId = res.data[res.data.length - 1].id;
                console.log('🆕 新Sheet创建成功:', { newId, totalSheets: res.data.length });
                setCurrentSheet(newId);
                // 让useRealtime处理setActiveSheet，避免竞态条件
                console.log('🆕 等待useRealtime连接新Sheet...');
              }
            } else {
              console.error('🆕 新Sheet创建失败:', res);
            }
          }}
          onRenameSheet={async (sheetId, newName) => {
            // TODO: 实现重命名API
            console.log('重命名Sheet:', sheetId, newName);
          }}
          onDeleteSheet={async (sheetId) => {
            // TODO: 实现删除API
            console.log('删除Sheet:', sheetId);
          }}
        />
      </div>
    </div>
  );
}

