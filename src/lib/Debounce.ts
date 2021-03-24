/**
 * @author [qianzhixiang]
 * @email [zxqian199@163.com]
 * @create date 2021-03-23 21:03:43
 * @modify date 2021-03-23 21:03:43
 * @desc [不立马执行 而是等一个固定的时间 如果这个时间内没有新的触发 就执行]
 */

export class Debounce {
  constructor(private handler: () => void, private timeout: number = 0) {}
  private resetPromise() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
  private inter?: number;
  private promise?: Promise<any>;
  private resolve?: (v: any) => void;
  private reject?: (v: any) => void;
  exec() {
    if (!this.promise) {
      this.resetPromise();
    }
    clearTimeout(this.inter);
    this.inter = setTimeout(() => {
      try {
        this.resolve?.(this.handler());
      } catch (e) {
        this.reject?.(e);
      }
      this.promise = undefined;
      this.reject = undefined;
      this.resolve = undefined;
    }, this.timeout);
    return this.promise;
  }
}
