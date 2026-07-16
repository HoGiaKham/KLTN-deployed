import { io } from "socket.io-client";
import { API_HOST } from "./config";

const SOCKET_URL = API_HOST;

let socket = null;

/**
 * Initialize socket connection
 * @param {string} userId - User ID
 * @param {string} userRole - User role (teacher/student)
 */
export const initializeSocket = (userId, userRole) => {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      userId,
      userRole,
    },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  return socket;
};

/**
 * Get current socket instance
 */
export const getSocket = () => {
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
};
