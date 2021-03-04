const NORMAL_HANDLERS = new Map<keyof IStateHandler, Set<any>>();
const TARGET_HANDLERS = new Map<any, Map<keyof IStateHandler, Set<any>>>();
const PROXYABLE_FLAG = Symbol("is_proxyable");
const ORIGIN_TARGET_FLAG = Symbol("origin_target_flag");

/**
 *
 * @param target 需要被状态化的对象
 * @param recursion 是否递归状态化 默认true
 */
export function Stateable<T>(target: T, recursion = true): T {
  if (typeof target !== "object") return target;
  if (isStateableData(target)) {
    return target;
  }
  const proxy = new Proxy(target as any, {
    // 调用的时候，自动的代理
    get(t, k, r) {
      // 判断对象是不是状态化后的对象用到
      if (k === PROXYABLE_FLAG) return true;
      // 获取代理后对象的原始对象会用到
      if (k === ORIGIN_TARGET_FLAG) return t;
      const rawValue = Reflect.get(t, k, r);
      const value = recursion ? Stateable(rawValue) : rawValue;
      notifyState("get", {
        target: t,
        property: k,
        value,
      });
      return value;
    }, // 重设
    set(t, k, v, r) {
      // 在stateable的世界里，一切都是stateable，不过渡设计
      const isAdd = !t.hasOwnProperty(k);
      const rawValue = Reflect.get(t, k);
      const oldValue = recursion ? Stateable(rawValue) : rawValue;
      // 原对象上保留原数据，即使赋值也是如此
      const res = Reflect.set(t, k, getStateOrigin(v), r);
      notifyState("set", {
        target: t,
        property: k,
        value: recursion ? Stateable(v) : v,
        isAdd,
        oldValue,
      });
      return res;
    },
    // 删除属性
    deleteProperty(t, p) {
      const oldValue = Reflect.get(t, p);
      const res = Reflect.deleteProperty(t, p);
      notifyState("delete", {
        target: t,
        property: p,
        value: recursion ? Stateable(oldValue) : oldValue,
      });
      return res;
    },
  });
  return proxy;
}

// 获取某个状态的原始数据
export function getStateOrigin<T>(data: any): T {
  return (data && (data as any)[ORIGIN_TARGET_FLAG]) || data;
}

// 判断某个数据是不是一个被代理数据(也就是Stateable之后的数据)
export function isStateableData<T>(target: T) {
  return (
    target && typeof target === "object" && (target as any)[PROXYABLE_FLAG]
  );
}

// 不同类型的触发事件的处理类型
interface IStateHandler {
  delete: (target: any, key: string | number | symbol, value: any) => void;
  get: (target: any, key: string | number | symbol, value: any) => void;
  set: (
    target: any,
    key: string | number | symbol,
    value: any,
    oldValue: any,
    isadd: boolean
  ) => void;
}
// 某个类型的事件被触发后
export function onState<P extends keyof IStateHandler>(
  type: P,
  handler: IStateHandler[P]
) {
  if (!NORMAL_HANDLERS.has(type)) {
    NORMAL_HANDLERS.set(type, new Set());
  }
  NORMAL_HANDLERS.get(type)?.add(handler);
  return () => {
    const set = NORMAL_HANDLERS.get(type);
    set?.delete(handler);
    if (set?.size === 0) {
      NORMAL_HANDLERS.delete(type);
    }
  };
}

onState("get", (target, key, value) => {
  const handlers = TARGET_HANDLERS.get(target)?.get("get");
  handlers?.forEach((handler: IStateHandler["get"]) =>
    handler(target, key, value)
  );
});

onState("set", (target, key, value, oldvalue, isadd) => {
  const handlers = TARGET_HANDLERS.get(target)?.get("set");
  handlers?.forEach((handler: IStateHandler["set"]) =>
    handler(target, key, value, oldvalue, isadd)
  );
});

onState("delete", (target, key, value) => {
  const handlers = TARGET_HANDLERS.get(target)?.get("delete");
  handlers?.forEach((handler: IStateHandler["delete"]) =>
    handler(target, key, value)
  );
});

// 某个对象的对应类型的事件被触发后 返回一个函数，表示取消监听
export function onTargetState<P extends keyof IStateHandler>(
  target: any,
  type: P,
  handler: IStateHandler[P]
) {
  if (!TARGET_HANDLERS.has(target)) {
    TARGET_HANDLERS.set(target, new Map());
  }
  if (!TARGET_HANDLERS.get(target)?.get(type)) {
    TARGET_HANDLERS.get(target)?.set(type, new Set());
  }
  TARGET_HANDLERS.get(target)?.get(type)?.add(handler);

  return () => {
    const set = TARGET_HANDLERS.get(target)?.get(type);
    set?.delete(handler);
    if (set?.size === 0) {
      TARGET_HANDLERS.get(target)?.delete(type);
      if (TARGET_HANDLERS.get(target)?.size === 0) {
        TARGET_HANDLERS.delete(target);
      }
    }
  };
}

// 某个对象的对应类型的事件被触发后  只触发一次
export function onceTargetState<P extends keyof IStateHandler>(
  target: any,
  type: P,
  handler: IStateHandler[P]
) {
  const unsubscribe = onTargetState(target, type, (...args: any) => {
    (handler as any)(...args);
    // 解除监听
    unsubscribe();
  });
}

// 事件发生后传递的数据类型
interface IStateNotifyData {
  delete: {
    target: any;
    property: string | number | symbol;
    value: any;
  };
  set: {
    target: any;
    property: string | number | symbol;
    value: any;
    oldValue: any;
    isAdd: boolean;
  };
  get: {
    target: any;
    property: string | number | symbol;
    value: any;
  };
}

// 发生事件时传递事件的方法
export function notifyState<P extends keyof IStateNotifyData>(
  type: P,
  data: IStateNotifyData[P]
) {
  NORMAL_HANDLERS.get(type)?.forEach((handler: any) => {
    switch (type) {
      case "get":
        handler(data.target, data.property, data.value);
        break;
      case "delete":
        handler(data.target, data.property, data.value);
        break;
      case "set":
        handler(
          data.target,
          data.property,
          data.value,
          (data as IStateNotifyData["set"]).oldValue
        );
        break;
    }
  });
}

// 对外提供的一个注解 可以使用该注解去状态化想要状态的数据
export function State() {
  return (target: any, key: string) => {
    let value = Reflect.get(target, key);
    Object.defineProperty(target, key, {
      get() {
        return value;
      },
      set(v) {
        // 这表示自己可能作为了别人的原型链的一员，这时不应该做什么事
        const descriptor = Object.getOwnPropertyDescriptor(this, key);
        if (this === target || descriptor) {
          value = v;
        } else if (!descriptor) {
          let tValue = v;
          // 重新定义这个属性
          Object.defineProperty(this, key, {
            get() {
              const proxyableData = Stateable(tValue);
              notifyState("get", {
                target: this,
                property: key,
                value: proxyableData,
              });
              return proxyableData;
            },
            set(v) {
              notifyState("set", {
                target: this,
                property: key,
                value: v,
                oldValue: tValue,
                isAdd: false,
              });
              tValue = v;
            },
          });
        }
      },
    });
  };
}
