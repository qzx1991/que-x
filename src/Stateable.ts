import { EventEmitter, IEventEmitterHandler } from "./lib/EventEmitter";
const STATEABLE_FLAG = Symbol("$STATEABLE_FLAG$");
const STATEABLE_ORIGIN_FLAG = Symbol("$STATEABLE_ORIGIN_FLAG$");
// const STATEABLE_STORE = Symbol("$STATEABLE_STORE$");
let should_emit = true;
const emitter = new EventEmitter();
export function isStateableData(data: any) {
  return data && data[STATEABLE_FLAG];
}
export function getStateOriginData(data: any) {
  return isStateableData(data) ? data[STATEABLE_ORIGIN_FLAG] : data;
}
export function Stateable<T>(data: T): T {
  const type = typeof data;
  if (type !== "object" || isStateableData(data)) {
    return data;
  }
  const store = {};
  const proxy = new Proxy(data as Object, {
    get(t, k, r) {
      if (k === STATEABLE_FLAG) return true;
      if (k === STATEABLE_ORIGIN_FLAG) return t;
      // if (k === STATEABLE_STORE) return store;
      const v = Reflect.get(t, k, r);
      const value = Stateable(v);

      should_emit &&
        emitter.emit("get", {
          target: proxy,
          key: k,
          value,
        });
      return value;
    },
    set(t, k, v, r) {
      const isAdd = !t.hasOwnProperty(k);
      const originState = should_emit;
      should_emit = false;
      // 获取旧值
      const oldValue = (proxy as any)[k];
      should_emit = originState;
      const res = Reflect.set(t, k, getStateOriginData(v), r);
      should_emit &&
        emitter.emit("set", {
          target: proxy,
          key: k,
          isAdd,
          value: Stateable(v),
          oldValue,
        });
      return res;
    },
    deleteProperty(t, k) {
      const originState = should_emit;
      should_emit = false;
      const oldValue = (proxy as any)[k];
      should_emit = originState;
      const res = Reflect.deleteProperty(t, k);
      should_emit &&
        emitter.emit("delete", {
          target: proxy,
          property: k,
          oldValue: oldValue,
        });
      return res;
    },
  });
  return proxy as T;
}

// 方便打印
const log = console.log;
console.log = function (...args: any[]) {
  return log.apply(
    this,
    args.map((i) => {
      return isStateableData(i) ? getStateOriginData(i) : i;
    })
  );
};

// 监听数据
export class StateWatcher {
  on(eventname: "get", handler: (data: IStateableGetData) => void): () => void;
  on(eventname: "set", handler: (data: IStateableSetData) => void): () => void;
  on(
    eventname: "delete",
    handler: (data: IStateableDeleteData) => void
  ): () => void;
  on(eventname: string, handler: IEventEmitterHandler) {
    return emitter.on(eventname, handler);
  }

  once(eventname: "get", handler: (data: IStateableGetData) => void): void;
  once(eventname: "set", handler: (data: IStateableSetData) => void): void;
  once(
    eventname: "delete",
    handler: (data: IStateableDeleteData) => void
  ): void;
  once(eventname: string, handler: IEventEmitterHandler) {
    return emitter.once(eventname, handler);
  }
}

// 让某个属性可以被监听
export function State() {
  return (target: any, key: string) => {
    // 这里的target其实是被注解的类的prototype 是它的原型链，
    // 因此，如果要对原型的属性做点什么 得有个地方去存储
    let value = Reflect.get(target, key);
    Object.defineProperty(target, key, {
      get() {
        // 是继承对象在读取
        return value;
      },
      set(v) {
        // 这表示自己可能作为了别人的原型链的一员，这时不应该做什么事
        const descriptor = Object.getOwnPropertyDescriptor(this, key);
        if (this === target || descriptor) {
          value = v;
        }
        // descriptor?.get
        if (!descriptor) {
          let tValue = Stateable(v);
          Object.defineProperty(this, key, {
            get() {
              should_emit &&
                emitter.emit("get", {
                  target: this,
                  property: key,
                  value: tValue,
                });
              return tValue;
            },
            set(v) {
              const isAdd = !this.hasOwnProperty(key);
              const origin = should_emit;
              should_emit = false;
              const oldValue = this[key];
              should_emit = origin;
              should_emit &&
                emitter.emit("set", {
                  target: this,
                  property: key,
                  value: v,
                  isAdd,
                  oldValue,
                });
              tValue = v;
            },
          });
        }
      },
    });
  };
}

export interface IStateableGetData {
  target: any;
  key: string;
  value: any;
}

export interface IStateableSetData {
  target: any;
  key: string;
  isAdd: boolean;
  oldValue: any;
  value: any;
}

export interface IStateableDeleteData {
  target: any;
  key: string;
  oldValue: any;
}
