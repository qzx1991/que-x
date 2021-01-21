import { XDomPosition, XClassType, XStyleType } from "./interface";
/**
 * 将复杂的数组对象转换成一维数组
 * @param data 需要被打平的对象
 */
export function flatternDeep<T>(data: T[], recrusive = true): any[] {
  const res: any[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Array.isArray(data[i])) {
      (recrusive
        ? flatternDeep(data[i] as any, recrusive)
        : (data[i] as any)
      ).forEach((i: any) => res.push(i));
    } else {
      res.push(data[i]);
    }
  }
  return res;
}

export function appendElements(
  parentElemet: HTMLElement,
  children: (HTMLElement | HTMLElement[])[]
) {
  children.forEach((child) => {
    if (Array.isArray(child)) {
      appendElements(parentElemet, child);
    } else {
      parentElemet.append(child);
    }
  });
}

/**
 *
 * @param doms 需要被替换的dom节点
 * @param elements 新加的节点
 */
export function replaceDoms(doms: HTMLElement[], elements: HTMLElement[]) {
  const position = getDomPositionInfo(doms, true);
  if (!position) return;
  insertElements(elements, position);
}

export function getDomPositionInfo(
  elements: HTMLElement[],
  shouldRemove = false
): XDomPosition | undefined {
  const dom = elements[elements.length - 1];
  if (!dom) return undefined;
  const nextSibling = dom.nextSibling || dom.nextElementSibling;
  const parent = (dom as any).parent || dom.parentNode;
  if (shouldRemove) {
    elements.forEach((i) => i.remove());
  }
  return {
    parent,
    nextSibling,
  };
}

export function insertElements(elements: HTMLElement[], info: XDomPosition) {
  if (!info) return;
  if (!info.nextSibling) {
    elements.forEach((ele) => info.parent.appendChild(ele));
  } else {
    let tDom = info.nextSibling;
    for (let i = elements.length - 1; i >= 0; i--) {
      info.parent?.insertBefore(elements[i], tDom);
      tDom = elements[i];
    }
  }
}

export function diffSet(s1: Set<string>, s2: Set<string>) {
  const added: string[] = [];
  const deleted: string[] = [];
  s1.forEach((property) => {
    if (!s2.has(property)) {
      deleted.push(property);
    }
    s2.delete(property);
  });
  s2.forEach((property) => added.push(property));
  return {
    added,
    deleted,
  };
}

export function isPrivateProperty(property: string) {
  return /^_+/gi.test(property);
}

export function isEventProperty(property: string) {
  return /^on/gi.test(property);
}

export function isClassProperty(property: string) {
  return property === "className";
}
export function isStyleProperty(property: string) {
  return property === "style";
}

function className(classname: XClassType): string | undefined {
  if (!classname) return;
  if (typeof classname === "string") {
    return classname;
  }
  if (Array.isArray(classname)) {
    return classname
      .map(className)
      .filter((c) => c)
      .join(" ");
  }
  return className(
    Object.keys(classname)
      .filter((prop) => classname[prop])
      .map((prop) => prop)
  );
}

export function getClassValue(...classnames: XClassType[]) {
  return className(classnames.map(className));
}

export function getStyleValue(value: XStyleType) {
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return Object.keys(value)
      .map((key) => `${key}:${value[key]}`)
      .join(";");
  }
  return "";
}
