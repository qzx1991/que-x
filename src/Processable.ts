import {
  StateWatcher,
  IStateableGetData,
  IStateableSetData,
  IStateableDeleteData,
} from "./Stateable";
import { Debounce } from "./lib/Debounce";
let tempProcess: undefined | Processable = undefined;

const TARGET_PROCESS_RELY = new Map<any, Map<string, Set<Processable>>>();
const PROCESS_TARGET_RELY = new Map<Processable, Map<any, Set<string>>>();

const watcher = new StateWatcher();
watcher.on("get", (d) => {
  if (tempProcess) {
    addRely(tempProcess, d);
  }
});
watcher.on("set", (d) => {
  const processables = TARGET_PROCESS_RELY.get(d.target)?.get(d.key);
  processables?.forEach((process) => process.valueChange("set", d));
});

function addRely(process: Processable, d: IStateableGetData) {
  if (!TARGET_PROCESS_RELY.has(d.target)) {
    TARGET_PROCESS_RELY.set(d.target, new Map());
  }
  if (!TARGET_PROCESS_RELY.get(d.target)?.get(d.key)) {
    TARGET_PROCESS_RELY.get(d.target)?.set(d.key, new Set());
  }
  const set = TARGET_PROCESS_RELY.get(d.target)?.get(d.key)!;
  set.add(process);
  if (!PROCESS_TARGET_RELY.has(process)) {
    PROCESS_TARGET_RELY.set(process, new Map());
  }
  if (!PROCESS_TARGET_RELY.get(process)?.get(d.target)) {
    PROCESS_TARGET_RELY.get(process)?.set(d.target, new Set());
  }
  const keySet = PROCESS_TARGET_RELY.get(process)?.get(d.target);
  keySet?.add(d.key);
}
function removeRely(process: Processable) {
  const targetsMap = PROCESS_TARGET_RELY.get(process);
  PROCESS_TARGET_RELY.delete(process);
  targetsMap?.forEach((keySet, target) => {
    const keyMap = TARGET_PROCESS_RELY.get(target);
    keySet.forEach((key) => {
      keyMap?.get(key)?.delete(process);
      if (keyMap?.get(key)?.size === 0) {
        keyMap.delete(key);
      }
    });
    if (keyMap?.size === 0) {
      TARGET_PROCESS_RELY.delete(target);
    }
  });
}
export class Processable {
  get runOnInit() {
    return this.opt.runOnInit || this.opt.runOnInit === undefined;
  }
  constructor(
    private handler: IProcessableHandler,
    private opt: { runOnInit?: boolean } = {}
  ) {
    this.runOnInit && this.run(true);
  }
  private result: (() => void) | void | undefined;
  private changed: IChangedData = new Map();
  // valueChanged(d: IStateableSetData | IState) {}
  valueChange(type: "set", data: IStateableSetData): void;
  valueChange(type: "delete", data: IStateableDeleteData): void;
  valueChange(
    type: "set" | "delete",
    data: IStateableSetData | IStateableDeleteData
  ) {
    if (!this.changed.has(data.target)) {
      this.changed.set(data.target, new Map());
    }
    if (!this.changed.get(data.target)?.get(type)) {
      this.changed.get(data.target)?.set(type, new Set());
    }
    this.changed.get(data.target)?.get(type)?.add(data.key);
  }
  debounce = new Debounce(() => {
    removeRely(this);
    this.changed.clear();
    this.result = undefined;
    this.run();
  }, 0);

  run(isFirst = false) {
    const origin = tempProcess;
    this.result = this.handler(this.changed, isFirst);
    tempProcess = origin;
  }
  stop() {
    removeRely(this);
    if (typeof this.result === "function") {
      this.result();
    }
  }
}

export type IProcessableHandler = (
  rely: IChangedData,
  isFirst?: boolean
) => void | (() => void);

export type IChangedData = Map<any, Map<"get" | "set" | "delete", Set<string>>>;

export function isFromProcessableArray(d: any) {
  return true;
}
