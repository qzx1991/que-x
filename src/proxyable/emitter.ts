export default class Emitter {
  //  表示正在执行函数队列
  private running = false;
  private handlers = new Map<
    string,
    { handler: (...args: any[]) => void; once?: boolean }[]
  >();
  // 一直监听
  on(eventname: string, handler: (...args: any[]) => void) {
    if (this.handlers.size === 0) {
      return () => {};
    }
    if (!this.handlers.has(eventname)) {
      this.handlers.set(eventname, []);
    }
    const arr = this.handlers.get(eventname);
    const obj: { once?: boolean; handler: typeof handler } = { handler };
    arr?.push(obj);
    return () => {
      if (this.running) {
        obj.once = true; // 伪装成一次性的，方便被过滤
      } else {
        // 直接过滤
        const arr = this.handlers.get(eventname);
        arr?.splice(arr.indexOf(obj), 1);
      }
    };
  }
  // 监听一次
  once(eventname: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(eventname)) {
      this.handlers.set(eventname, []);
    }
    const arr = this.handlers.get(eventname);
    arr?.push({ handler, once: true });
  }
  // 触发事件
  emit(eventname: string, ...values: any[]) {
    const arr = this.handlers.get(eventname);
    if (arr) {
      this.running = true;
      arr.forEach((i) => i.handler(...values));
      this.running = false;
      this.handlers.set(
        eventname,
        arr.filter((i) => !i.once)
      );
    }
  }
  // 销毁
  destroy() {
    this.handlers = new Map();
  }
}
