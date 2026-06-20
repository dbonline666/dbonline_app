import {useEffect, useMemo, useState} from 'react';
import type {JsonRecord, ServerConfig} from '../types';
import {buildSchedulerWsUrl} from '../utils/url';

type SchedulerSocketState = {
  connected: boolean;
  status: JsonRecord | null;
  error: string | null;
};

export const useSchedulerSocket = (serverConfig: ServerConfig | null, enabled: boolean) => {
  const [state, setState] = useState<SchedulerSocketState>({
    connected: false,
    status: null,
    error: null,
  });

  const url = useMemo(
    () => (serverConfig ? buildSchedulerWsUrl(serverConfig.wsBaseUrl) : null),
    [serverConfig],
  );

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(url);
      socket.onopen = () => {
        if (!closed) {
          setState(current => ({...current, connected: true, error: null}));
        }
      };
      socket.onmessage = event => {
        try {
          const status = JSON.parse(String(event.data)) as JsonRecord;
          setState(current => ({...current, status}));
        } catch {
          setState(current => ({...current, error: 'WebSocket 消息解析失败'}));
        }
      };
      socket.onerror = () => {
        if (!closed) {
          setState(current => ({...current, error: 'WebSocket 连接失败'}));
        }
      };
      socket.onclose = () => {
        if (closed) {
          return;
        }
        setState(current => ({...current, connected: false}));
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [enabled, url]);

  return state;
};

