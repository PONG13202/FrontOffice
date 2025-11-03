"use client";

import { createContext, useContext, useEffect } from "react";
import { socket } from "./socket";

const SocketContext = createContext(socket);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // เชื่อมต่อ socket ตอน mount
    if (!socket.connected) socket.connect();

    return () => {
      // ตัดการเชื่อมต่อเมื่อปิดแอป
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

// hook ไว้ใช้เรียก socket ได้ง่าย ๆ
export function useSocket() {
  return useContext(SocketContext);
}
