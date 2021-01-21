import { emitter } from "./common";

// 使用 _开头的好处是解构的时候不会被解构

/**是否是代理对象 */
const PROXYABLE_FLAG = "_$$__$$__is_proxyable";

/**对象是否被代理福哦 */
const TARGET_PROXY_FLAG = "_$$__$$__has_proxyable";

/** 代理对象的原生对象属性标识 */
const ORIGIN_TARGET_FLAG = "_$$__$$__origin_target_flag";

export function Ref<T>(v: T, recru: (v: any) => boolean) {
  return Proxyable({ value: v }, recru);
}

/**
 *
 * @param target 需要代理的对象
 * @param recru 是否需要迭代代理(比如获取某个属性的值，若值也是对象，那么仍然使用同样的方法进行代理)
 */
export function Proxyable<T>(
  target: T,
  recru: (v: any) => boolean = () => true
): T {
  // 不是一个对象的时候不代理
  if (!target || typeof target !== "object") return target;
  // 这个对象可能本身就是一个代理对象了
  if (isProxyableData(target)) {
    return target;
  }
  /**
   * js的内存机制是从根节点开始， 所以这里即使存在循环引用 也无大碍
   */
  if (hasProxy(target)) {
    return (target as any)[TARGET_PROXY_FLAG];
  }

  const proxy = new Proxy(target as any, {
    // 调用的时候，自动的代理
    get(t, k, r) {
      if (k === PROXYABLE_FLAG) return true;
      if (k === ORIGIN_TARGET_FLAG) return t;
      const v = Reflect.get(t, k, r);
      const value = recru(v) ? Proxyable(v, recru) : v;
      emitter.emit("get", {
        target: proxy,
        property: k,
        value,
      });
      return value;
    },
    // 重设
    set(t, k, v, r) {
      const isAdd = !t.hasOwnProperty(k);
      const oldValue = Reflect.get(t, k);
      const res = Reflect.set(t, k, getOriginData(v), r);
      emitter.emit("set", {
        target: proxy,
        property: k,
        value: v,
        isAdd,
        oldValue: oldValue,
      });
      return res;
    },
    // 删除属性
    deleteProperty(t, p) {
      const oldValue = Reflect.get(t, p);
      const res = Reflect.deleteProperty(t, p);
      emitter.emit("delete", {
        target: proxy,
        property: p,
        oldValue: oldValue,
      });
      return res;
    },
  });
  (target as any)[TARGET_PROXY_FLAG] = proxy;
  return proxy;
}

export function isProxyableData(data: any) {
  return data && typeof data === "object" && data[PROXYABLE_FLAG];
}

export function getOriginData<T>(data: T): T {
  return (data && (data as any)[ORIGIN_TARGET_FLAG]) || data;
}

export function hasProxy(data: any) {
  return data && data.hasOwnProperty(TARGET_PROXY_FLAG);
}
