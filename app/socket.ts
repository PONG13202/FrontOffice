// socket.ts
import { io } from "socket.io-client";
import { config } from "./config";

export const socket = io(config.apiUrl, {
  autoConnect: false,
  transports: ["websocket"],      // ลดปัญหา polling/CORS
  withCredentials: true,          // ให้ตรงกับ server ที่เปิด credentials:true
});
