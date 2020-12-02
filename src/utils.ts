export function flatternDeep<T>(data: T[]): any[] {
  const res: any[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Array.isArray(data[i])) {
      flatternDeep(data[i] as any).forEach((i) => res.push(i));
    } else {
      res.push(data[i]);
    }
  }
  return res;
}

export function replaceDom(doms: HTMLElement[], elements: HTMLElement[]) {
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
