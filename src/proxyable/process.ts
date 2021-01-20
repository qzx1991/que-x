import { Debounce, Throttle } from "../util";
import { ProxyWatcher } from "./Watcher";

let processId = 0;
const all_processes = new Map<number, Processable>();
const watcher = new ProxyWatcher();
const TARTGET_PROCESS_STORE: Map<
  any,
  Map<string | symbol, Processable[]>
> = new Map();
const PROCESS_TARGET_STORE = new Map<
  Processable,
  Map<any, Set<string | symbol>>
>();
const SYSTEM_ADD_PROPERTY = Symbol("add");
const SYSTEM_DELETE_PROPERTY = Symbol("delete");

let TEMP_RUNNING_PROCESS: Processable | undefined = undefined;

function addProcessTargetStore(t: any, k: string | symbol, v?: any) {
  if (!TEMP_RUNNING_PROCESS) return;
  if (!PROCESS_TARGET_STORE.get(TEMP_RUNNING_PROCESS)) {
    PROCESS_TARGET_STORE.set(TEMP_RUNNING_PROCESS, new Map());
  }
  const pmap = PROCESS_TARGET_STORE.get(TEMP_RUNNING_PROCESS)!;
  if (!pmap.get(t)) {
    pmap.set(t, new Set());
  }
  const pset = pmap.get(t)!;
  pset.add(k);

  if (v && typeof v === "object" && !Array.isArray(v)) {
    if (TEMP_RUNNING_PROCESS.opt?.add) {
      // pset.add(SYSTEM_ADD_PROPERTY);
      addProcessTargetStore(v, SYSTEM_ADD_PROPERTY);
    }
    if (TEMP_RUNNING_PROCESS.opt?.delete) {
      addProcessTargetStore(v, SYSTEM_DELETE_PROPERTY);
    }
  }
}

function addTargetProcessStore(t: any, k: string | symbol, v?: any) {
  if (!TEMP_RUNNING_PROCESS) return;

  if (v && typeof v === "object" && !Array.isArray(v)) {
    // addTargetProcessStore(v, )
    if (TEMP_RUNNING_PROCESS.opt?.add) {
      // pset.add(SYSTEM_ADD_PROPERTY);
      addTargetProcessStore(v, SYSTEM_ADD_PROPERTY);
    }
    if (TEMP_RUNNING_PROCESS.opt?.delete) {
      addTargetProcessStore(v, SYSTEM_DELETE_PROPERTY);
    }
  }

  if (!TARTGET_PROCESS_STORE.get(t)) {
    TARTGET_PROCESS_STORE.set(t, new Map());
  }
  if (!TARTGET_PROCESS_STORE.get(t)!.get(k)) {
    TARTGET_PROCESS_STORE.get(t)!.set(k, []);
  }

  // 这个是表示这个对象的这个k属性关联了哪些process 最终是这些process取重新执行
  const arr = TARTGET_PROCESS_STORE.get(t)!.get(k)!;

  if (arr.length > 0) {
    const lastProcess = arr[arr.length - 1]!;
    // !! endID 仅仅是标识符  不代表子节点的ID一定在这个范围，因为子节点可能不断的变更
    // 这表示我这个process还没结束
    if (lastProcess.endId! < 0) {
      return;
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      // 表示是这个之后的 如果记录在之前其实是不用担心的，因为数组在执行的时候会把子节点都重置成不可执行
      if (p.getId() > TEMP_RUNNING_PROCESS.beginId!) {
        // 移除子节点的依赖
        const process = arr.pop()!;
        PROCESS_TARGET_STORE.get(process)!.get(t)!.delete(k);
      } else {
        // 施展自己，不用管了呀
        if (p.getId() === TEMP_RUNNING_PROCESS.getId()) {
          // return 目的在于跳出循环 避免没必要的循环
          return;
        }
        break;
      }
    }
  }
  arr.push(TEMP_RUNNING_PROCESS);
}

function addRely(t: any, k: string, v?: any) {
  addProcessTargetStore(t, k, v);
  addTargetProcessStore(t, k, v);
}

watcher.onGet((t, k, v) => {
  addRely(t, k, v);
});

