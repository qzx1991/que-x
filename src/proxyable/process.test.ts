import { Processable } from './process';
import { Proxyable } from './proxy';

const obj = Proxyable({
  a: 1,
  b: 3,
  o: {} as any,
});

new Processable(() => {
  console.log('running 1');
  const a = obj.a;
  const o = obj.o;
  new Processable(
    () => {
      console.log('running 2');
      const b = obj.a;
      const o = obj.o;
    },
    {
      add: true,
      delete: true,
    },
  );
});

// obj.a = 32;
// obj.b = 3432;
obj.o.a = 2;

delete obj.o.a;
