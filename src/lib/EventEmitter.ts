import { IdGenerator } from "./IdGenerator";
export class EventEmitter {
  private $idG = new IdGenerator();
  private eventMap = new Map<string, number[]>();
  private handlesMap = new Map<number, IEventEmitterHandler>();
  unsubscribe(eventnames?: string | string[]) {
    // 没有指定事件
    if (eventnames === undefined) {
      // this.eventMap.forEach((i, e) => this.unsubscribe(e));
      this.$idG.clear();
      this.eventMap.clear();
      this.handlesMap.clear();
      return;
    }
    if (!eventnames) {
      throw new Error("参数错误：必须指定需要取消监听的事件");
    }
    const type = typeof eventnames;
    if (type !== "string" && Array.isArray(eventnames)) {
      throw new Error("参数错误：必须是字符串或字符串数组");
    }
    if (type === "string") {
      const eventname = eventnames as string;
      const ids = this.eventMap.get(eventname);
      this.eventMap.delete(eventname);
      ids?.forEach((id) => {
        this.$idG.releaseId(id);
        this.handlesMap.delete(id);
      });
      return;
    }
    (eventnames as string[])
      .filter((e) => e)
      .forEach((eventname) => this.unsubscribe(eventname));
  }
  on(eventname: string, handler: IEventEmitterHandler) {
    if (!this.eventMap.has(eventname)) {
      this.eventMap.set(eventname, []);
    }
    const eventArr = this.eventMap.get(eventname)!;
    const eventId = this.$idG.getId();
    eventArr.push(eventId);
    this.handlesMap.set(eventId, handler);
    return () => {
      const arr = this.eventMap.get(eventname) || [];
      const res = arr.filter((id) => id !== eventId);
      if (res.length === 0) {
        this.eventMap.delete(eventname);
      }
      this.handlesMap.delete(eventId);
      this.$idG.releaseId(eventId);
    };
  }
  emit(eventname: string, ...data: any[]) {
    const eventIds = this.eventMap.get(eventname) || [];
    eventIds.forEach((id) =>
      this.handlesMap.forEach((handler) => handler(...data))
    );
  }
  once(eventname: string, handler: IEventEmitterHandler) {
    const unsubscribe = this.on(eventname, function (...args: any) {
      unsubscribe();
      return handler.apply(this, args);
    });
  }
}

export type IEventEmitterHandler = (...data: any[]) => void;