function onSet(t: any, k: string | symbol) {
  const ps = TARTGET_PROCESS_STORE.get(t)?.get(k);
  TARTGET_PROCESS_STORE.get(t)?.delete(k);
  if (TARTGET_PROCESS_STORE.get(t)?.size === 0) {
    TARTGET_PROCESS_STORE.delete(t);
  }
  ps?.forEach((p) => {
    /**
     * 在记录的过程中不需要添加
     */
    if (p !== TEMP_RUNNING_PROCESS) {
      p.update();
    }
  });
}

function deleteRely(process: Processable) {
  process.getChildProcess()?.forEach((p) => deleteRely(p));
  PROCESS_TARGET_STORE.get(process)?.forEach((keys, target) => {
    const store = TARTGET_PROCESS_STORE.get(target);
    store &&
      keys.forEach((key) => {
        const processes = store.get(key);
        processes &&
          store.set(
            key,
            processes.filter((p) => p !== process)
          );
      });
  });
  PROCESS_TARGET_STORE.delete(process);
}
watcher.onSet((t, k, v, ov, isAdd) => {
  // 对于t的常规属性的操作
  onSet(t, k);
  if (isAdd) {
    if (t && typeof t === "object" && !Array.isArray(t)) {
      onSet(t, SYSTEM_ADD_PROPERTY);
    }
  }
});

watcher.onDelete((t, k, ov) => {
  onSet(t, SYSTEM_DELETE_PROPERTY);
});
export function getTempProcess() {
  return TEMP_RUNNING_PROCESS;
}
export class Processable {
  static withoutRecording(handler: () => void) {
    let lastProces = TEMP_RUNNING_PROCESS;
    TEMP_RUNNING_PROCESS = undefined;
    handler();
    TEMP_RUNNING_PROCESS = lastProces;
  }
  static getProcess(id: number) {
    return all_processes.get(id);
  }
  static getAllProcess() {
    return all_processes;
  }

  static hasSameRely(
    rely1: Map<any, Set<string | symbol>>,
    rely2: Map<any, Set<string | symbol>>
  ) {
    if (rely1.size === rely2.size) {
      rely1.forEach((v, k) => {
        if (!rely2.has(k)) {
          return false;
        }
        const v2 = rely2.get(k);
        if (v.size !== v2?.size) {
          return false;
        }
        v.forEach((v) => {
          if (!v2.has(v)) {
            return false;
          }
        });
      });
      return true;
    }
    return false;
  }

  private value?: (() => void | (() => void)) | void;
  private _shouldGoOn: boolean = true;

  private id: number;

  private childProcess = new Set<Processable>();

  get isLive() {
    return this._shouldGoOn;
  }

  getValue() {
    return this.value;
  }

  getRely() {
    return PROCESS_TARGET_STORE.get(this);
  }

  // 一个标识，表明是第几次被调用
  count = 1;

  beginId?: number;

  endId?: number;

  throttle: Throttle | undefined;
  debounce: Debounce | undefined;

  useTick = false;

  tick = 0;

  // 父节点ID
  parent?: Processable = TEMP_RUNNING_PROCESS;

  constructor(
    public handler: (opt: {
      count: number;
      id: number;
      process: Processable;
    }) => (() => void) | void,
    public opt?: {
      // 一个进程可能关联多个数据 在一个生命周期中，这些数据可能有多个被更新，如果不使用nexttick run函数会被执行多次
      nexttick?: number | boolean; // 下一个周期执行这里定义下一个周期的时间 0 就是setTimeout
      // 是否在初始化的时候就运行
      initOnRun?: boolean;
      // 是否监听属性的删除
      delete?: boolean;
      // 是否监听属性的增加
      add?: boolean;
    }
  ) {
    opt = opt || {};
    const {
      initOnRun = true, // 是否在初始化的时候就执行
      nexttick = true, // 默认等待一个setTimeout 0的生命周期再执行
    } = opt;
    this.id = ++processId;
    all_processes.set(this.id, this);
    initOnRun && this.run();
    this.useTick = nexttick !== false;
    this.tick = this.useTick
      ? nexttick === true
        ? 0
        : (nexttick as number)
      : 0;
    // 之所以使用throttle和debounce 是希望用throttle和debounce提供的函数来实现一个setTimeout()类似的函数，也可以直接使用setTimeout
    if (this.useTick) {
      this.throttle = new Throttle(this.tick);
      this.debounce = new Debounce(this.tick);
    }
  }

