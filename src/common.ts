// 函数组件
export type QuexFunctionalComponent<T = any> = (prop: T) => QuexRenderResult;

export interface IComponent<P = {}> {
  render: () => QuexRenderResult;

  onInited?: () => void;

  onPropsChange?: (nextp: P, prep: P) => void;

  onMount?: () => void;
  onMounted?: () => void;

  onUnMount?: () => void;

  onUnMounted?: () => void;
}

export default class Component implements IComponent {
  private isComponent = true;
  render(): QuexRenderResult {
    return "";
  }
}

export interface IFactory {
  component: QuexComponent;
  props: QuexableData;
  children: QuexableData[];

  exec: () => void;

  // reExec会加上10ms左右的debounce防止重复性的渲染
  reExec: () => void;

  initProps: () => void;

  reInitProps: () => void;

  renderChildren: () => void;

  reRenderChildren: () => void;

  renderChild: (index: number) => void;
  reRenderChild: (index: number) => void;
}

export type QuexComponent = typeof Component | IComponent | string;
export type QuexRenderResult = IFactory | string | object | Text; // 渲染结果
export type QuexableData = () => any; // 需要被计算的值

export type TRunningPosition = {
  factory: IFactory;
  position: ERenderPosition;
  data?: any;
};

let TEMP_RUNNING_POSITION: TRunningPosition | undefined = undefined;

export enum ERenderPosition {
  "render", // 渲染的过程
  "props", // 初始化属性的过程
  "children", // 渲染子节点的过程
}

export function getTempRunningPostion() {
  return TEMP_RUNNING_POSITION;
}

export function recordTempRunningPosition(
  handler: () => void,
  factory: IFactory,
  position: ERenderPosition,
  data?: any
) {
  const originPosition = TEMP_RUNNING_POSITION;

  TEMP_RUNNING_POSITION = {
    factory,
    position,
    data,
  };

  const res = handler();
  TEMP_RUNNING_POSITION = originPosition;
  return res;
}

export const TARGET_MAP = new Map<
  any,
  Map<string, Map<IFactory, Map<ERenderPosition, any>>>
>();
// 记录Factory依赖的对象
export const FACTORY_MAP = new Map<IFactory, Map<any, Set<string>>>();

export interface IPositionOfChildData {
  index: number; // 渲染的index
  value: QuexableData;
}

export function storeTargetMap(POSITION: TRunningPosition, t: any, k: string) {
  if (!TARGET_MAP.has(t)) {
    TARGET_MAP.set(t, new Map());
  }
  const keyMap = TARGET_MAP.get(t);
  if (!keyMap?.get(k)) {
    keyMap?.set(k, new Map());
  }
  const keyFactoryMap = keyMap?.get(k);
  if (!keyFactoryMap?.get(POSITION.factory)) {
    keyFactoryMap?.set(POSITION.factory, new Map());
  }
  const keyFacotoryPositionMap = keyFactoryMap?.get(POSITION.factory);
  if (keyFacotoryPositionMap?.has(ERenderPosition.render)) {
    return;
  }
  switch (POSITION.position) {
    case ERenderPosition.render:
      // render 有最高的级别，因为它总是要重新计算的
      keyFacotoryPositionMap?.clear();
      keyFacotoryPositionMap?.set(ERenderPosition.render, POSITION);
      break;
    case ERenderPosition.props:
      // children也没必要了 都会重新计算
      keyFacotoryPositionMap?.delete(ERenderPosition.children);
      keyFacotoryPositionMap?.set(ERenderPosition.props, POSITION);
      break;
    case ERenderPosition.children:
      // children 的数量是固定的
      if (keyFacotoryPositionMap?.has(ERenderPosition.props)) {
        return;
      }
      if (!keyFacotoryPositionMap?.has(ERenderPosition.children)) {
        keyFacotoryPositionMap?.set(ERenderPosition.children, new Map());
      }
      const childMap: Map<
        number,
        IPositionOfChildData
      > = keyFacotoryPositionMap?.get(ERenderPosition.children);
      childMap.set(POSITION.data?.index || 0, POSITION.data);
      break;
  }
}

export function storeFactoryMap(POSITION: TRunningPosition, t: any, k: string) {
  if (!FACTORY_MAP.has(POSITION.factory)) {
    FACTORY_MAP.set(POSITION.factory, new Map());
  }
  const targetMap = FACTORY_MAP.get(POSITION.factory);
  if (!targetMap?.has(t)) {
    targetMap?.set(t, new Set());
  }
  const keysSet = targetMap?.get(t);
  keysSet?.add(k);
}

export function isQuexComponent(com: any) {
  return com && com.prototype && com.prototype.isComponent;
}
