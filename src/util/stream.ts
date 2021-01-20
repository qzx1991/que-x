/**
 * Throttle
 * 一个方法开始执行后，忽略这个范围内的其他请求执行
 */
export class Throttle {
  timeSchedule: NodeJS.Timeout | number | null = null;

  private tickHandlers: (() => void)[] = [];

  nextTick(func: () => void) {
    this.tickHandlers.push(func);
  }

  constructor(private timeout = 50) {}

  // 这个时间段内的请求直接忽略
  execute(func = () => {}) {
    if (this.timeSchedule) {
      return;
    }
    this.timeSchedule = setTimeout(() => {
      this.timeSchedule = null;
      this.tickHandlers.forEach((h) => h());
    }, this.timeout);
    return func();
  }
}

/**
 * Debounce 有新的请求过来就取消上一个 以新的为准
 */
export class Debounce {
  timeSchedule: NodeJS.Timeout | number | null = null;

  constructor(private timeout = 300) {}

  async execute(func: () => any = () => {}) {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeSchedule as any); // 编译时可能会报错，暂留，有时间解决
      this.timeSchedule = setTimeout(async () => {
        const promise = func();
        if (promise && promise.catch) {
          promise.catch((e: Error) => reject(e));
        }
        resolve(await promise);
      }, this.timeout);
    });
  }
}