  getId() {
    return this.id;
  }

  /**
   * 一个process钟可能有包含其他的process
   * 因此重新执行的时候，需要停止自己包含的其他process
   * 以防止不必要计算和内存泄漏
   */

  clearChildProcess() {
    this.childProcess.forEach((p) => {
      p.stop();
    });
    this.childProcess.clear();
  }

  getChildProcess() {
    return this.childProcess;
  }

  // 执行这个线程 同时记录子线程
  run() {
    // 不该继续，那得停止 _shouldGoOn是一个状态标志位
    if (!this._shouldGoOn) return;
    this.beginId = processId;
    this.endId = -1;
    // 清空自己的依赖
    deleteRely(this);
    // 要销毁之前的事件监听
    this.removeEvents();
    // 由于重新运行了，需要清除之前的子程序
    this.clearChildProcess();
    // 保存上个进程 以便结束时交还
    let lastProces = TEMP_RUNNING_PROCESS;
    // 将当前进程加入父进程
    lastProces?.childProcess?.add(this);
    // 保为当前进程
    TEMP_RUNNING_PROCESS = this;
    // 执行函数 上方的监听函数会自动的记录这个过程中用到的数据
    this.value = this.handler({
      count: this.count++,
      process: this,
      id: this.id,
    });
    // 交还
    TEMP_RUNNING_PROCESS = lastProces;
    //记录endId
    this.endId = processId;
    /**
     * beginId和endId时作什么的呢？
     * 一个函数执行的过程中可能会生成很多的子进程，子进程同样也会生成自己的子进程，如此反复，最终形成了一棵线程树
     * 这里却不得不考虑的一个问题是：
     * 1. 父进程依赖了一个数据
     * 2. 子进程也依赖了同样的数据
     * 理想的情况是 父进程执行了 子进程不用执行了
     * 现实情况是：子进程和父进程依赖的先后顺序不确定，因此执行顺序也不确定
     * 那么有可能就是
     * 1.子进程先执行了，在执行父进程 父进程清空旧的子进程又生成了新的子进程
     * 2.父进程先执行，清空子进程，执行一遍
     * 可以看到，对于第一种情况，子进程会被多执行一次，尽管不会影响最终结果，但是却带来了没有必要的计算消耗。
     *
     * beginId 和 endId的存在就是为了解决这个矛盾
     *
     * beginId表示的是进程开始执行的时候 当前的最新的进程号
     * 如果有子进程，子进程的ID号定是 >= beginId
     *
     * 开始执行的时候 beginId = processId  endId = -1;
     *
     * endId的目的在于 记录的时候判断是否在上一个i进程之后， -1 表示上一次这个对象的这个属性对应的process还没结束，那只能是自己或者父节点 那可以不用管
     *
     * beginId的目的在于  记录依赖的时候 如果遇到已经记录的依赖的id大于当前执行进程的beginId 表示那个是自己的子节点 要移除依赖
     *
     */
  }

  update() {
    if (this.useTick) {
      // 忽略nextick内的请求，默认就是一个setTimeout 0的生命周期
      // 同时延迟next执行
      this.throttle?.execute(() => this.debounce?.execute(() => this.run()));
    } else {
      this.run();
    }
  }

  /**
   * reRun一般是在一个process已经停止了之后需要重新执行
   */
  reRun() {
    this._shouldGoOn = true;
    // stop的时候已经从总进程中删除了进程ＩＤ
    all_processes.set(this.id, this);
    this.run();
  }

  /**
   * 返回结果是一个函数的话  表示是一个要在销毁时执行的函数
   */
  removeEvents() {
    if (this.value && typeof this.value === "function") {
      return this.value();
    }
  }

  stop() {
    // 已经停止了 没必要继续了
    if (!this._shouldGoOn) return;
    const afterRemove = this.removeEvents();
    this.clearChildProcess();
    // 设置状态为停止状态
    this._shouldGoOn = false;
    // 移除事件 一个process在执行完一个过程后，可以通过一个返回函数来作为钩子函数以待停止时去调用
    // 清除进程ID的记录
    all_processes.delete(this.id);
    if (afterRemove) {
      afterRemove();
    }
  }
}
