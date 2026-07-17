import { io } from "socket.io-client";
import { API_HOST } from "./config";

const SOCKET_URL = API_HOST;

let socket = null;

/**
 * Initialize socket connection
 * @param {string} token - JWT token for socket authentication
 */
export const initializeSocket = (token) => {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
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
