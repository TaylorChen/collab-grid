# CollabGrid

在线协作表格（Monorepo）。

## 技术栈
- 前端：React 18 + TypeScript + Zustand + React Query + Tailwind + Vite
- 后端：Node.js + Express + TypeScript + Socket.IO + Redis
- 数据库：MySQL，缓存：Redis，文件存储：MinIO
- 容器化：Docker Compose

## 快速开始

1. 安装依赖
```bash
npm install
```

2. 启动基础设施（本地 MySQL/Redis/MinIO）
```bash
npm run dev:infra
```

3. 启动开发服务
```bash
npm run dev:server
npm run dev:client
```

4. 访问
- API: http://localhost:4000/healthz
- Web: http://localhost:5173

## 目录结构
参见 `packages/`：`client`、`server`、`shared`

## 许可证
本项目采用 MIT 许可证，详见 `LICENSE`。

