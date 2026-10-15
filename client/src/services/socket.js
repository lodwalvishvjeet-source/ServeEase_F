import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socketInstance = null;

/**
 * Resolve Socket.IO Server URL
 * In development, defaults to backend port 5001 or API_BASE_URL
 */
const getSocketUrl = () => {
  if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
    return API_BASE_URL;
  }
  // If Vite is proxying /api to http://localhost:5001, connect socket directly to backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5001';
  }
  return window.location.origin;
};

/**
 * Get or initialize singleton Socket instance
 */
export const getSocket = (token) => {
  if (!socketInstance) {
    const socketUrl = getSocketUrl();
    socketInstance = io(socketUrl, {
      withCredentials: true,
      autoConnect: false,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
  } else if (token) {
    socketInstance.auth = { token };
  }

  return socketInstance;
};

/**
 * Connect socket instance
 */
export const connectSocket = (token) => {
  const socket = getSocket(token);
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

/**
 * Disconnect socket cleanly
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export default {
  getSocket,
  connectSocket,
  disconnectSocket
};
