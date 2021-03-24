import { Component } from "../Component";
import { IProp, VirtualElement, IRenderResult } from "../Element";
import { Processable } from "../Processable";

export function formatResult(r: any): IRenderResult {
  if (r instanceof VirtualElement) {
    return r;
  }
  if (Array.isArray(r)) {
    return r;
  }
  return new Text(
    ["string", "number"].includes(typeof r) ? r : JSON.stringify(r)
  );
}
