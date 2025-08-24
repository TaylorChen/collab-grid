import { io, Socket } from "socket.io-client";
import { WS_NAMESPACE } from "@collab-grid/shared";

let socket: Socket | null = null;

export function connectWS(token?: string) {
  const wsUrl = import.meta.env.VITE_WS_URL || "http://localhost:4000";
  if (!socket) {
    socket = io(`${wsUrl}${WS_NAMESPACE}`, { autoConnect: false });
  }
  if (token) {
    (socket as any).auth = { token };
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function getWS(): Socket | null {
  return socket;
}

export function disconnectWS() {
  socket?.disconnect();
  socket = null;
}

