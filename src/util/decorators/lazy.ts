/**
 * @author qianzhixiang
 * @email [zxqian1991@163.com]
 * @create date 2020-12-16 15:30:42
 * @modify date 2020-12-16 15:30:42
 * @desc [某个后台请求的接口在未来的一段时间内不发送请求而是从缓存读取]
 */

export function lazy(timeout = 1000 * 60) {
  return (target: Object, property: string, descriptor: PropertyDescriptor) => {
    let cacheArguments: any = [];
    let cacheValue: any = undefined;
    let lastDate: number | undefined = undefined;
    const func = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const now = new Date().getTime();
      // 判断是否超时
      const isOutDate =
        // timeout < 0表示不受时间影响 只受参数影响 也就是永不过期
        timeout < 0 ? false : !lastDate || now - lastDate >= timeout;
      const isArgsSame =
        // 参数都不存在的情况
        (!cacheArguments && !args) ||
        // 都是空数组
        (cacheArguments &&
          cacheArguments.length === 0 &&
          args &&
          args.length === 0) ||
        // 都存在而且值还都一样
        (cacheArguments &&
          args &&
          cacheArguments.length === args.length &&
          cacheArguments.forEach((p: any, index: number) => p === args[index]));
      // 没有过期，参数也一样， 那就返回缓存的值
      if (!isOutDate && isArgsSame) {
        // const res = func.apply(this, args);
        return cacheValue;
      }
      cacheArguments = args;
      lastDate = now;
      cacheValue = func.apply(this, args);
      return cacheValue;
    };
  };
}
