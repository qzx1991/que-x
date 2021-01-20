import { Debounce, Throttle } from "..";

// 网络防抖 300ms内有新的请求都会重置，直到300毫秒内没有输入
export function DeocratorOfDebounceTime(timeout = 300) {
  return (target: object, property: string, descriptor: PropertyDescriptor) => {
    const func = descriptor.value;
    const debounceMap = new Map<any, Debounce>();
    descriptor.value = async function (...args: any) {
      if (!debounceMap.has(this)) {
        debounceMap.set(this, new Debounce(timeout));
      }
      const debounce = debounceMap.get(this);
      const res = debounce!.execute(() => func.apply(this, args));
      res.finally(() => debounceMap.delete(this));
      return res;
    };
  };
}

// 节流函数 忽略一定时间段内的其他的操作
export function DecoratorOfThrottleTime(timeout = 300) {
  return (target: object, property: string, descriptor: PropertyDescriptor) => {
    const func = descriptor.value;
    // throttle 是类相关的，所有的类公用一个， 可能有问题

    const throttleMap = new Map<any, Throttle>();

    descriptor.value = function () {
      const args = arguments;
      if (!throttleMap.has(this)) {
        throttleMap.set(this, new Throttle(timeout));
      }
      const throttle = throttleMap.get(this)!;
      const hasSchedule = throttle.timeSchedule;
      const res = throttle.execute(() => func.apply(this, args));
      if (!hasSchedule) {
        throttle.nextTick(() => throttleMap.delete(this));
      }
      return res;
    };
    // return descriptor;
  };
}

// 保证同一个请求只会在返回结果后才会进行下一次请求，新的请求都会被忽略
export function DecoratorOfPending() {
  return (target: object, property: string, descriptor: PropertyDescriptor) => {
    const func = descriptor.value;
    // pendding住的方法，其实还是掉了的，只不过是等第一个调完
    let arr: ((err: Error | null | undefined, data?: any) => void)[] = [];

    const runningMap = new Map<any, boolean>();
    // 重新定义方法
    descriptor.value = function temp() {
      const args = arguments;
      if (!runningMap.has(this)) {
        runningMap.set(this, false);
      }
      if (runningMap.get(this)) {
        // 表示已经有请求在了，不要重复的去做了
        return new Promise((resolve, reject) => {
          arr.push((err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
      } else {
        // 没有请求阻塞，直接走着
        runningMap.set(this, true);
        const res = func.apply(this, args);
        // 也有可能不是promise
        if (res && res.then) {
          return res
            .then((data: any) => {
              arr.forEach((item) => item && item(null, data));
              return data;
            })
            .catch((e: Error) => {
              arr.forEach((item) => item && item(e));
              return e;
            })
            .finally(() => {
              runningMap.delete(this);
              arr = []; // arr需要重置
            });
        } else {
          // 不是promise直接返回
          // 由于是同步，所以不需要跑arr
          runningMap.delete(this);
          return res;
        }
      }
    };
  };
}
