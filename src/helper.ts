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

/**
 *
 * @param doms 需要被替换的dom节点
 * @param elements 新加的节点
 */
export function replaceDoms(doms: HTMLElement[], elements: HTMLElement[]) {
  const dom = doms[doms.length - 1];
  const nextSibling = dom.nextSibling || dom.nextElementSibling;
  const parentDom = (dom as any).parent || dom.parentNode;
  // dom.remove();
  doms.forEach((i) => i.remove());
  if (!nextSibling) {
    elements.forEach((ele) => parentDom.appendChild(ele));
  } else {
    let tDom = nextSibling;
    for (let i = elements.length - 1; i >= 0; i--) {
      parentDom?.insertBefore(elements[i], tDom);
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
