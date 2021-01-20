/**
 * @author [qianzhixiang]
 * @email [zxqian1991@163.com]
 * @create date 2019-12-12 10:04:00
 * @modify date 2019-12-12 10:04:00
 * @desc [自动绑定this]
 */

export function autobind(
  target: any,
  key: string,
  { configurable, enumerable, set, value }: PropertyDescriptor
) {
  return {
    configurable,
    enumerable,
    // value, 这个值设置后不能设置get set
    set,
    get() {
      return value.bind(this);
    },
  };
}
