import { Processable } from "que-proxyable";
import XFactory from "../Factory";
export class ChildProcess {
  process?: Processable;

  constructor(private factory: XFactory) {}

  start() {}

  stop() {
    this.process?.stop();
  }

  getChildren() {
    return [];
  }
}
