import { emitter } from './common';
import { Proxyable } from './proxy';

export function State() {
  return (target: any, key: string) => {
    // 这里的target其实是被注解的类的prototype 是它的原型链，
    // 因此，如果要对原型的属性做点什么 得有个地方去存储
    let value = Reflect.get(target, key);
    Object.defineProperty(target, key, {
      get() {
        return value;
      },
      set(v) {
        // 这表示自己可能作为了别人的原型链的一员，这时不应该做什么事
        const descriptor = Object.getOwnPropertyDescriptor(this, key);
        if (this === target || descriptor) {
          value = v;
        }
        if (!descriptor) {
          let tValue = v;
          Object.defineProperty(this, key, {
            get() {
              const proxyableData = Proxyable(tValue);
              emitter.emit('get', {
                target: this,
                property: key,
                value: proxyableData,
              });
              return proxyableData;
            },
            set(v) {
              emitter.emit('set', {
                target: this,
                property: key,
                value: v,
                oldValue: tValue,
              });
              tValue = v;
            },
          });
        }
      },
    });
  };
}
