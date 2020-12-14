import { State } from "que-proxyable";
import { Component } from "../../lib";

export default class B extends Component {
  @State()
  count = 1;

  @State()
  age = 2;

  render() {
    return (
      <div onClick={() => this.count++}>
        {this.count}
        <div onClick={() => this.age++}>{this.age}</div>
      </div>
    );
  }
}
