import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { auth } from '../config/firebase';

let socketInstance = null;

/**
 * Resolve Socket.IO Server URL
 * Connects directly to backend on localhost, or through Vite/host proxy on other devices.
 */
const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    // If an explicit remote production backend URL is configured (not pointing to localhost), use it
    if (
      API_BASE_URL &&
      API_BASE_URL.startsWith('http') &&
      !API_BASE_URL.includes('localhost') &&
      !API_BASE_URL.includes('127.0.0.1')
    ) {
      return API_BASE_URL;
    }

    // When running locally on the dev machine, connect directly to backend port 5001
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return API_BASE_URL && API_BASE_URL.startsWith('http') ? API_BASE_URL : 'http://localhost:5001';
    }

    // On other devices (e.g. mobile/LAN IP), connect via current origin where Vite proxies /socket.io
    return window.location.origin;
  }
  return API_BASE_URL || 'http://localhost:5001';
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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  } else if (token) {
    socketInstance.auth = { token };
  }

  // Update socket token asynchronously if Firebase user is logged in
  if (!token && auth?.currentUser) {
    auth.currentUser.getIdToken().then((fbToken) => {
      if (socketInstance && fbToken) {
        socketInstance.auth = { token: fbToken };
      }
    }).catch(() => {});
  }

  return socketInstance;
};

/**
 * Connect socket instance (synchronous)
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
