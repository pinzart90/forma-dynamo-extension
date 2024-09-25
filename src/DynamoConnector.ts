import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  default as Dynamo,
  DynamoService,
  FetchError,
  GraphInfo,
  GraphTarget,
  RunInputs,
} from "./service/dynamo.ts";
import PromiseQueue from "./utils/PromiseQueue.ts";

export enum DynamoConnectionState {
  INIT = "INIT",
  CONNECTED = "CONNECTED",
  MULTIPLE_CONNECTIONS = "MULTIPLE_CONNECTIONS",
  NOT_CONNECTED = "NOT_CONNECTED",
  BLOCKED = "BLOCKED",
  LOST_CONNECTION = "LOST_CONNECTION",
}

export type DynamoState = {
  currentOpenGraph?: GraphInfo;
  connectionState: DynamoConnectionState;
};

export const useDynamoConnector = () => {
  const [state, setState] = useState<DynamoState>({ connectionState: DynamoConnectionState.INIT });
  const [dynamoPort, setDynamoPort] = useState<number | undefined>(undefined);

  const getDynamoUrl = useCallback(() => {
    return `http://localhost:${dynamoPort}`;
  }, [dynamoPort]);

  const portDiscovery = async () => {
    setDynamoPort(undefined);
    const defaultPort = 55100;

    const portsToCheck = [...Array(10)].map((_, i) => defaultPort + i);
    try {
      const response = await Promise.any(portsToCheck.map((port) => Dynamo.health(port)));

      setState((state) => ({ ...state, connectionState: DynamoConnectionState.CONNECTED }));
      setDynamoPort(response.port);
    } catch (e) {
      if (e instanceof AggregateError) {
        if (e.errors.find((e) => (e as FetchError).status === 503)) {
          setState((state) => ({ ...state, connectionState: DynamoConnectionState.BLOCKED }));
        } else {
          setState((state) => ({ ...state, connectionState: DynamoConnectionState.NOT_CONNECTED }));
        }
      }
    }
  };

  useEffect(() => {
    if (state.connectionState === DynamoConnectionState.INIT) {
      portDiscovery();
    }
  }, [state.connectionState]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (
      [
        DynamoConnectionState.NOT_CONNECTED,
        DynamoConnectionState.MULTIPLE_CONNECTIONS,
        DynamoConnectionState.BLOCKED,
        DynamoConnectionState.LOST_CONNECTION,
      ].includes(state.connectionState)
    ) {
      intervalId = setInterval(() => {
        portDiscovery();
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [state.connectionState]);

  const dynamoLocalService: DynamoService = useMemo(() => {
    const url = getDynamoUrl();

    const dynamo = new Dynamo(url);

    return {
      folder: (path: string) => {
        return dynamo.folder(path).catch((e) => {
          setState((state) => ({
            ...state,
            connectionState: DynamoConnectionState.LOST_CONNECTION,
          }));
          throw e;
        });
      },
      current: () => {
        return dynamo.info({ type: "CurrentGraphTarget" });
      },
      info: (target: GraphTarget) => {
        return dynamo.info(target).catch((e) => {
          if (!(e.status === 500 && e.message === "Graph is not trusted.")) {
            setState((state) => ({
              ...state,
              connectionState: DynamoConnectionState.LOST_CONNECTION,
            }));
          }
          throw e;
        });
      },
      run: (target: GraphTarget, inputs: RunInputs) => {
        return dynamo.run(target, inputs).catch((e) => {
          setState((state) => ({
            ...state,
            connectionState: DynamoConnectionState.LOST_CONNECTION,
          }));
          throw e;
        });
      },
      trust: (path: string) => {
        return dynamo.trust(path).catch((e) => {
          setState((state) => ({
            ...state,
            connectionState: DynamoConnectionState.LOST_CONNECTION,
          }));
          throw e;
        });
      },
      serverInfo: () => {
        return dynamo.serverInfo();
      },
      health: (port: number) => {
        return Dynamo.health(port);
      },
    };
  }, [getDynamoUrl]);

  const queuedDynamoLocalService = useMemo(() => {
    const queue = PromiseQueue();

    return {
      folder: (path: string) => {
        return queue.enqueue(() => {
          console.log("executing: folder");
          return dynamoLocalService.folder(path);
        });
      },
      current: () => {
        return queue.enqueue(() => {
          console.log("executing: current");
          return dynamoLocalService.info({ type: "CurrentGraphTarget" });
        });
      },
      info: (target: GraphTarget) => {
        return queue.enqueue(() => {
          console.log("executing: info");
          return dynamoLocalService.info(target);
        });
      },
      run: (target: GraphTarget, inputs: RunInputs) => {
        return queue.enqueue(() => {
          console.log("executing: run");
          return dynamoLocalService.run(target, inputs);
        });
      },
      trust: (path: string) => {
        return queue.enqueue(() => {
          console.log("executing: trust");
          return dynamoLocalService.trust(path);
        });
      },
      serverInfo: () => {
        return queue.enqueue(() => {
          console.log("executing: serverInfo");
          return dynamoLocalService.serverInfo();
        });
      },
      health: (port: number) => {
        return queue.enqueue(() => {
          console.log("executing: health");
          return dynamoLocalService.health(port);
        });
      },
    };
  }, [dynamoLocalService]);

  return {
    state,
    reconnect: portDiscovery,
    dynamo: queuedDynamoLocalService,
  };
};
