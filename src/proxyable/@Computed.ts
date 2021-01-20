import { ProxyWatcher } from './Watcher';
export function Computed() {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const value = descriptor.value;
    return {
      get() {
        if (this !== target && !Object.getOwnPropertyDescriptor(this, key)) {
          // 覆盖原先的defineProperty
          const store = {
            shouldUpdate: true,
            value: undefined,
          };
          const compute = function () {
            // 不需要更新，直接取存储值
            if (!store.shouldUpdate) {
              return store.value;
            }
            // 需要更新
            const map = new Map<any, Set<string>>();

            const watcher = new ProxyWatcher();
            const unsub = watcher.onGet((t, k) => {
              if (!map.has(t)) {
                map.set(t, new Set());
              }
              const keys = map.get(t);
              keys?.add(k);
            });
            store.value = value.apply(this, arguments);
            store.shouldUpdate = false;
            // 移除监听
            unsub();
            if (map.size > 0) {
              const unsubSet = watcher.onSet((t, k) => {
                if (map.has(t) && map.get(t)?.has(k)) {
                  map.clear();
                  unsubSet();
                  store.shouldUpdate = true;
                }
              });
            }
            return store.value;
          };
          Object.defineProperty(this, key, {
            value: compute,
          });
          return compute;
        }
        return value;
      },
    };
  };
}
