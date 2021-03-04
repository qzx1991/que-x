import JSXElement from "./JsxElement";

// 判断一个值是不是JSX
export function isJSXElement(t: any) {
  return t instanceof JSXElement;
}

/**
 * 将JSX转成为我们可以用的真实DOM
 */
export function getDomsFromJsx(value: any): (HTMLElement | Text)[] {
  if (isJSXElement(value)) {
    return (value as JSXElement).getElements();
  }
  if (value instanceof Text || value instanceof HTMLElement) {
    return [value];
  }
  if (Array.isArray(value)) {
    return flattern(flattern(value).map((i) => getDomsFromJsx(i)));
  }
  // 没考虑特殊情况，相对粗暴，考虑太多有时并不好
  return [
    new Text(typeof value === "object" ? JSON.stringify(value) : `${value}`),
  ];
}

export function flattern<T>(arr: any[]) {
  const res: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    if (Array.isArray(value)) {
      const v2 = flattern(value);
      v2.forEach((k) => res.push(k as any));
    } else {
      res.push(value);
    }
  }
  return res;
}
