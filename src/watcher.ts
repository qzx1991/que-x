import { ProxyWatcher } from "que-proxyable";
import { IPositionOfChildData, ERenderPosition } from "./common";
import {
  getTempRunningPostion,
  storeFactoryMap,
  storeTargetMap,
  TARGET_MAP,
  IFactory,
} from "./common";

const watcher = new ProxyWatcher();

watcher.onGet((t, k) => {
  const POSITION = getTempRunningPostion();
  if (POSITION) {
    storeTargetMap(POSITION, t, k as string);
    storeFactoryMap(POSITION, t, k as string);
  }
});

watcher.onSet((t, k, v) => {
  // 要是值没变，这里也没必要变
  if (t[k] === v) {
    return;
  }
  // 当某个对象被设置了，那么就找到哪些factory的哪些位置被依赖了，然后处理
  const factorys = TARGET_MAP.get(t)?.get(k as string);
  // 找到以来后，需要清空依赖，因为在重新渲染的时候，这些依赖会被重新计算/存储
  TARGET_MAP.get(t)?.set(k as string, new Map());
  // 重新计算、渲染
  factorys?.forEach((positions, factory) =>
    positions.forEach((data, position) => handleChange(factory, position, data))
  );
});

// 处理
function handleChange(
  factory: IFactory,
  position: ERenderPosition,
  data?: Map<number, IPositionOfChildData>
) {
  switch (position) {
    case ERenderPosition.render:
      factory.reExec();
      break;
    case ERenderPosition.props:
      // 表示要重新渲染
      factory.reInitProps();
      break;
    case ERenderPosition.children:
      // const childMap =
      if (data) {
        data.forEach((d, i) => factory.reRenderChild(i));
      }
  }
}
