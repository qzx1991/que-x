/**
 * @author [qianzhixiang]
 * @email [zxqian199@163.com]
 * @create date 2021-03-23 21:03:43
 * @modify date 2021-03-23 21:03:43
 * @desc [不立马执行 而是等一个固定的时间 如果这个时间内没有新的触发 就执行]
 */

export class Throttle {
  constructor(private handler: () => void, private timeout: number = 0) {}
  private running = false;
  private value: any;
  exec() {
    if (this.running) {
      return this.value;
    }
    this.running = true;
    setTimeout(() => {
      this.running = false;
    }, this.timeout);
    this.value = this.handler();
    return this.value;
  }
}
