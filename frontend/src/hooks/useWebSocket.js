import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:5000/ws';

export const useWebSocket = (onMessage) => {
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const [status, setStatus]   = useState('connecting');
  const [lastEvent, setLastEvent] = useState(null);

  // Keep onMessage ref fresh without re-triggering effect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        clearTimeout(reconnectRef.current);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setLastEvent(msg);
          onMessageRef.current?.(msg);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setStatus('reconnecting');
        reconnectRef.current = setTimeout(connect, 4000);
      };

      ws.onerror = () => setStatus('error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, lastEvent, send };
};